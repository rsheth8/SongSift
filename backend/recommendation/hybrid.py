# recommendation/hybrid.py
import numpy as np
import pandas as pd
from .content_based import ContentBasedRecommender
from .collaborative import CollaborativeRecommender

class HybridRecommender:
    """
    Hybrid recommendation system that combines content-based and collaborative
    filtering approaches for more robust recommendations.
    """

    def __init__(self, songs_df, ratings_df, content_weight=0.5, collab_weight=0.5):
        """
        Initialize the hybrid recommender.

        Parameters:
        -----------
        songs_df : pandas.DataFrame
            DataFrame containing songs and their features
        ratings_df : pandas.DataFrame
            DataFrame containing user ratings with columns: user_id, song_id, rating
        content_weight : float, optional
            Weight for content-based recommendations (0-1)
        collab_weight : float, optional
            Weight for collaborative recommendations (0-1)
        """
        self.songs_df = songs_df
        self.ratings_df = ratings_df

        # Normalize weights
        total_weight = content_weight + collab_weight
        self.content_weight = content_weight / total_weight
        self.collab_weight = collab_weight / total_weight

        # Initialize recommenders
        self.content_recommender = ContentBasedRecommender(songs_df)
        self.collab_recommender = CollaborativeRecommender(ratings_df)

    def recommend_for_user(self, user_id, song_id=None, n=5):
        """
        Recommend songs for a user using both content-based and collaborative filtering.

        Parameters:
        -----------
        user_id : str or int
            ID of the user to recommend songs for
        song_id : str or int, optional
            ID of a song to use as a seed for content-based recommendations
        n : int, optional
            Number of recommendations to return

        Returns:
        --------
        list
            List of dictionaries containing recommended song details
        """
        # Get collaborative filtering recommendations
        try:
            collab_recs = self.collab_recommender.recommend_songs(user_id, n=n*2)
            collab_songs = {rec['song_id']: rec['predicted_rating'] for rec in collab_recs}
        except (ValueError, KeyError) as e:
            print(f"Collaborative filtering error: {e}")
            collab_songs = {}

        # Get content-based recommendations
        content_songs = {}
        if song_id:
            try:
                content_recs = self.content_recommender.recommend_similar_songs(song_id, n=n*2)
                content_songs = {rec['id']: rec['similarity_score'] for rec in content_recs}
            except (ValueError, KeyError) as e:
                print(f"Content-based filtering error: {e}")
        else:
            # If no seed song, use the user's highest rated songs
            user_ratings = self.ratings_df[self.ratings_df['user_id'] == user_id]
            if not user_ratings.empty:
                top_rated = user_ratings.sort_values('rating', ascending=False).head(3)
                for _, row in top_rated.iterrows():
                    try:
                        content_recs = self.content_recommender.recommend_similar_songs(row['song_id'], n=n)
                        for rec in content_recs:
                            content_songs[rec['id']] = content_songs.get(rec['id'], 0) + rec['similarity_score']
                    except (ValueError, KeyError) as e:
                        print(f"Content-based filtering error: {e}")

        # Combine recommendations with weighted scores
        combined_scores = {}

        # Add collaborative scores
        for song_id, score in collab_songs.items():
            combined_scores[song_id] = self.collab_weight * score

        # Add content-based scores
        for song_id, score in content_songs.items():
            if song_id in combined_scores:
                combined_scores[song_id] += self.content_weight * score
            else:
                combined_scores[song_id] = self.content_weight * score

        # Sort by combined score
        sorted_songs = sorted(combined_scores.items(), key=lambda x: x[1], reverse=True)

        # Get top n recommendations
        top_songs = sorted_songs[:n]

        # Get song details
        recommendations = []
        for song_id, score in top_songs:
            song = self.songs_df[self.songs_df['id'] == song_id]
            if not song.empty:
                song = song.iloc[0]
                recommendation = {
                    'id': song_id,
                    'title': song['title'],
                    'artist': song['artist'],
                    'score': float(score)
                }

                # Add album cover if available
                if 'albumCover' in song:
                    recommendation['albumCover'] = song['albumCover']

                # Add audio URL if available
                if 'audioUrl' in song:
                    recommendation['audioUrl'] = song['audioUrl']

                recommendations.append(recommendation)

        return recommendations

    def recommend_for_mood(self, mood, n=5):
        """
        Recommend songs for a specific mood using feature-based filtering.

        Parameters:
        -----------
        mood : str
            Mood to recommend songs for (e.g., 'happy', 'sad', 'energetic', 'chill')
        n : int, optional
            Number of recommendations to return

        Returns:
        --------
        list
            List of dictionaries containing recommended song details
        """
        # Define feature profiles for different moods
        mood_profiles = {
            'happy': {'valence': 0.8, 'energy': 0.7, 'tempo': 120},
            'sad': {'valence': 0.2, 'energy': 0.3, 'tempo': 80},
            'energetic': {'energy': 0.9, 'tempo': 140, 'danceability': 0.8},
            'chill': {'energy': 0.3, 'acousticness': 0.7, 'tempo': 90},
            'focus': {'instrumentalness': 0.7, 'energy': 0.4, 'valence': 0.5}
        }

        # Get the feature profile for the requested mood
        if mood.lower() not in mood_profiles:
            raise ValueError(f"Unknown mood: {mood}. Available moods: {list(mood_profiles.keys())}")

        features = mood_profiles[mood.lower()]

        # Get recommendations based on features
        recommendations = self.content_recommender.get_similar_by_features(features, n=n)

        return recommendations
