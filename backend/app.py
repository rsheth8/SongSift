import json
from random import randint

import librosa
from flask import Flask, request, jsonify, send_from_directory, url_for, render_template, session
import eyed3
from flask_cors import CORS
from werkzeug.utils import secure_filename
import re
import os
import hashlib
import pandas as pd
import math
import time
import numpy as np
import soundfile as sf
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
import uuid
from datetime import datetime

# Import existing modules
from analysis.audio_features import extract_audio_features
from analysis.waveform import create_wave_form

# Import new modules
from recommendation.content_based import ContentBasedRecommender
from recommendation.collaborative import CollaborativeRecommender
from recommendation.hybrid import HybridRecommender
from clustering.playlist_generator import PlaylistGenerator
from clustering.visualizations import ClusterVisualizer
from graph.music_graph import MusicGraph
from graph.path_finder import MusicPathFinder
from nlp.lyric_fetcher import LyricFetcher
from nlp.sentiment_analyzer import LyricAnalyzer
from audio.mashup_generator import MashupGenerator
from audio.beat_matcher import BeatMatcher
from models.song import Song
from models.user import User
from models.playlist import Playlist
from database.db_manager import get_db
from utils.file_handlers import extract_song_metadata, is_audio_file, get_file_size_mb

# Initialize Flask app
app = Flask(__name__, static_folder='static', template_folder='templates')
app.secret_key = os.environ.get('SECRET_KEY', 'tunesift_secret_key')
CORS(app, origins=["http://localhost:5173", "http://localhost:3000"], supports_credentials=True)

# Configuration
UPLOAD_FOLDER = './uploads'
VISUALIZATIONS_FOLDER = os.path.join(UPLOAD_FOLDER, 'visualizations')
MASHUPS_FOLDER = os.path.join(UPLOAD_FOLDER, 'mashups')
MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB max upload size
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'ogg', 'flac', 'm4a'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VISUALIZATIONS_FOLDER, exist_ok=True)
os.makedirs(MASHUPS_FOLDER, exist_ok=True)

# Initialize database
db = get_db()

# Ensure collections exist
if db.count('songs', {}) == 0:
    print("Initializing songs collection")

if db.count('ratings', {}) == 0:
    print("Initializing ratings collection")

if db.count('playlists', {}) == 0:
    print("Initializing playlists collection")



def clean_nan_values(data):
    """
    Recursively clean NaN and Infinity values from data structures
    """
    if isinstance(data, dict):
        return {key: clean_nan_values(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [clean_nan_values(item) for item in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None  # or 0.0 if you prefer
        return data
    else:
        return data

# Helper functions
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_song_folder(title, artist):
    folder_name = secure_filename(f"{title}_{artist}")
    folder_path = os.path.join(UPLOAD_FOLDER, folder_name)
    os.makedirs(folder_path, exist_ok=True)
    return folder_path

def extract_album_cover(file_path, song_folder):
    try:
        audio_file = eyed3.load(file_path)
        if audio_file.tag is not None and audio_file.tag.images:
            image_data = audio_file.tag.images[0].image_data
            album_cover_path = os.path.join(song_folder, "album_cover.jpg")
            with open(album_cover_path, 'wb') as img_file:
                img_file.write(image_data)
            return album_cover_path
        return None
    except Exception as e:
        print(f"Error extracting album cover: {e}")
        return None

def extract_song_title(file_path):
    try:
        audio_file = eyed3.load(file_path)
        if audio_file.tag and audio_file.tag.title:
            return audio_file.tag.title
        return os.path.splitext(os.path.basename(file_path))[0]
    except Exception as e:
        print(f"Error extracting song title: {e}")
        return "Unknown Title"

def extract_artist_name(file_path):
    try:
        audio_file = eyed3.load(file_path)
        if audio_file.tag and audio_file.tag.artist:
            return audio_file.tag.artist
        return "Unknown Artist"
    except Exception as e:
        print(f"Error extracting artist name: {e}")
        return "Unknown Artist"

def generate_song_id(title, artist):
    """Generate a unique ID for a song based on title and artist"""
    combined = f"{title}_{artist}".lower()
    return hashlib.md5(combined.encode()).hexdigest()

# API Routes

@app.route('/')
def index():
    """Serve the main application page"""
    return render_template('index.html')

@app.route('/api/songs', methods=['GET'])
def get_all_songs():
    """Get all songs in the database"""
    songs = db.find('songs', {})
    return jsonify(songs), 200

@app.route('/api/upload', methods=['POST'])
def upload_files():
    """Upload audio files and extract metadata"""
    print("Upload request received")

    if 'files[]' not in request.files:
        print("No 'files[]' in request")
        return jsonify({'error': 'No file part in the request'}), 400

    files = request.files.getlist('files[]')
    if not files:
        print("No files selected")
        return jsonify({'error': 'No files selected'}), 400

    print(f"Processing {len(files)} files")

    metadata_list = []
    errors = []

    for file in files:
        if file and file.filename != '':
            if not allowed_file(file.filename):
                errors.append(f"File type not allowed: {file.filename}")
                continue

            filename = secure_filename(file.filename)
            temp_filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            try:
                file.save(temp_filepath)

                # Check file size
                if get_file_size_mb(temp_filepath) > 50:
                    os.remove(temp_filepath)
                    errors.append(f"File too large: {file.filename}")
                    continue

                song_title = extract_song_title(temp_filepath)
                artist_name = extract_artist_name(temp_filepath)
                song_folder = create_song_folder(song_title, artist_name)

                final_filepath = os.path.join(song_folder, filename)
                os.rename(temp_filepath, final_filepath)

                album_cover = extract_album_cover(final_filepath, song_folder)

                # Extract audio features
                features = extract_audio_features(final_filepath)

                # Generate unique song ID
                song_id = generate_song_id(song_title, artist_name)

                # Create waveform
                waveform_path = create_wave_form(final_filepath, song_folder)
                relative_waveform_path = os.path.relpath(waveform_path, UPLOAD_FOLDER)

                # Create song object
                song = Song(
                    id=song_id,
                    title=song_title,
                    artist=artist_name,
                    filepath=final_filepath,
                    features=features,
                    album_cover=f'/uploads/{os.path.basename(song_folder)}/album_cover.jpg' if album_cover else None,
                    audio_url=f'/uploads/{os.path.basename(song_folder)}/{filename}'
                )

                # Convert to dictionary for storage
                song_dict = song.to_dict()
                song_dict['waveformUrl'] = f'/uploads/{relative_waveform_path}'
                song_dict['isAnalyzed'] = True

                # Add to database
                existing_song = db.find_one('songs', {'id': song_id})
                if existing_song:
                    db.update_one('songs', {'id': song_id}, song_dict)
                else:
                    db.insert_one('songs', song_dict)

                metadata_list.append(song_dict)
            except Exception as e:
                errors.append(f"Error processing {file.filename}: {str(e)}")
                print(f"Error processing file: {e}")
                # Clean up temp file if it exists
                if os.path.exists(temp_filepath):
                    os.remove(temp_filepath)
                continue

    response = {
        'songs': metadata_list,
    }

    if errors:
        response['errors'] = errors

    return jsonify(response), 200 if metadata_list else 400


@app.route('/api/analyze/<path:filename>', methods=['GET'])
@app.route('/api/analyze/<song_id>', methods=['GET'])
def analyze_file(song_id):
    """Analyze an audio file by song ID"""
    # Find the song in the database
    song = db.find_one('songs', {'id': song_id})
    if not song:
        return jsonify({'error': 'Song not found'}), 404

    filepath = song['filepath']

    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404

    try:
        features = extract_audio_features(filepath)
        analysis_result = {
            'song_id': song_id,
            'analysis': features,
            'isAnalyzed': True
        }
        return jsonify(analysis_result), 200
    except Exception as e:
        print(f"Error analyzing file: {e}")
        return jsonify({'error': 'Error analyzing file'}), 500


@app.route('/uploads/<path:filename>', methods=['GET'])
def get_uploaded_file(filename):
    """Serve uploaded files"""
    try:
        return send_from_directory(app.config["UPLOAD_FOLDER"], filename)
    except Exception as e:
        return jsonify({'error': f'Error retrieving file: {str(e)}'}), 404

@app.route('/api/in-depth-analysis/<song_id>', methods=['GET'])
def in_depth_analysis(song_id):
    """Perform in-depth analysis on an audio file"""
    # Find the song in the database
    song = db.find_one('songs', {'id': song_id})
    if not song:
        return jsonify({'error': 'Song not found'}), 404

    filepath = song['filepath']

    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404

    song_folder = os.path.dirname(filepath)
    plot_path = create_wave_form(filepath, song_folder)
    plot_url = f'/uploads/{os.path.relpath(plot_path, UPLOAD_FOLDER)}'

    return jsonify({'waveformPlotUrl': plot_url}), 200


@app.route('/api/visualize/<song_id>/<feature>', methods=['GET'])
def visualize_feature(song_id, feature):
    """Generate visualization for a specific audio feature"""
    # Validate inputs
    if not isinstance(song_id, str) or not re.match(r'^[0-9a-f]{32}$', song_id):
        return jsonify({'error': 'Invalid song ID format'}), 400

    valid_features = ['waveform', 'spectrum', 'chromagram', 'tempo', 'pitch']
    if feature not in valid_features:
        return jsonify({'error': f'Invalid feature. Must be one of: {", ".join(valid_features)}'}), 400

    # Find the song in the database
    song = db.find_one('songs', {'id': song_id})
    if not song:
        return jsonify({'error': 'Song not found'}), 404

    filepath = song.get('filepath')
    if not filepath or not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404

    try:
        # Get the song's folder instead of using VISUALIZATIONS_FOLDER
        song_folder = os.path.dirname(filepath)

        # Create visualization filename
        viz_filename = f"{feature}.png"
        viz_path = os.path.join(song_folder, viz_filename)

        if feature == 'waveform':
            # Reuse existing waveform function
            viz_path = create_wave_form(filepath, song_folder)
        elif feature == 'spectrum':
            # Create spectrum visualization
            from analysis.visualizations import create_spectrum
            create_spectrum(filepath, viz_path)
        elif feature == 'chromagram':
            # Create chromagram visualization
            from analysis.visualizations import create_chromagram
            create_chromagram(filepath, viz_path)
        elif feature == 'tempo':
            # Create tempo visualization
            from analysis.visualizations import create_tempo_visualization
            create_tempo_visualization(filepath, viz_path)
        elif feature == 'pitch':
            # Create pitch visualization
            from analysis.visualizations import create_pitch_visualization
            create_pitch_visualization(filepath, viz_path)

        # Verify the visualization was created
        if not os.path.exists(viz_path):
            return jsonify({'error': 'Failed to create visualization'}), 500

        # Return the URL to the visualization
        # Use the song's audioUrl path structure to build the visualization URL
        audio_url = song.get('audioUrl', '')
        audio_dir = os.path.dirname(audio_url)
        viz_url = f"{audio_dir}/{viz_filename}"

        return jsonify({
            'visualizationUrl': viz_url
        }), 200
    except Exception as e:
        print(f"Error creating visualization: {e}")
        return jsonify({'error': f'Error creating visualization: {str(e)}'}), 500


@app.route('/static/<path:filename>')
def serve_static(filename):
    """Serve static files"""
    return send_from_directory(app.static_folder, filename)

# User Management Routes

@app.route('/api/users/register', methods=['POST'])
def register_user():
    """Register a new user"""
    data = request.json

    username = data.get('username')
    email = data.get('email')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    # Check if username already exists
    existing_user = db.find_one('users', {'username': username})
    if existing_user:
        return jsonify({'error': 'Username already exists'}), 409

    # Create user
    user_id = str(uuid.uuid4())
    user = User(id=user_id, username=username, email=email)
    user.set_password(password)

    # Save to database
    db.insert_one('users', user.to_dict())

    return jsonify({
        'message': 'User registered successfully',
        'user_id': user_id,
        'username': username
    }), 201

@app.route('/api/users/login', methods=['POST'])
def login_user():
    """Login a user"""
    data = request.json

    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    # Find user
    user_data = db.find_one('users', {'username': username})
    if not user_data:
        return jsonify({'error': 'Invalid username or password'}), 401

    # Check password
    user = User.from_dict(user_data)
    if not user.check_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401

    # Set session
    session['user_id'] = user.id

    return jsonify({
        'message': 'Login successful',
        'user_id': user.id,
        'username': user.username
    }), 200

@app.route('/api/users/logout', methods=['POST'])
def logout_user():
    """Logout a user"""
    session.pop('user_id', None)
    return jsonify({'message': 'Logout successful'}), 200

# Recommendation Routes

@app.route('/api/recommend/similar/<song_id>', methods=['GET'])
def recommend_similar_songs(song_id):
    """Recommend songs similar to the given song using content-based filtering"""
    songs = db.find('songs', {})
    if not songs:
        return jsonify({'error': 'No songs in database'}), 400

    # Find the song in the database
    song = next((s for s in songs if s['id'] == song_id), None)
    if not song:
        return jsonify({'error': 'Song not found'}), 404

    # Convert songs to DataFrame for processing
    songs_df = pd.DataFrame(songs)

    # Initialize recommender
    recommender = ContentBasedRecommender(songs_df)

    # Get number of recommendations from query parameters (default: 5)
    num_recommendations = int(request.args.get('count', 5))

    # Get recommendations
    recommendations = recommender.recommend_similar_songs(song_id, num_recommendations)

    return jsonify({
        'song_id': song_id,
        'song_title': song['title'],
        'song_artist': song['artist'],
        'recommendations': recommendations
    }), 200

@app.route('/api/recommend/collaborative/<user_id>', methods=['GET'])
def recommend_collaborative(user_id):
    """Recommend songs for a user based on collaborative filtering"""
    ratings = db.find('ratings', {})
    if len(ratings) < 10:  # Need a minimum number of ratings
        return jsonify({'error': 'Not enough ratings for collaborative filtering'}), 400

    # Convert to DataFrame
    ratings_df = pd.DataFrame(ratings)

    # Check if user has ratings
    if user_id not in ratings_df['user_id'].values:
        return jsonify({'error': 'User has no ratings'}), 404

    # Get number of recommendations from query parameters (default: 5)
    num_recommendations = int(request.args.get('count', 5))

    # Initialize recommender
    recommender = CollaborativeRecommender(ratings_df)

    # Get recommendations
    try:
        recommendations = recommender.recommend_songs(user_id, num_recommendations)

        # Add song details to recommendations
        songs = db.find('songs', {})
        for rec in recommendations:
            song = next((s for s in songs if s['id'] == rec['song_id']), None)
            if song:
                rec['title'] = song['title']
                rec['artist'] = song['artist']
                rec['albumCover'] = song.get('albumCover')

        return jsonify({
            'user_id': user_id,
            'recommendations': recommendations
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recommend/hybrid/<user_id>', methods=['GET'])
def recommend_hybrid(user_id):
    """Recommend songs using hybrid approach (content + collaborative)"""
    songs = db.find('songs', {})
    ratings = db.find('ratings', {})

    if not songs:
        return jsonify({'error': 'No songs in database'}), 400

    # Get optional seed song
    seed_song_id = request.args.get('seed_song_id')

    # Get number of recommendations from query parameters (default: 5)
    num_recommendations = int(request.args.get('count', 5))

    # Convert to DataFrames
    songs_df = pd.DataFrame(songs)
    ratings_df = pd.DataFrame(ratings) if ratings else None

    # Initialize recommender
    recommender = HybridRecommender(songs_df, ratings_df)

    # Get recommendations
    try:
        recommendations = recommender.recommend_for_user(user_id, seed_song_id, num_recommendations)

        return jsonify({
            'user_id': user_id,
            'seed_song_id': seed_song_id,
            'recommendations': recommendations
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/recommend/mood/<mood>', methods=['GET'])
def recommend_by_mood(mood):
    """Recommend songs based on mood"""
    songs = db.find('songs', {})
    if not songs:
        return jsonify({'error': 'No songs in database'}), 400

    # Convert to DataFrame
    songs_df = pd.DataFrame(songs)

    # Get number of recommendations from query parameters (default: 5)
    num_recommendations = int(request.args.get('count', 5))

    # Initialize recommender
    recommender = HybridRecommender(songs_df, None)

    # Get recommendations
    try:
        recommendations = recommender.recommend_for_mood(mood, num_recommendations)

        return jsonify({
            'mood': mood,
            'recommendations': recommendations
        }), 200
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Playlist Routes

@app.route('/api/playlists', methods=['GET'])
def get_playlists():
    """Get all playlists or playlists for a specific user"""
    user_id = request.args.get('user_id')

    if user_id:
        playlists = db.find('playlists', {'user_id': user_id})
    else:
        playlists = db.find('playlists', {})

    return jsonify(playlists), 200

@app.route('/api/playlists/<playlist_id>', methods=['GET'])
def get_playlist(playlist_id):
    """Get a specific playlist"""
    playlist = db.find_one('playlists', {'id': playlist_id})

    if not playlist:
        return jsonify({'error': 'Playlist not found'}), 404

    # Get song details
    songs = db.find('songs', {})
    playlist_songs = []

    for song_id in playlist['songs']:
        song = next((s for s in songs if s['id'] == song_id), None)
        if song:
            playlist_songs.append({
                'id': song['id'],
                'title': song['title'],
                'artist': song['artist'],
                'albumCover': song.get('albumCover'),
                'audioUrl': song.get('audioUrl')
            })

    playlist['song_details'] = playlist_songs

    return jsonify(playlist), 200

@app.route('/api/playlists/create', methods=['POST'])
def create_playlist():
    """Create a new playlist"""
    data = request.json

    name = data.get('name')
    user_id = data.get('user_id')
    song_ids = data.get('song_ids', [])

    if not name:
        return jsonify({'error': 'Playlist name is required'}), 400

    # Create playlist
    playlist_id = str(uuid.uuid4())
    playlist = Playlist(
        id=playlist_id,
        name=name,
        user_id=user_id,
        songs=song_ids
    )

    # Save to database
    db.insert_one('playlists', playlist.to_dict())

    return jsonify({
        'message': 'Playlist created successfully',
        'playlist': playlist.to_dict()
    }), 201

@app.route('/api/playlists/create-transition', methods=['POST'])
def create_playlist_transition():
    """Create a smooth transition for an entire playlist"""
    try:
        data = request.json
        song_ids = data.get('song_ids', [])
        transition_duration = data.get('transition_duration', 8)

        if len(song_ids) < 2:
            return jsonify({'error': 'At least 2 songs required for playlist transition'}), 400

        # Get songs from database
        songs = []
        for song_id in song_ids:
            song = db.find_one('songs', {'id': song_id})
            if song:
                songs.append(song)

        if len(songs) < 2:
            return jsonify({'error': 'Not enough valid songs found'}), 404

        # Initialize beat matcher
        beat_matcher = BeatMatcher()

        # Create a chain of transitions
        transition_segments = []

        for i in range(len(songs) - 1):
            current_song = songs[i]
            next_song = songs[i + 1]

            current_path = os.path.join(app.config['UPLOAD_FOLDER'], current_song['audioUrl'].replace('/uploads/', ''))
            next_path = os.path.join(app.config['UPLOAD_FOLDER'], next_song['audioUrl'].replace('/uploads/', ''))

            # Create temporary transition
            temp_transition_path = os.path.join(MASHUPS_FOLDER, f'temp_transition_{i}.wav')

            transition_result = beat_matcher.create_transition(
                current_path,
                next_path,
                temp_transition_path,
                transition_duration=transition_duration
            )

            transition_segments.append(temp_transition_path)

        # Combine all transitions into one file
        playlist_id = str(uuid.uuid4())
        playlist_filename = f"playlist_mix_{playlist_id}.wav"
        playlist_path = os.path.join(MASHUPS_FOLDER, playlist_filename)

        # Load and concatenate all transition segments
        combined_audio = []
        sample_rate = None

        for segment_path in transition_segments:
            y, sr = librosa.load(segment_path, sr=None)
            if sample_rate is None:
                sample_rate = sr
            elif sr != sample_rate:
                y = librosa.resample(y=y, orig_sr=sr, target_sr=sample_rate)
            combined_audio.append(y)

        # Concatenate all segments
        final_audio = np.concatenate(combined_audio)

        # Save the final playlist mix
        sf.write(playlist_path, final_audio, sample_rate)

        # Clean up temporary files
        for temp_path in transition_segments:
            try:
                os.remove(temp_path)
            except:
                pass

        # Save playlist transition to database
        transition_data = {
            'id': playlist_id,
            'title': f"Playlist Mix ({len(songs)} songs)",
            'song_ids': song_ids,
            'audioUrl': f"/uploads/mashups/{playlist_filename}",
            'duration': len(final_audio) / sample_rate,
            'created_at': datetime.now().isoformat()
        }

        db.insert_one('playlist_transitions', transition_data)

        return jsonify({
            'message': 'Playlist transition created successfully',
            'transition': transition_data
        }), 200

    except Exception as e:
        print(f"Error creating playlist transition: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error creating playlist transition: {str(e)}'}), 500



@app.route('/api/playlists/generate', methods=['POST'])
def generate_playlists():
    """Generate playlists using clustering"""
    try:
        data = request.json
        song_ids = data.get('song_ids')
        num_clusters = data.get('num_clusters', 3)
        user_id = data.get('user_id', '1')

        print(f"Generating playlists with {num_clusters} clusters")

        # Get songs from database
        if song_ids:
            songs = []
            for song_id in song_ids:
                song = db.find_one('songs', {'id': song_id})
                if song:
                    songs.append(song)
            print(f"Using {len(songs)} selected songs")
        else:
            songs = db.find('songs', {})
            print(f"Using all {len(songs)} songs")

        if len(songs) < num_clusters:
            return jsonify({
                'error': f'Not enough songs ({len(songs)}) for {num_clusters} clusters. Please select more songs or reduce the number of playlists.'
            }), 400

        # Convert to DataFrame
        songs_df = pd.DataFrame(songs)

        # Check if we have the required columns
        required_columns = ['id', 'title', 'artist']
        missing_columns = [col for col in required_columns if col not in songs_df.columns]
        if missing_columns:
            return jsonify({
                'error': f'Missing required columns: {missing_columns}'
            }), 400

        # Initialize playlist generator
        generator = PlaylistGenerator(songs_df, n_clusters=num_clusters)

        # Generate playlists
        playlist_results = generator.generate_playlists()

        # Convert to the expected format
        playlists = []
        for i, (name, songs_list) in enumerate(playlist_results.items()):
            playlist = {
                'id': f'playlist_{i}',
                'name': name,
                'songs': [song['id'] for song in songs_list],
                'song_details': songs_list
            }
            playlists.append(playlist)

        # Create visualization
        viz_path = os.path.join(VISUALIZATIONS_FOLDER, f'playlists_{user_id}_{int(time.time())}.png')
        try:
            generator.visualize_clusters(save_path=viz_path)
            viz_url = f'/uploads/visualizations/{os.path.basename(viz_path)}'
        except Exception as viz_error:
            print(f"Warning: Could not create visualization: {viz_error}")
            viz_url = None

        return jsonify({
            'playlists': playlists,
            'visualization_url': viz_url
        }), 200

    except Exception as e:
        print(f"Error in generate_playlists endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error generating playlists: {str(e)}'}), 500


# Rating Routes

@app.route('/api/rate/song', methods=['POST'])
def rate_song():
    """Rate a song (for collaborative filtering)"""
    data = request.json

    user_id = data.get('user_id')
    song_id = data.get('song_id')
    rating = data.get('rating')

    if not user_id or not song_id or rating is None:
        return jsonify({'error': 'User ID, song ID, and rating are required'}), 400

    # Validate rating (0-5 scale)
    if not (0 <= rating <= 5):
        return jsonify({'error': 'Rating must be between 0 and 5'}), 400

    # Check if song exists
    song = db.find_one('songs', {'id': song_id})
    if not song:
        return jsonify({'error': 'Song not found'}), 404

    # Add or update rating
    existing_rating = db.find_one('ratings', {'user_id': user_id, 'song_id': song_id})

    if existing_rating:
        db.update_one('ratings', {'user_id': user_id, 'song_id': song_id}, {'rating': rating})
    else:
        db.insert_one('ratings', {
            'user_id': user_id,
            'song_id': song_id,
            'rating': rating,
            'timestamp': datetime.now().isoformat()
        })

    return jsonify({
        'message': 'Rating saved successfully',
        'user_id': user_id,
        'song_id': song_id,
        'rating': rating
    }), 200

# Mashup Routes

@app.route('/api/mashup/analyze', methods=['POST', 'OPTIONS'])
def analyze_mashup_compatibility():
    """Analyze compatibility of two songs for mashup"""
    # Handle OPTIONS request for CORS preflight
    if request.method == 'OPTIONS':
        return '', 204

    try:
        print("Received analyze request")
        data = request.json
        print(f"Request data: {data}")

        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400

        song1_id = data.get('song1_id')
        song2_id = data.get('song2_id')

        if not song1_id or not song2_id:
            return jsonify({'error': 'Both song IDs are required'}), 400

        # Find songs in database
        song1 = db.find_one('songs', {'id': song1_id})
        song2 = db.find_one('songs', {'id': song2_id})

        if not song1 or not song2:
            return jsonify({'error': 'One or both songs not found'}), 404

        # Initialize mashup generator
        generator = MashupGenerator()

        # Get file paths
        song1_path = os.path.join(app.config['UPLOAD_FOLDER'], song1['audioUrl'].replace('/uploads/', ''))
        song2_path = os.path.join(app.config['UPLOAD_FOLDER'], song2['audioUrl'].replace('/uploads/', ''))

        if not os.path.exists(song1_path):
            return jsonify({'error': f'File not found: {song1_path}'}), 404

        if not os.path.exists(song2_path):
            return jsonify({'error': f'File not found: {song2_path}'}), 404

        # Analyze compatibility
        compatibility = generator.analyze_tracks(song1_path, song2_path)

        return jsonify({
            'song1': {
                'id': song1_id,
                'title': song1['title'],
                'artist': song1['artist']
            },
            'song2': {
                'id': song2_id,
                'title': song2['title'],
                'artist': song2['artist']
            },
            'compatibility': compatibility
        }), 200
    except Exception as e:
        print(f"Error in analyze_mashup_compatibility: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/mashup/preview', methods=['POST'])
def preview_mashup():
    """Generate a preview of a mashup with adjustments"""
    data = request.json

    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400

    song1_id = data.get('song1_id')
    song2_id = data.get('song2_id')
    pitch_shift = data.get('pitch_shift', 0)
    tempo_adjustment = data.get('tempo_adjustment', 0)
    crossfade_duration = data.get('crossfade_duration', 5)

    if not song1_id or not song2_id:
        return jsonify({'error': 'Both song IDs are required'}), 400

    # Find songs in database
    song1 = db.find_one('songs', {'id': song1_id})
    song2 = db.find_one('songs', {'id': song2_id})

    if not song1 or not song2:
        return jsonify({'error': 'One or both songs not found'}), 404

    # Get file paths
    song1_path = os.path.join(app.config['UPLOAD_FOLDER'], song1['audioUrl'].replace('/uploads/', ''))
    song2_path = os.path.join(app.config['UPLOAD_FOLDER'], song2['audioUrl'].replace('/uploads/', ''))

    # Create preview directory if it doesn't exist
    preview_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'previews')
    os.makedirs(preview_dir, exist_ok=True)

    # Generate unique filename for preview
    preview_filename = f"preview_{song1_id}_{song2_id}_{pitch_shift}_{tempo_adjustment}_{int(time.time())}.mp3"
    preview_path = os.path.join(preview_dir, preview_filename)

    try:
        # Initialize mashup generator
        generator = MashupGenerator(crossfade_duration=crossfade_duration)

        # Apply pitch shift to song2 if needed
        if pitch_shift != 0:
            temp_shifted_path = os.path.join(preview_dir, f"temp_shifted_{song2_id}.mp3")
            generator.pitch_shift_for_compatibility(song2_path, pitch_shift, temp_shifted_path)
            song2_path = temp_shifted_path

        # Apply tempo adjustment to song2 if needed
        if tempo_adjustment != 0:
            tempo_ratio = 1 + (tempo_adjustment / 100)
            temp_tempo_path = os.path.join(preview_dir, f"temp_tempo_{song2_id}.mp3")
            generator.tempo_adjust_for_compatibility(song2_path, tempo_ratio, temp_tempo_path)
            song2_path = temp_tempo_path

        # Create preview mashup
        generator.create_mashup(song1_path, song2_path, preview_path)

        # Return preview URL
        preview_url = f"/uploads/previews/{preview_filename}"

        return jsonify({
            'previewUrl': preview_url,
            'adjustedCompatibility': {
                'pitch_shift': pitch_shift,
                'tempo_adjustment': tempo_adjustment,
                'crossfade_duration': crossfade_duration
            }
        }), 200
    except Exception as e:
        print(f"Error creating preview: {e}")
        return jsonify({'error': str(e)}), 500



@app.route('/api/mashup/create', methods=['POST'])
def create_mashup():
    """Create a mashup of two songs"""
    data = request.json

    if not data:
        return jsonify({'error': 'No JSON data provided'}), 400

    song1_id = data.get('song1_id')
    song2_id = data.get('song2_id')
    crossfade_duration = data.get('crossfade_duration', 5)
    pitch_shift = data.get('pitch_shift', 0)
    tempo_adjustment = data.get('tempo_adjustment', 0)

    # Log received parameters
    print(f"Creating mashup with: pitch_shift={pitch_shift}, tempo_adjustment={tempo_adjustment}, crossfade={crossfade_duration}")

    if not song1_id or not song2_id:
        return jsonify({'error': 'Both song IDs are required'}), 400

    # Find songs in database
    song1 = db.find_one('songs', {'id': song1_id})
    song2 = db.find_one('songs', {'id': song2_id})

    if not song1 or not song2:
        return jsonify({'error': 'One or both songs not found'}), 404

    # Initialize mashup generator
    generator = MashupGenerator(crossfade_duration=crossfade_duration)

    # Get file paths
    song1_path = os.path.join(app.config['UPLOAD_FOLDER'], song1['audioUrl'].replace('/uploads/', ''))
    song2_path = os.path.join(app.config['UPLOAD_FOLDER'], song2['audioUrl'].replace('/uploads/', ''))

    # Create temporary files for adjusted audio if needed
    temp_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'temp')
    os.makedirs(temp_dir, exist_ok=True)

    modified_song2_path = song2_path

    # Apply pitch shift to song2 if needed
    if pitch_shift != 0:
        temp_shifted_path = os.path.join(temp_dir, f"pitch_shifted_{song2_id}.wav")
        generator.pitch_shift_for_compatibility(song2_path, pitch_shift, temp_shifted_path)
        modified_song2_path = temp_shifted_path

    # Apply tempo adjustment to song2 if needed
    if tempo_adjustment != 0:
        tempo_ratio = 1 + (tempo_adjustment / 100)
        temp_tempo_path = os.path.join(temp_dir, f"tempo_adjusted_{song2_id}.wav")
        generator.tempo_adjust_for_compatibility(modified_song2_path, tempo_ratio, temp_tempo_path)
        modified_song2_path = temp_tempo_path

    # Create mashup filename
    mashup_id = str(uuid.uuid4())
    mashup_filename = f"mashup_{mashup_id}.wav"
    mashup_path = os.path.join(MASHUPS_FOLDER, mashup_filename)

    # Create mashup
    try:
        mashup_result = generator.create_mashup(song1_path, modified_song2_path, mashup_path)

        # Create visualization
        viz_path = os.path.join(VISUALIZATIONS_FOLDER, f'mashup_{mashup_id}.png')
        generator.visualize_mashup(song1_path, modified_song2_path, save_path=viz_path)

        # Save mashup to database
        mashup_data = {
            'id': mashup_id,
            'title': f"Mashup of {song1['title']} and {song2['title']}",
            'song1_id': song1_id,
            'song2_id': song2_id,
            'audioUrl': f"/uploads/mashups/{mashup_filename}",
            'visualization_url': f"/uploads/visualizations/{os.path.basename(viz_path)}",
            'duration': mashup_result['duration'],
            'created_at': datetime.now().isoformat(),
            'settings': {
                'pitch_shift': pitch_shift,
                'tempo_adjustment': tempo_adjustment,
                'crossfade_duration': crossfade_duration
            }
        }

        db.insert_one('mashups', mashup_data)

        # Clean up temporary files
        if os.path.exists(temp_dir):
            for temp_file in os.listdir(temp_dir):
                if temp_file.startswith(f"pitch_shifted_{song2_id}") or temp_file.startswith(f"tempo_adjusted_{song2_id}"):
                    try:
                        os.remove(os.path.join(temp_dir, temp_file))
                    except:
                        pass

        return jsonify({
            'message': 'Mashup created successfully',
            'mashup': mashup_data
        }), 200
    except Exception as e:
        print(f"Error creating mashup: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Error creating mashup: {str(e)}'}), 500

# Graph Routes
@app.route('/api/graph/music-map', methods=['GET'])
def get_music_map():
    """Generate a music similarity graph"""
    songs = db.find('songs', {})
    if len(songs) < 2:  # Changed from 5 to 2 to work with fewer songs
        return jsonify({'error': 'Not enough songs to create a music map'}), 400

    # Convert to DataFrame
    songs_df = pd.DataFrame(songs)

    # Use a lower similarity threshold to ensure connections are created
    # Default was 0.7 which is too strict for small libraries
    similarity_threshold = float(request.args.get('threshold', 0.3))

    # Initialize music graph with feature columns explicitly defined
    feature_columns = ['tempo', 'energy']  # Use only numeric features
    graph = MusicGraph(songs_df, similarity_threshold=similarity_threshold, feature_columns=feature_columns)

    # Build graph
    graph.build_graph()

    # Check if graph has any edges
    if graph.graph.number_of_edges() == 0:
        print("Warning: Graph has no edges. Lowering threshold to create connections.")
        # Try again with an even lower threshold
        graph = MusicGraph(songs_df, similarity_threshold=0.1, feature_columns=feature_columns)
        graph.build_graph()

    # Generate visualization
    viz_path = os.path.join(VISUALIZATIONS_FOLDER, f'music_graph_{datetime.now().strftime("%Y%m%d%H%M%S")}.png')
    graph.visualize_graph(save_path=viz_path)

    # Get graph stats
    stats = graph.get_graph_stats()

    return jsonify({
        'music_map_url': f'/uploads/visualizations/{os.path.basename(viz_path)}',
        'stats': stats
    }), 200


@app.route('/api/graph/path', methods=['GET'])
def find_song_path():
    """Find a path between two songs in the music graph"""
    source_id = request.args.get('source')
    target_id = request.args.get('target')
    path_type = request.args.get('type', 'shortest')  # 'shortest', 'diverse', or 'smooth'
    min_length = int(request.args.get('min_length', 2))  # Default to 2 if not provided

    if not source_id or not target_id:
        return jsonify({'error': 'Source and target song IDs are required'}), 400

    # Find songs in database
    songs = db.find('songs', {})
    source_song = next((s for s in songs if s['id'] == source_id), None)
    target_song = next((s for s in songs if s['id'] == target_id), None)

    if not source_song or not target_song:
        return jsonify({'error': 'One or both songs not found'}), 404

    # Convert to DataFrame
    songs_df = pd.DataFrame(songs)

    # Initialize music graph with lower threshold to ensure connections
    graph = MusicGraph(songs_df, similarity_threshold=0.1)
    path_finder = MusicPathFinder(graph)

    # Find path based on type
    try:
        if path_type == 'diverse':
            path = path_finder.find_most_diverse_path(source_id, target_id, min_length=min_length)
        elif path_type == 'smooth':
            path = path_finder.find_smooth_transition_path(source_id, target_id, min_length=min_length)
        else:  # default to shortest
            path = path_finder.find_path_with_min_length(source_id, target_id, min_length=min_length)

        if not path:
            return jsonify({
                'error': f'No path found between songs with minimum length of {min_length}',
                'source': {
                    'id': source_id,
                    'title': source_song['title'],
                    'artist': source_song['artist']
                },
                'target': {
                    'id': target_id,
                    'title': target_song['title'],
                    'artist': target_song['artist']
                }
            }), 404

        # Generate visualization
        viz_path = os.path.join(VISUALIZATIONS_FOLDER,
                                f'path_{source_id}_to_{target_id}_{path_type}_{datetime.now().strftime("%Y%m%d%H%M%S")}.png')

        # Extract IDs from path for visualization
        path_ids = [p['id'] for p in path] if path else []
        graph.visualize_graph(save_path=viz_path, highlight_path=path_ids)

        # Verify the visualization was created
        if not os.path.exists(viz_path):
            print(f"Warning: Visualization not created at {viz_path}")
            viz_url = None
        else:
            viz_url = f'/uploads/visualizations/{os.path.basename(viz_path)}'


        return jsonify({
            'source': {
                'id': source_id,
                'title': source_song['title'],
                'artist': source_song['artist']
            },
            'target': {
                'id': target_id,
                'title': target_song['title'],
                'artist': target_song['artist']
            },
            'path_type': path_type,
            'path': path,
            'path_visualization': viz_url  # Use the corrected viz_url
        }), 200
    except Exception as e:
        print(f"Error finding path: {e}")
        return jsonify({'error': f'Error finding path: {str(e)}'}), 500

@app.route('/api/graph/journey', methods=['GET'])
def generate_musical_journey():
    """Generate a musical journey starting from a seed song"""
    seed_song_id = request.args.get('seed')
    length = int(request.args.get('length', 5))
    diversity_weight = float(request.args.get('diversity', 0.5))
    similarity_threshold = float(request.args.get('threshold', 0.3))  # Add threshold parameter

    if not seed_song_id:
        return jsonify({'error': 'Seed song ID is required'}), 400

    # Find seed song in database
    songs = db.find('songs', {})
    seed_song = next((s for s in songs if s['id'] == seed_song_id), None)

    if not seed_song:
        return jsonify({'error': 'Seed song not found'}), 404

    # Convert to DataFrame
    songs_df = pd.DataFrame(songs)

    # Use only numeric features for the graph
    feature_columns = ['tempo', 'energy']

    # Initialize music graph with lower threshold
    graph = MusicGraph(songs_df, similarity_threshold=similarity_threshold, feature_columns=feature_columns)
    path_finder = MusicPathFinder(graph)

    # Generate journey
    try:
        journey = path_finder.generate_musical_journey(
            seed_song_id,
            length=length,
            diversity_weight=diversity_weight
        )

        # If journey is empty or has only one song, try with an even lower threshold
        if len(journey) <= 1:
            graph = MusicGraph(songs_df, similarity_threshold=0.1, feature_columns=feature_columns)
            path_finder = MusicPathFinder(graph)
            journey = path_finder.generate_musical_journey(
                seed_song_id,
                length=length,
                diversity_weight=diversity_weight
            )

        return jsonify({
            'seed_song': {
                'id': seed_song_id,
                'title': seed_song['title'],
                'artist': seed_song['artist']
            },
            'journey': journey
        }), 200
    except Exception as e:
        print(f"Error generating journey: {e}")
        return jsonify({'error': f'Error generating journey: {str(e)}'}), 500

# Lyric Analysis Routes

@app.route('/api/lyrics/fetch', methods=['GET'])
def fetch_lyrics():
    """Fetch lyrics for a song"""
    artist = request.args.get('artist')
    title = request.args.get('title')

    if not artist or not title:
        return jsonify({'error': 'Artist and title are required'}), 400

    # Initialize lyric fetcher
    lyric_fetcher = LyricFetcher()

    # Fetch lyrics
    try:
        lyrics = lyric_fetcher.fetch_lyrics(artist, title)

        return jsonify({
            'artist': artist,
            'title': title,
            'lyrics': lyrics
        }), 200
    except Exception as e:
        return jsonify({'error': f'Error fetching lyrics: {str(e)}'}), 500

@app.route('/api/lyrics/analyze', methods=['POST'])
def analyze_lyrics():
    """Analyze lyrics for sentiment and emotions"""
    data = request.json

    lyrics = data.get('lyrics')

    if not lyrics:
        return jsonify({'error': 'Lyrics are required'}), 400

    # Initialize lyric analyzer
    analyzer = LyricAnalyzer()

    # Analyze lyrics
    try:
        analysis = analyzer.full_analysis(lyrics)

        # Generate visualizations
        sentiment_viz_path = os.path.join(VISUALIZATIONS_FOLDER, f'sentiment_{datetime.now().strftime("%Y%m%d%H%M%S")}.png')
        analyzer.visualize_sentiment(analysis['sentiment'], save_path=sentiment_viz_path)

        emotions_viz_path = os.path.join(VISUALIZATIONS_FOLDER, f'emotions_{datetime.now().strftime("%Y%m%d%H%M%S")}.png')
        analyzer.visualize_emotions(analysis['emotions'], save_path=emotions_viz_path)

        return jsonify({
            'analysis': analysis,
            'visualizations': {
                'sentiment': f'/uploads/visualizations/{os.path.basename(sentiment_viz_path)}',
                'emotions': f'/uploads/visualizations/{os.path.basename(emotions_viz_path)}'
            }
        }), 200
    except Exception as e:
        return jsonify({'error': f'Error analyzing lyrics: {str(e)}'}), 500

# Beat Matching Routes

@app.route('/api/beats/analyze', methods=['POST'])
def analyze_beats():
    """Analyze beats in a song"""
    data = request.json

    song_id = data.get('song_id')

    if not song_id:
        return jsonify({'error': 'Song ID is required'}), 400

    # Find song in database
    song = db.find_one('songs', {'id': song_id})

    if not song:
        return jsonify({'error': 'Song not found'}), 404

    # Initialize beat matcher
    beat_matcher = BeatMatcher()

    # Get file path
    song_path = os.path.join(app.config['UPLOAD_FOLDER'], song['audioUrl'].replace('/uploads/', ''))

    # Analyze beats
    try:
        _, sr, beat_frames, beat_times, tempo = beat_matcher.extract_beats(song_path)

        return jsonify({
            'song_id': song_id,
            'tempo': float(tempo),
            'beat_times': beat_times.tolist(),
            'num_beats': len(beat_times)
        }), 200
    except Exception as e:
        return jsonify({'error': f'Error analyzing beats: {str(e)}'}), 500

@app.route('/api/beats/transition', methods=['POST'])
def create_beat_transition():
    """Create a beat-matched transition between two songs"""
    data = request.json

    song1_id = data.get('song1_id')
    song2_id = data.get('song2_id')
    transition_duration = data.get('transition_duration', 10)

    if not song1_id or not song2_id:
        return jsonify({'error': 'Both song IDs are required'}), 400

    # Find songs in database
    song1 = db.find_one('songs', {'id': song1_id})
    song2 = db.find_one('songs', {'id': song2_id})

    if not song1 or not song2:
        return jsonify({'error': 'One or both songs not found'}), 404

    # Initialize beat matcher
    beat_matcher = BeatMatcher()

    # Get file paths
    song1_path = os.path.join(app.config['UPLOAD_FOLDER'], song1['audioUrl'].replace('/uploads/', ''))
    song2_path = os.path.join(app.config['UPLOAD_FOLDER'], song2['audioUrl'].replace('/uploads/', ''))

    # Create transition filename
    transition_id = str(uuid.uuid4())
    transition_filename = f"transition_{transition_id}.wav"
    transition_path = os.path.join(MASHUPS_FOLDER, transition_filename)

    # Create transition
    try:
        transition_result = beat_matcher.create_transition(
            song1_path,
            song2_path,
            transition_path,
            transition_duration=transition_duration
        )

        # Create visualization
        viz_path = os.path.join(VISUALIZATIONS_FOLDER, f'transition_{transition_id}.png')
        beat_matcher.visualize_beat_alignment(song1_path, song2_path, save_path=viz_path)

        # Save transition to database
        transition_data = {
            'id': transition_id,
            'title': f"Transition from {song1['title']} to {song2['title']}",
            'song1_id': song1_id,
            'song2_id': song2_id,
            'audioUrl': f"/uploads/mashups/{transition_filename}",
            'visualization_url': f"/uploads/visualizations/{os.path.basename(viz_path)}",
            'duration': transition_result['duration'],
            'created_at': datetime.now().isoformat()
        }

        db.insert_one('transitions', transition_data)

        return jsonify({
            'message': 'Transition created successfully',
            'transition': transition_data
        }), 200
    except Exception as e:
        return jsonify({'error': f'Error creating transition: {str(e)}'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """API health check"""
    return jsonify({
        'status': 'ok',
        'message': 'TuneSift API is running',
        'timestamp': datetime.now().isoformat()
    }), 200

@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response



# Error handlers

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Not found'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Server error'}), 500

@app.errorhandler(413)
def too_large(error):
    return jsonify({'error': 'File too large'}), 413

if __name__ == '__main__':
    print("Starting TuneSift backend on http://localhost:5001")
    app.run(host='0.0.0.0', port=5001, debug=True)

