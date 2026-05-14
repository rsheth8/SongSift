# models/user.py
import hashlib
import os
import json
from datetime import datetime

class User:
    """
    Represents a user in the TuneSift application.
    """

    def __init__(self, id, username, email=None, password_hash=None):
        """
        Initialize a User object.

        Parameters:
        -----------
        id : str
            Unique identifier for the user
        username : str
            Username of the user
        email : str, optional
            Email of the user
        password_hash : str, optional
            Hashed password of the user
        """
        self.id = id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.created_at = datetime.now().isoformat()
        self.preferences = {}
        self.ratings = {}

    def to_dict(self):
        """
        Convert the User object to a dictionary.

        Returns:
        --------
        dict
            Dictionary representation of the User
        """
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'password_hash': self.password_hash,
            'created_at': self.created_at,
            'preferences': self.preferences,
            'ratings': self.ratings
        }

    @classmethod
    def from_dict(cls, data):
        """
        Create a User object from a dictionary.

        Parameters:
        -----------
        data : dict
            Dictionary containing user data

        Returns:
        --------
        User
            User object created from the dictionary
        """
        user = cls(
            id=data.get('id'),
            username=data.get('username'),
            email=data.get('email'),
            password_hash=data.get('password_hash')
        )
        user.created_at = data.get('created_at', user.created_at)
        user.preferences = data.get('preferences', {})
        user.ratings = data.get('ratings', {})
        return user

    def set_password(self, password):
        """
        Set the password for the user.

        Parameters:
        -----------
        password : str
            Plain text password

        Returns:
        --------
        User
            Updated User object
        """
        # Simple password hashing (use a proper library like bcrypt in production)
        self.password_hash = hashlib.sha256(password.encode()).hexdigest()
        return self

    def check_password(self, password):
        """
        Check if the provided password matches the stored hash.

        Parameters:
        -----------
        password : str
            Plain text password to check

        Returns:
        --------
        bool
            True if the password matches, False otherwise
        """
        return self.password_hash == hashlib.sha256(password.encode()).hexdigest()

    def rate_song(self, song_id, rating):
        """
        Rate a song.

        Parameters:
        -----------
        song_id : str
            ID of the song to rate
        rating : float
            Rating value (0-5)

        Returns:
        --------
        User
            Updated User object
        """
        self.ratings[song_id] = float(rating)
        return self

    def get_rating(self, song_id):
        """
        Get the rating for a song.

        Parameters:
        -----------
        song_id : str
            ID of the song

        Returns:
        --------
        float or None
            Rating value or None if not rated
        """
        return self.ratings.get(song_id)

    def update_preferences(self, preferences):
        """
        Update user preferences.

        Parameters:
        -----------
        preferences : dict
            New preferences

        Returns:
        --------
        User
            Updated User object
        """
        self.preferences.update(preferences)
        return self
