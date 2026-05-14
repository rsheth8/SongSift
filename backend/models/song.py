# models/song.py
import os
import json
from datetime import datetime

class Song:
    """
    Represents a song in the TuneSift application.
    """

    def __init__(self, id, title, artist, album=None, filepath=None, features=None, album_cover=None, audio_url=None):
        """
        Initialize a Song object.

        Parameters:
        -----------
        id : str
            Unique identifier for the song
        title : str
            Title of the song
        artist : str
            Artist of the song
        album : str, optional
            Album the song belongs to
        filepath : str, optional
            Path to the audio file
        features : dict, optional
            Audio features of the song
        album_cover : str, optional
            Path to the album cover image
        audio_url : str, optional
            URL to the audio file
        """
        self.id = id
        self.title = title
        self.artist = artist
        self.album = album
        self.filepath = filepath
        self.features = features or {}
        self.album_cover = album_cover
        self.audio_url = audio_url
        self.created_at = datetime.now().isoformat()

    def to_dict(self):
        """
        Convert the Song object to a dictionary.

        Returns:
        --------
        dict
            Dictionary representation of the Song
        """
        return {
            'id': self.id,
            'title': self.title,
            'artist': self.artist,
            'album': self.album,
            'filepath': self.filepath,
            'features': self.features,
            'albumCover': self.album_cover,
            'audioUrl': self.audio_url,
            'created_at': self.created_at
        }

    @classmethod
    def from_dict(cls, data):
        """
        Create a Song object from a dictionary.

        Parameters:
        -----------
        data : dict
            Dictionary containing song data

        Returns:
        --------
        Song
            Song object created from the dictionary
        """
        return cls(
            id=data.get('id'),
            title=data.get('title'),
            artist=data.get('artist'),
            album=data.get('album'),
            filepath=data.get('filepath'),
            features=data.get('features', {}),
            album_cover=data.get('albumCover'),
            audio_url=data.get('audioUrl')
        )

    def update_features(self, features):
        """
        Update the audio features of the song.

        Parameters:
        -----------
        features : dict
            New audio features

        Returns:
        --------
        Song
            Updated Song object
        """
        self.features.update(features)
        return self

    def get_feature(self, feature_name, default=None):
        """
        Get a specific audio feature.

        Parameters:
        -----------
        feature_name : str
            Name of the feature to get
        default : any, optional
            Default value to return if feature is not found

        Returns:
        --------
        any
            Value of the feature or default
        """
        if '.' in feature_name:
            # Handle nested features
            parts = feature_name.split('.')
            current = self.features
            for part in parts:
                if isinstance(current, dict) and part in current:
                    current = current[part]
                else:
                    return default
            return current

        return self.features.get(feature_name, default)
