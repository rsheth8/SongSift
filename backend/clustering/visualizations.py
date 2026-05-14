# clustering/visualizations.py
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
from sklearn.decomposition import PCA
from sklearn.manifold import TSNE
import os
import io
import base64

class ClusterVisualizer:
    """
    Visualization tools for music clustering results.
    """

    def __init__(self, songs_df, feature_columns=None):
        """
        Initialize the cluster visualizer.

        Parameters:
        -----------
        songs_df : pandas.DataFrame
            DataFrame containing songs, their features, and cluster assignments
        feature_columns : list, optional
            List of feature columns to use for visualization.
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
            raise ValueError("No feature columns available for visualization")

    def visualize_clusters_pca(self, save_path=None, figsize=(10, 8)):
        """
        Visualize clusters using PCA for dimensionality reduction.

        Parameters:
        -----------
        save_path : str, optional
            Path to save the visualization image
        figsize : tuple, optional
            Figure size (width, height) in inches

        Returns:
        --------
        str or None
            Path to the saved image if save_path is provided, None otherwise
        """
        if 'cluster' not in self.songs_df.columns:
            raise ValueError("Clustering has not been performed yet. No 'cluster' column found.")

        # Extract features
        features = self.songs_df[self.feature_columns].copy()

        # Handle missing values
        features.fillna(features.mean(), inplace=True)

        # Apply PCA for dimensionality reduction
        pca = PCA(n_components=2)
        reduced_features = pca.fit_transform(features)

        # Create plot
        plt.figure(figsize=figsize)

        # Get unique clusters
        clusters = self.songs_df['cluster'].unique()

        # Plot each cluster with a different color
        for cluster in clusters:
            # Get indices of songs in this cluster
            cluster_indices = self.songs_df[self.songs_df['cluster'] == cluster].index

            # Plot points for this cluster
            plt.scatter(
                reduced_features[cluster_indices, 0],
                reduced_features[cluster_indices, 1],
                alpha=0.7,
                label=f'Cluster {cluster}'
            )

        plt.title('Song Clusters Visualization (PCA)')
        plt.xlabel(f'Principal Component 1 ({pca.explained_variance_ratio_[0]:.2%} variance)')
        plt.ylabel(f'Principal Component 2 ({pca.explained_variance_ratio_[1]:.2%} variance)')
        plt.legend()
        plt.grid(alpha=0.3)
        plt.tight_layout()

        if save_path:
            plt.savefig(save_path)
            plt.close()
            return save_path
        else:
            plt.show()
            return None

    def visualize_clusters_tsne(self, save_path=None, figsize=(10, 8), perplexity=30):
        """
        Visualize clusters using t-SNE for dimensionality reduction.

        Parameters:
        -----------
        save_path : str, optional
            Path to save the visualization image
        figsize : tuple, optional
            Figure size (width, height) in inches
        perplexity : int, optional
            t-SNE perplexity parameter

        Returns:
        --------
        str or None
            Path to the saved image if save_path is provided, None otherwise
        """
        if 'cluster' not in self.songs_df.columns:
            raise ValueError("Clustering has not been performed yet. No 'cluster' column found.")

        # Extract features
        features = self.songs_df[self.feature_columns].copy()

        # Handle missing values
        features.fillna(features.mean(), inplace=True)

        # Apply t-SNE for dimensionality reduction
        tsne = TSNE(n_components=2, perplexity=perplexity, random_state=42)
        reduced_features = tsne.fit_transform(features)

        # Create plot
        plt.figure(figsize=figsize)

        # Get unique clusters
        clusters = self.songs_df['cluster'].unique()

        # Plot each cluster with a different color
        for cluster in clusters:
            # Get indices of songs in this cluster
            cluster_indices = self.songs_df[self.songs_df['cluster'] == cluster].index

            # Plot points for this cluster
            plt.scatter(
                reduced_features[cluster_indices, 0],
                reduced_features[cluster_indices, 1],
                alpha=0.7,
                label=f'Cluster {cluster}'
            )

        plt.title('Song Clusters Visualization (t-SNE)')
        plt.xlabel('t-SNE Dimension 1')
        plt.ylabel('t-SNE Dimension 2')
        plt.legend()
        plt.grid(alpha=0.3)
        plt.tight_layout()

        if save_path:
            plt.savefig(save_path)
            plt.close()
            return save_path
        else:
            plt.show()
            return None

    def visualize_feature_distribution(self, feature, save_path=None, figsize=(12, 6)):
        """
        Visualize the distribution of a specific feature across clusters.

        Parameters:
        -----------
        feature : str
            Name of the feature to visualize
        save_path : str, optional
            Path to save the visualization image
        figsize : tuple, optional
            Figure size (width, height) in inches

        Returns:
        --------
        str or None
            Path to the saved image if save_path is provided, None otherwise
        """
        if 'cluster' not in self.songs_df.columns:
            raise ValueError("Clustering has not been performed yet. No 'cluster' column found.")

        # Find the full column name if it's a nested feature
        feature_col = next((col for col in self.feature_columns if col.endswith(feature)), feature)

        if feature_col not in self.songs_df.columns:
            raise ValueError(f"Feature '{feature}' not found in the dataset")

        # Create plot
        plt.figure(figsize=figsize)

        # Get unique clusters
        clusters = sorted(self.songs_df['cluster'].unique())

        # Create box plot
        data = [self.songs_df[self.songs_df['cluster'] == cluster][feature_col] for cluster in clusters]

        plt.boxplot(data, labels=[f'Cluster {c}' for c in clusters])
        plt.title(f'Distribution of {feature} Across Clusters')
        plt.ylabel(feature.capitalize())
        plt.grid(axis='y', alpha=0.3)
        plt.tight_layout()

        if save_path:
            plt.savefig(save_path)
            plt.close()
            return save_path
        else:
            plt.show()
            return None

    def get_cluster_radar_chart(self, cluster_id, save_path=None, figsize=(8, 8)):
        """
        Create a radar chart showing the average features for a specific cluster.

        Parameters:
        -----------
        cluster_id : int
            ID of the cluster to visualize
        save_path : str, optional
            Path to save the visualization image
        figsize : tuple, optional
            Figure size (width, height) in inches

        Returns:
        --------
        str or None
            Path to the saved image if save_path is provided, None otherwise
        """
        if 'cluster' not in self.songs_df.columns:
            raise ValueError("Clustering has not been performed yet. No 'cluster' column found.")

        # Check if cluster exists
        if cluster_id not in self.songs_df['cluster'].values:
            raise ValueError(f"Cluster {cluster_id} not found in the dataset")

        # Get songs in this cluster
        cluster_songs = self.songs_df[self.songs_df['cluster'] == cluster_id]

        # Select features for radar chart (exclude non-normalized features like tempo and key)
        radar_features = [col for col in self.feature_columns
                          if col.split('.')[-1] in ['energy', 'danceability', 'acousticness',
                                                    'instrumentalness', 'valence', 'speechiness']]

        if not radar_features:
            raise ValueError("No suitable features found for radar chart")

        # Calculate average features
        avg_features = {}
        for col in radar_features:
            col_name = col.split('.')[-1] if '.' in col else col
            avg_features[col_name] = cluster_songs[col].mean()

        # Create radar chart
        fig = plt.figure(figsize=figsize)
        ax = fig.add_subplot(111, polar=True)

        # Number of variables
        N = len(avg_features)

        # Feature names and values
        categories = list(avg_features.keys())
        values = list(avg_features.values())

        # Close the plot
        values += values[:1]
        categories += categories[:1]

        # Calculate angles for each feature
        angles = [n / float(N) * 2 * np.pi for n in range(N)]
        angles += angles[:1]

        # Plot data
        ax.plot(angles, values, linewidth=2, linestyle='solid')

        # Fill area
        ax.fill(angles, values, alpha=0.25)

        # Set category labels
        plt.xticks(angles[:-1], [c.capitalize() for c in categories[:-1]])

        # Set y-axis limits
        ax.set_ylim(0, 1)

        plt.title(f'Audio Features for Cluster {cluster_id}')
        plt.tight_layout()

        if save_path:
            plt.savefig(save_path)
            plt.close()
            return save_path
        else:
            plt.show()
            return None

    def get_visualization_as_base64(self, visualization_func, **kwargs):
        """
        Get a visualization as a base64-encoded string for embedding in web pages.

        Parameters:
        -----------
        visualization_func : function
            Visualization function to call (e.g., visualize_clusters_pca)
        **kwargs : dict
            Arguments to pass to the visualization function

        Returns:
        --------
        str
            Base64-encoded image string
        """
        # Create a BytesIO object to save the figure
        buf = io.BytesIO()

        # Save the figure to the BytesIO object
        kwargs['save_path'] = buf
        visualization_func(**kwargs)

        # Encode the figure as base64
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')

        return img_str
