# utils/file_handlers.py
import os
import hashlib
import shutil
from werkzeug.utils import secure_filename
import eyed3
import uuid
import mimetypes

def create_song_folder(upload_folder, title, artist):
    """
    Create a folder for a song.

    Parameters:
    -----------
    upload_folder : str
        Base upload folder
    title : str
        Title of the song
    artist : str
        Artist of the song

    Returns:
    --------
    str
        Path to the created folder
    """
    folder_name = secure_filename(f"{title}_{artist}")
    folder_path = os.path.join(upload_folder, folder_name)
    os.makedirs(folder_path, exist_ok=True)
    return folder_path

def extract_album_cover(file_path, song_folder):
    """
    Extract album cover from an audio file.

    Parameters:
    -----------
    file_path : str
        Path to the audio file
    song_folder : str
        Folder to save the album cover

    Returns:
    --------
    str or None
        Path to the extracted album cover, or None if not found
    """
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

def extract_song_metadata(file_path):
    """
    Extract metadata from an audio file.

    Parameters:
    -----------
    file_path : str
        Path to the audio file

    Returns:
    --------
    dict
        Dictionary containing metadata
    """
    metadata = {
        'title': os.path.splitext(os.path.basename(file_path))[0],
        'artist': 'Unknown Artist',
        'album': 'Unknown Album'
    }

    try:
        audio_file = eyed3.load(file_path)
        if audio_file.tag:
            if audio_file.tag.title:
                metadata['title'] = audio_file.tag.title
            if audio_file.tag.artist:
                metadata['artist'] = audio_file.tag.artist
            if audio_file.tag.album:
                metadata['album'] = audio_file.tag.album
    except Exception as e:
        print(f"Error extracting metadata: {e}")

    return metadata

def generate_unique_filename(filename):
    """
    Generate a unique filename.

    Parameters:
    -----------
    filename : str
        Original filename

    Returns:
    --------
    str
        Unique filename
    """
    name, ext = os.path.splitext(filename)
    return f"{name}_{uuid.uuid4().hex[:8]}{ext}"

def is_audio_file(filename):
    """
    Check if a file is an audio file.

    Parameters:
    -----------
    filename : str
        Filename to check

    Returns:
    --------
    bool
        True if the file is an audio file, False otherwise
    """
    allowed_extensions = {'.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'}
    return os.path.splitext(filename)[1].lower() in allowed_extensions

def get_file_size_mb(file_path):
    """
    Get the size of a file in megabytes.

    Parameters:
    -----------
    file_path : str
        Path to the file

    Returns:
    --------
    float
        Size of the file in megabytes
    """
    return os.path.getsize(file_path) / (1024 * 1024)

def get_file_checksum(file_path):
    """
    Calculate the MD5 checksum of a file.

    Parameters:
    -----------
    file_path : str
        Path to the file

    Returns:
    --------
    str
        MD5 checksum of the file
    """
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def get_mime_type(file_path):
    """
    Get the MIME type of a file.

    Parameters:
    -----------
    file_path : str
        Path to the file

    Returns:
    --------
    str
        MIME type of the file
    """
    return mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
