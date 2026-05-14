# recommendation/content_based.py
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler

class ContentBasedRecommender:
    """
    Content-based recommendation system that suggests songs similar to a given song
    based on audio features like tempo, key, energy, etc.
    """

    def __init__(self, songs_df, feature_columns=None):
        """
        Initialize the content-based recommender.

        Parameters:
        -----------
        songs_df : pandas.DataFrame
            DataFrame containing songs and their features
        feature_columns : list, optional
            List of feature columns to use for similarity calculation.
            If None, will use all available audio features.
        """
        self.songs_df = songs_df

        # Extract features from nested dictionaries if needed
        if 'features' in songs_df.columns and isinstance(songs_df['features'].iloc[0], dict):
            # Extract features from the nested dictionary
            features_df = pd.json_normalize(songs_df['features'])
            self.songs_df = pd.concat([songs_df.drop('features', axis=1), features_df], axis=1)

        # Default feature columns if not specified
        if feature_columns is None:
            self.feature_columns = [col for col in self.songs_df.columns
                                    if col.startswith('features.') or
                                    col in ['tempo', 'energy', 'key', 'danceability',
                                            'acousticness', 'instrumentalness', 'valence']]
        else:
            self.feature_columns = feature_columns

        # Ensure we have at least some features to work with
        if not self.feature_columns:
            raise ValueError("No feature columns available for content-based filtering")

        self.similarity_matrix = None

    def _preprocess_features(self):
        """Preprocess and normalize audio features"""
        # Extract features
        features = self.songs_df[self.feature_columns].copy()

        # Handle missing values
        features.fillna(features.mean(), inplace=True)

        # Normalize features
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)

        return features_scaled

    def compute_similarity(self):
        """Compute similarity matrix between all songs"""
        features_scaled = self._preprocess_features()

        # Calculate cosine similarity
        self.similarity_matrix = cosine_similarity(features_scaled)

        return self.similarity_matrix

    def recommend_similar_songs(self, song_id, n=5):
        """
        Recommend n songs similar to the given song_id.

        Parameters:
        -----------
        song_id : str or int
            ID of the song to find similar songs for
        n : int, optional
            Number of recommendations to return

        Returns:
        --------
        list
            List of dictionaries containing similar song details
        """
        if self.similarity_matrix is None:
            self.compute_similarity()

        # Find the song in the DataFrame
        song_idx = self.songs_df[self.songs_df['id'] == song_id].index

        if len(song_idx) == 0:
            raise ValueError(f"Song with ID {song_id} not found in the database")

        song_idx = song_idx[0]

        # Get similarity scores for all songs with the target song
        similarity_scores = list(enumerate(self.similarity_matrix[song_idx]))

        # Sort based on similarity scores (descending)
        similarity_scores = sorted(similarity_scores, key=lambda x: x[1], reverse=True)

        # Get top n+1 similar songs (first one is the song itself)
        top_similar = similarity_scores[1:n+1]

        # Return song details
        similar_songs = []
        for i, score in top_similar:
            song = self.songs_df.iloc[i]
            similar_song = {
                'id': song['id'],
                'title': song['title'],
                'artist': song['artist'],
                'similarity_score': float(score)
            }

            # Add album cover if available
            if 'albumCover' in song:
                similar_song['albumCover'] = song['albumCover']

            # Add audio URL if available
            if 'audioUrl' in song:
                similar_song['audioUrl'] = song['audioUrl']

            similar_songs.append(similar_song)

        return similar_songs

    def get_similar_by_features(self, features_dict, n=5):
        """
        Recommend songs similar to a set of features.
        Useful for finding songs with specific audio characteristics.

        Parameters:
        -----------
        features_dict : dict
            Dictionary of feature values to match
        n : int, optional
            Number of recommendations to return

        Returns:
        --------
        list
            List of dictionaries containing similar song details
        """
        # Preprocess features
        features_scaled = self._preprocess_features()

        # Create a feature vector from the input dictionary
        feature_vector = np.zeros((1, len(self.feature_columns)))

        for i, feature in enumerate(self.feature_columns):
            feature_name = feature.split('.')[-1] if '.' in feature else feature
            if feature_name in features_dict:
                feature_vector[0, i] = features_dict[feature_name]
            else:
                # Use mean value for missing features
                feature_vector[0, i] = self.songs_df[feature].mean()

        # Normalize the feature vector
        scaler = StandardScaler()
        scaler.fit(self.songs_df[self.feature_columns])
        feature_vector_scaled = scaler.transform(feature_vector)

        # Calculate similarity with all songs
        similarities = cosine_similarity(feature_vector_scaled, features_scaled)[0]

        # Get top n similar songs
        top_indices = np.argsort(similarities)[::-1][:n]

        # Return song details
        similar_songs = []
        for idx in top_indices:
            song = self.songs_df.iloc[idx]
            similar_song = {
                'id': song['id'],
                'title': song['title'],
                'artist': song['artist'],
                'similarity_score': float(similarities[idx])
            }

            # Add album cover if available
            if 'albumCover' in song:
                similar_song['albumCover'] = song['albumCover']

            # Add audio URL if available
            if 'audioUrl' in song:
                similar_song['audioUrl'] = song['audioUrl']

            similar_songs.append(similar_song)

        return similar_songs
