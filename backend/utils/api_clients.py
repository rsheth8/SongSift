# utils/api_clients.py
import requests
import json
import os
import time
from urllib.parse import urlencode

class SpotifyClient:
    """
    Client for the Spotify Web API.
    """

    def __init__(self, client_id, client_secret):
        """
        Initialize the Spotify client.

        Parameters:
        -----------
        client_id : str
            Spotify API client ID
        client_secret : str
            Spotify API client secret
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.token = None
        self.token_expiry = 0

    def _get_token(self):
        """Get an access token from the Spotify API"""
        if self.token and time.time() < self.token_expiry:
            return self.token

        url = 'https://accounts.spotify.com/api/token'
        payload = {
            'grant_type': 'client_credentials'
        }
        response = requests.post(
            url,
            auth=(self.client_id, self.client_secret),
            data=payload
        )

        if response.status_code == 200:
            data = response.json()
            self.token = data['access_token']
            self.token_expiry = time.time() + data['expires_in'] - 60  # Buffer of 60 seconds
            return self.token
        else:
            raise Exception(f"Failed to get Spotify token: {response.text}")

    def search_track(self, query, limit=10):
        """
        Search for tracks on Spotify.

        Parameters:
        -----------
        query : str
            Search query
        limit : int, optional
            Maximum number of results

        Returns:
        --------
        list
            List of track objects
        """
        token = self._get_token()
        url = 'https://api.spotify.com/v1/search'
        params = {
            'q': query,
            'type': 'track',
            'limit': limit
        }
        headers = {
            'Authorization': f'Bearer {token}'
        }

        response = requests.get(url, headers=headers, params=params)

        if response.status_code == 200:
            data = response.json()
            return data['tracks']['items']
        else:
            raise Exception(f"Failed to search tracks: {response.text}")

    def get_track_features(self, track_id):
        """
        Get audio features for a track.

        Parameters:
        -----------
        track_id : str
            Spotify track ID

        Returns:
        --------
        dict
            Audio features
        """
        token = self._get_token()
        url = f'https://api.spotify.com/v1/audio-features/{track_id}'
        headers = {
            'Authorization': f'Bearer {token}'
        }

        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get track features: {response.text}")

    def get_track(self, track_id):
        """
        Get track details.

        Parameters:
        -----------
        track_id : str
            Spotify track ID

        Returns:
        --------
        dict
            Track details
        """
        token = self._get_token()
        url = f'https://api.spotify.com/v1/tracks/{track_id}'
        headers = {
            'Authorization': f'Bearer {token}'
        }

        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Failed to get track: {response.text}")


class GeniusClient:
    """
    Client for the Genius API.
    """

    def __init__(self, access_token):
        """
        Initialize the Genius client.

        Parameters:
        -----------
        access_token : str
            Genius API access token
        """
        self.access_token = access_token
        self.base_url = 'https://api.genius.com'

    def search(self, query):
        """
        Search for songs on Genius.

        Parameters:
        -----------
        query : str
            Search query

        Returns:
        --------
        list
            List of search results
        """
        url = f"{self.base_url}/search"
        headers = {
            'Authorization': f'Bearer {self.access_token}'
        }
        params = {
            'q': query
        }

        response = requests.get(url, headers=headers, params=params)

        if response.status_code == 200:
            return response.json()['response']['hits']
        else:
            raise Exception(f"Failed to search Genius: {response.text}")

    def get_song(self, song_id):
        """
        Get song details.

        Parameters:
        -----------
        song_id : int
            Genius song ID

        Returns:
        --------
        dict
            Song details
        """
        url = f"{self.base_url}/songs/{song_id}"
        headers = {
            'Authorization': f'Bearer {self.access_token}'
        }

        response = requests.get(url, headers=headers)

        if response.status_code == 200:
            return response.json()['response']['song']
        else:
            raise Exception(f"Failed to get song: {response.text}")

    def get_lyrics_url(self, song_id):
        """
        Get the URL to the lyrics page.

        Parameters:
        -----------
        song_id : int
            Genius song ID

        Returns:
        --------
        str
            URL to the lyrics page
        """
        song = self.get_song(song_id)
        return song['url']
