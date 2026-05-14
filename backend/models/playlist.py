# models/playlist.py
import os
import json
from datetime import datetime

class Playlist:
    """
    Represents a playlist in the TuneSift application.
    """

    def __init__(self, id, name, user_id=None, songs=None, is_auto_generated=False):
        """
        Initialize a Playlist object.

        Parameters:
        -----------
        id : str
            Unique identifier for the playlist
        name : str
            Name of the playlist
        user_id : str, optional
            ID of the user who created the playlist
        songs : list, optional
            List of song IDs in the playlist
        is_auto_generated : bool, optional
            Whether the playlist was automatically generated
        """
        self.id = id
        self.name = name
        self.user_id = user_id
        self.songs = songs or []
        self.is_auto_generated = is_auto_generated
        self.created_at = datetime.now().isoformat()
        self.updated_at = self.created_at

    def to_dict(self):
        """
        Convert the Playlist object to a dictionary.

        Returns:
        --------
        dict
            Dictionary representation of the Playlist
        """
        return {
            'id': self.id,
            'name': self.name,
            'user_id': self.user_id,
            'songs': self.songs,
            'is_auto_generated': self.is_auto_generated,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }

    @classmethod
    def from_dict(cls, data):
        """
        Create a Playlist object from a dictionary.

        Parameters:
        -----------
        data : dict
            Dictionary containing playlist data

        Returns:
        --------
        Playlist
            Playlist object created from the dictionary
        """
        playlist = cls(
            id=data.get('id'),
            name=data.get('name'),
            user_id=data.get('user_id'),
            songs=data.get('songs', []),
            is_auto_generated=data.get('is_auto_generated', False)
        )
        playlist.created_at = data.get('created_at', playlist.created_at)
        playlist.updated_at = data.get('updated_at', playlist.updated_at)
        return playlist

    def add_song(self, song_id):
        """
        Add a song to the playlist.

        Parameters:
        -----------
        song_id : str
            ID of the song to add

        Returns:
        --------
        Playlist
            Updated Playlist object
        """
        if song_id not in self.songs:
            self.songs.append(song_id)
            self.updated_at = datetime.now().isoformat()
        return self

    def remove_song(self, song_id):
        """
        Remove a song from the playlist.

        Parameters:
        -----------
        song_id : str
            ID of the song to remove

        Returns:
        --------
        Playlist
            Updated Playlist object
        """
        if song_id in self.songs:
            self.songs.remove(song_id)
            self.updated_at = datetime.now().isoformat()
        return self

    def reorder_songs(self, song_ids):
        """
        Reorder the songs in the playlist.

        Parameters:
        -----------
        song_ids : list
            New order of song IDs

        Returns:
        --------
        Playlist
            Updated Playlist object
        """
        # Ensure all songs in the new order are in the playlist
        if set(song_ids) == set(self.songs):
            self.songs = song_ids
            self.updated_at = datetime.now().isoformat()
        return self
