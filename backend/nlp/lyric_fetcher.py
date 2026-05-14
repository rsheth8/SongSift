# nlp/lyric_fetcher.py
import requests
import re
import os
import json
from bs4 import BeautifulSoup

class LyricFetcher:
    """
    Fetches lyrics for songs from various online sources.
    """

    def __init__(self, cache_dir='data/lyrics_cache'):
        """
        Initialize the lyric fetcher.

        Parameters:
        -----------
        cache_dir : str, optional
            Directory to cache fetched lyrics
        """
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def _clean_lyrics(self, lyrics):
        """Clean and normalize lyrics text"""
        if not lyrics:
            return ""

        # Remove extra whitespace
        lyrics = re.sub(r'\s+', ' ', lyrics)

        # Remove common annotations like [Chorus], [Verse], etc.
        lyrics = re.sub(r'\[.*?\]', '', lyrics)

        # Remove parentheses content like (x2), (repeat), etc.
        lyrics = re.sub(r'\(.*?\)', '', lyrics)

        # Remove non-alphanumeric characters except punctuation
        lyrics = re.sub(r'[^\w\s\'\",\.?!;:]', '', lyrics)

        return lyrics.strip()

    def _get_cache_path(self, artist, title):
        """Get the cache file path for a song"""
        # Create a safe filename
        safe_name = f"{artist}_{title}".lower()
        safe_name = re.sub(r'[^\w]', '_', safe_name)

        return os.path.join(self.cache_dir, f"{safe_name}.json")

    def _check_cache(self, artist, title):
        """Check if lyrics are cached"""
        cache_path = self._get_cache_path(artist, title)

        if os.path.exists(cache_path):
            try:
                with open(cache_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return data.get('lyrics', None)
            except:
                return None

        return None

    def _save_to_cache(self, artist, title, lyrics):
        """Save lyrics to cache"""
        cache_path = self._get_cache_path(artist, title)

        data = {
            'artist': artist,
            'title': title,
            'lyrics': lyrics
        }

        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def fetch_lyrics_from_genius(self, artist, title):
        """
        Fetch lyrics from Genius.com

        Parameters:
        -----------
        artist : str
            Artist name
        title : str
            Song title

        Returns:
        --------
        str or None
            Lyrics text if found, None otherwise
        """
        # Check cache first
        cached_lyrics = self._check_cache(artist, title)
        if cached_lyrics:
            return cached_lyrics

        # Format the search query
        search_query = f"{artist} {title} lyrics"
        search_query = search_query.replace(' ', '+')

        try:
            # Search on Genius
            search_url = f"https://genius.com/api/search/multi?q={search_query}"
            response = requests.get(search_url, timeout=10)

            if response.status_code != 200:
                return None

            data = response.json()

            # Extract the first hit
            sections = data.get('response', {}).get('sections', [])
            hits = []
            for section in sections:
                if section.get('type') == 'song':
                    hits.extend(section.get('hits', []))

            if not hits:
                return None

            # Get the URL of the first hit
            song_url = hits[0].get('result', {}).get('url')

            if not song_url:
                return None

            # Fetch the lyrics page
            response = requests.get(song_url, timeout=10)

            if response.status_code != 200:
                return None

            # Parse the HTML
            soup = BeautifulSoup(response.text, 'html.parser')

            # Find the lyrics container
            lyrics_container = soup.find('div', class_='lyrics') or soup.find('div', class_='Lyrics__Container-sc-1ynbvzw-6')

            if not lyrics_container:
                return None

            # Extract and clean the lyrics
            lyrics = lyrics_container.get_text()
            lyrics = self._clean_lyrics(lyrics)

            # Save to cache
            self._save_to_cache(artist, title, lyrics)

            return lyrics
        except Exception as e:
            print(f"Error fetching lyrics from Genius: {e}")
            return None

    def fetch_lyrics(self, artist, title):
        """
        Fetch lyrics from available sources.

        Parameters:
        -----------
        artist : str
            Artist name
        title : str
            Song title

        Returns:
        --------
        str or None
            Lyrics text if found, None otherwise
        """
        # Try Genius first
        lyrics = self.fetch_lyrics_from_genius(artist, title)

        # If lyrics are found, return them
        if lyrics:
            return lyrics

        # Otherwise, return a placeholder
        return f"No lyrics found for {title} by {artist}."
