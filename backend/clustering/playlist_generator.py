# clustering/playlist_generator.py

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
import os

class PlaylistGenerator:
    """
    Generates playlists by clustering songs based on audio features using K-means.
    """

    def __init__(self, songs_df, n_clusters=5, feature_columns=None):
        """
        Initialize the playlist generator.

        Parameters:
        -----------
        songs_df : pandas.DataFrame
            DataFrame containing songs and their features
        n_clusters : int, optional
            Number of clusters (playlists) to generate
        feature_columns : list, optional
            List of feature columns to use for clustering.
            If None, will use all available audio features.
        """
        self.songs_df = songs_df.copy()
        self.n_clusters = n_clusters
        self.kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
        self.scaler = StandardScaler()

        # Extract features from nested dictionaries if needed
        if 'features' in songs_df.columns and len(songs_df) > 0:
            first_features = songs_df['features'].iloc[0]
            if isinstance(first_features, dict):
                # Extract features from the nested dictionary
                features_df = pd.json_normalize(songs_df['features'])
                self.songs_df = pd.concat([songs_df.drop('features', axis=1), features_df], axis=1)

        # Default feature columns if not specified
        if feature_columns is None:
            # Look for common audio features
            potential_features = ['tempo', 'energy', 'key', 'danceability',
                                  'acousticness', 'instrumentalness', 'valence']
            self.feature_columns = []

            for feature in potential_features:
                # Check for direct column or nested feature
                if feature in self.songs_df.columns:
                    self.feature_columns.append(feature)
                elif f'features.{feature}' in self.songs_df.columns:
                    self.feature_columns.append(f'features.{feature}')

            # If no standard features found, use any numeric columns
            if not self.feature_columns:
                numeric_cols = self.songs_df.select_dtypes(include=[np.number]).columns
                self.feature_columns = [col for col in numeric_cols
                                        if col not in ['id', 'cluster']]
        else:
            self.feature_columns = feature_columns

        # Ensure we have at least some features to work with
        if not self.feature_columns:
            raise ValueError("No feature columns available for clustering")

        print(f"Using feature columns: {self.feature_columns}")

    def _preprocess_features(self):
        """Preprocess and normalize audio features"""
        # Extract features
        features = self.songs_df[self.feature_columns].copy()

        # Convert to numeric and handle missing values
        for col in self.feature_columns:
            features[col] = pd.to_numeric(features[col], errors='coerce')

        # Handle missing values more robustly
        for col in self.feature_columns:
            if features[col].isna().all():
                # If all values are NaN, fill with defaults based on feature type
                if 'tempo' in col.lower():
                    features[col] = 120.0  # Default tempo
                elif 'energy' in col.lower():
                    features[col] = 0.5    # Default energy
                elif 'key' in col.lower():
                    features[col] = 0      # Default key
                elif 'danceability' in col.lower():
                    features[col] = 0.5    # Default danceability
                elif 'valence' in col.lower():
                    features[col] = 0.5    # Default valence
                else:
                    features[col] = 0      # Default for other features
            else:
                # Fill NaN values with column mean
                col_mean = features[col].mean()
                features[col] = features[col].fillna(col_mean)

        # Final check: ensure no NaN values remain
        if features.isna().any().any():
            print("Warning: NaN values still present after preprocessing. Filling with zeros.")
            features = features.fillna(0)

        # Verify we have valid data
        if features.empty or len(features) == 0:
            raise ValueError("No valid feature data available for clustering")

        # Check if all values are the same (would cause issues with StandardScaler)
        for col in features.columns:
            if features[col].nunique() <= 1:
                # Add small random noise to prevent scaling issues
                features[col] = features[col] + np.random.normal(0, 0.01, len(features))

        print(f"Features after preprocessing:")
        print(f"Shape: {features.shape}")
        print(f"NaN count: {features.isna().sum().sum()}")
        print(f"Feature ranges:")
        for col in features.columns:
            print(f"  {col}: {features[col].min():.3f} to {features[col].max():.3f}")

        # Normalize features
        try:
            features_scaled = self.scaler.fit_transform(features)

            # Final verification that scaled features don't contain NaN
            if np.isnan(features_scaled).any():
                raise ValueError("NaN values found in scaled features")

            print(f"Scaled features shape: {features_scaled.shape}")
            return features_scaled
        except Exception as e:
            print(f"Error during feature scaling: {e}")
            print("Features that caused the error:")
            print(features.describe())
            raise

    def generate_playlists(self):
        """
        Generate playlists by clustering songs based on audio features.

        Returns:
        --------
        dict
            Dictionary where keys are playlist names and values are lists of songs
        """
        try:
            print(f"Starting playlist generation with {len(self.songs_df)} songs")
            print(f"Available feature columns: {self.feature_columns}")

            # Check if we have enough songs for clustering
            if len(self.songs_df) < self.n_clusters:
                raise ValueError(f"Not enough songs ({len(self.songs_df)}) for {self.n_clusters} clusters")

            # Preprocess features
            features_scaled = self._preprocess_features()

            # Additional check for the scaled features
            if features_scaled.shape[0] < self.n_clusters:
                raise ValueError(f"Not enough valid songs after preprocessing for {self.n_clusters} clusters")

            # Fit KMeans
            print(f"Fitting KMeans with {self.n_clusters} clusters...")
            self.kmeans.fit(features_scaled)
            print("KMeans fitting completed successfully")

            # Add cluster labels to the DataFrame
            self.songs_df['cluster'] = self.kmeans.labels_

            # Create playlists
            playlists = {}
            for cluster_id in range(self.n_clusters):
                cluster_songs = self.songs_df[self.songs_df['cluster'] == cluster_id]

                if len(cluster_songs) == 0:
                    print(f"Warning: Cluster {cluster_id} is empty")
                    continue

                playlist_name = self._generate_playlist_name(cluster_songs, cluster_id)
                print(f"Generated playlist '{playlist_name}' with {len(cluster_songs)} songs")

                # Extract song details
                songs = []
                for _, song in cluster_songs.iterrows():
                    song_dict = {
                        'id': song['id'],
                        'title': song['title'],
                        'artist': song['artist']
                    }

                    # Add album cover if available
                    if 'albumCover' in song and pd.notna(song['albumCover']):
                        song_dict['albumCover'] = song['albumCover']

                    # Add audio URL if available
                    if 'audioUrl' in song and pd.notna(song['audioUrl']):
                        song_dict['audioUrl'] = song['audioUrl']

                    songs.append(song_dict)

                if songs:  # Only add non-empty playlists
                    playlists[playlist_name] = songs

            print(f"Successfully generated {len(playlists)} playlists")
            return playlists

        except Exception as e:
            print(f"Error generating playlists: {e}")
            import traceback
            traceback.print_exc()
            raise

    def _generate_playlist_name(self, cluster_songs, cluster_id):
        """
        Generate a name for the playlist based on audio features.

        Parameters:
        -----------
        cluster_songs : pandas.DataFrame
            DataFrame containing songs in the cluster
        cluster_id : int
            ID of the cluster

        Returns:
        --------
        str
            Generated playlist name
        """
        try:
            # Calculate average features for this cluster
            avg_features = {}

            # Handle nested feature columns
            for col in self.feature_columns:
                col_name = col.split('.')[-1] if '.' in col else col
                if col in cluster_songs.columns:
                    numeric_values = pd.to_numeric(cluster_songs[col], errors='coerce')
                    avg_features[col_name] = numeric_values.mean()

            # Simple naming logic based on features
            if 'tempo' in avg_features and 'energy' in avg_features:
                # Tempo-based naming
                tempo = avg_features['tempo']
                energy = avg_features['energy']

                if pd.isna(tempo) or pd.isna(energy):
                    return f"Playlist {cluster_id + 1}"

                if tempo > 120:
                    if energy > 0.7:
                        prefix = "Energetic"
                    else:
                        prefix = "Upbeat"
                else:
                    if energy < 0.4:
                        prefix = "Chill"
                    else:
                        prefix = "Smooth"

                # Additional descriptors based on other features
                suffix = "Playlist"
                if 'danceability' in avg_features and not pd.isna(avg_features['danceability']):
                    danceability = avg_features['danceability']
                    if danceability > 0.7:
                        suffix = "Dance Mix"
                elif 'acousticness' in avg_features and not pd.isna(avg_features['acousticness']):
                    if avg_features['acousticness'] > 0.7:
                        suffix = "Acoustic Session"
                elif 'valence' in avg_features and not pd.isna(avg_features['valence']):
                    valence = avg_features['valence']
                    if valence > 0.7:
                        suffix = "Happy Vibes"
                    elif valence < 0.3:
                        suffix = "Moody Tunes"

                return f"{prefix} {suffix}"
            else:
                # Fallback naming if tempo and energy are not available
                return f"Cluster {cluster_id + 1} Playlist"

        except Exception as e:
            print(f"Error generating playlist name: {e}")
            return f"Playlist {cluster_id + 1}"

    def get_cluster_features(self):
        """
        Get the average features for each cluster.

        Returns:
        --------
        dict
            Dictionary where keys are cluster IDs and values are dictionaries of average features
        """
        if 'cluster' not in self.songs_df.columns:
            self.generate_playlists()

        cluster_features = {}
        for cluster_id in range(self.n_clusters):
            cluster_songs = self.songs_df[self.songs_df['cluster'] == cluster_id]

            if len(cluster_songs) == 0:
                continue

            # Calculate average features
            avg_features = {}
            for col in self.feature_columns:
                col_name = col.split('.')[-1] if '.' in col else col
                numeric_values = pd.to_numeric(cluster_songs[col], errors='coerce')
                avg_features[col_name] = float(numeric_values.mean())

            cluster_features[cluster_id] = avg_features

        return cluster_features

    def recommend_playlist(self, song_id):
        """
        Recommend a playlist for a specific song.

        Parameters:
        -----------
        song_id : str or int
            ID of the song to recommend a playlist for

        Returns:
        --------
        dict
            Dictionary containing playlist details
        """
        # Find the song in the DataFrame
        song = self.songs_df[self.songs_df['id'] == song_id]

        if song.empty:
            raise ValueError(f"Song with ID {song_id} not found in the database")

        # If clustering hasn't been done yet, generate playlists
        if 'cluster' not in self.songs_df.columns:
            self.generate_playlists()

        # Get the cluster for this song
        cluster_id = song['cluster'].iloc[0]

        # Get all songs in this cluster
        cluster_songs = self.songs_df[self.songs_df['cluster'] == cluster_id]

        # Generate playlist name
        playlist_name = self._generate_playlist_name(cluster_songs, cluster_id)

        # Extract song details
        songs = []
        for _, song in cluster_songs.iterrows():
            song_dict = {
                'id': song['id'],
                'title': song['title'],
                'artist': song['artist']
            }

            # Add album cover if available
            if 'albumCover' in song and pd.notna(song['albumCover']):
                song_dict['albumCover'] = song['albumCover']

            # Add audio URL if available
            if 'audioUrl' in song and pd.notna(song['audioUrl']):
                song_dict['audioUrl'] = song['audioUrl']

            songs.append(song_dict)

        return {
            'name': playlist_name,
            'songs': songs,
            'cluster_id': int(cluster_id)
        }
