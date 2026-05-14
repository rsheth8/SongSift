# graph/music_graph.py
import os

import numpy as np
import pandas as pd
import networkx as nx
import matplotlib.pyplot as plt
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler
import io
import base64

class MusicGraph:
    """
    Builds a graph where nodes are songs and edges represent similarity between songs.
    """

    def __init__(self, songs_df, similarity_threshold=0.7, feature_columns=None):
        """
        Initialize the music graph.

        Parameters:
        -----------
        songs_df : pandas.DataFrame
            DataFrame containing songs and their features
        similarity_threshold : float, optional
            Threshold for adding an edge between songs (0-1)
        feature_columns : list, optional
            List of feature columns to use for similarity calculation.
            If None, will use all available audio features.
        """
        self.songs_df = songs_df
        self.similarity_threshold = similarity_threshold
        self.graph = nx.Graph()

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
            raise ValueError("No feature columns available for graph construction")

    def build_graph(self):
        """Build the music similarity graph"""
        if len(self.songs_df) < 2:
            print("Not enough songs to build a graph")
            return

        print("Available columns:", self.songs_df.columns.tolist())

        # Print initial NaN counts to debug
        feature_columns = self.feature_columns
        print(f"Using feature columns: {feature_columns}")

        # Check if all feature columns exist
        for col in feature_columns:
            if col not in self.songs_df.columns:
                print(f"Feature column {col} not found")
                return

        # Extract features
        features = self.songs_df[feature_columns].copy()

        # Print initial NaN counts to debug
        nan_counts_before = features.isna().sum()
        print(f"NaN counts before processing: {nan_counts_before.to_dict()}")

        # Convert to numeric, errors='coerce' will convert non-numeric values to NaN
        for col in feature_columns:
            features[col] = pd.to_numeric(features[col], errors='coerce')

        # Check if we have any valid data
        if features.isna().all().all():
            print("All feature values are NaN, cannot build graph")
            return

        # Fill NaN values with column mean
        for col in feature_columns:
            if features[col].isna().all():
                # If all values in a column are NaN, use a default value
                print(f"All values in column {col} are NaN, using default value")
                if col == 'tempo':
                    features[col] = 120.0  # Default tempo
                elif col == 'energy':
                    features[col] = 0.5    # Default energy
                else:
                    features[col] = 0      # Default for other columns
            else:
                # Otherwise fill with mean
                col_mean = features[col].mean()
                features[col] = features[col].fillna(col_mean)

        # Verify no NaN values remain
        nan_counts_after = features.isna().sum()
        print(f"NaN counts after processing: {nan_counts_after.to_dict()}")

        if features.isna().any().any():
            print("NaN values remain after filling. Using dropna() as a last resort.")
            features = features.dropna()
            if len(features) < 2:
                print("Not enough songs with valid features to build a graph")
                return

        # Calculate similarity matrix
        try:
            similarity_matrix = cosine_similarity(features)

            # Build graph
            for i in range(len(similarity_matrix)):
                song_id = self.songs_df.iloc[i]['id']
                # Add node with attributes
                self.graph.add_node(
                    song_id,
                    title=self.songs_df.iloc[i]['title'],
                    artist=self.songs_df.iloc[i]['artist']
                )

                for j in range(i+1, len(similarity_matrix)):
                    similarity = similarity_matrix[i][j]
                    if similarity >= self.similarity_threshold:
                        target_id = self.songs_df.iloc[j]['id']
                        # Add node for target if it doesn't exist
                        if target_id not in self.graph:
                            self.graph.add_node(
                                target_id,
                                title=self.songs_df.iloc[j]['title'],
                                artist=self.songs_df.iloc[j]['artist']
                            )
                        # Add edge
                        self.graph.add_edge(
                            song_id,
                            target_id,
                            weight=1 - similarity
                        )

            print(f"Graph built with {self.graph.number_of_nodes()} nodes and {self.graph.number_of_edges()} edges")
        except Exception as e:
            print(f"Error building graph: {e}")
            print("Features DataFrame:")
            print(features.head())
            print("Feature types:", features.dtypes)
            raise





    def find_path(self, source_id, target_id):
        """
        Find the shortest path between two songs.

        Parameters:
        -----------
        source_id : str or int
            ID of the source song
        target_id : str or int
            ID of the target song

        Returns:
        --------
        list or None
            List of dictionaries containing song details in the path,
            or None if no path exists
        """
        if not self.graph or self.graph.number_of_edges() == 0:
            self.build_graph()

        try:
            # Find shortest path
            path = nx.shortest_path(
                self.graph,
                source=source_id,
                target=target_id,
                weight='weight'
            )

            # Get song details for each node in the path
            path_details = []
            for song_id in path:
                song_data = self.songs_df[self.songs_df['id'] == song_id].iloc[0]
                song_dict = {
                    'id': song_id,
                    'title': song_data['title'],
                    'artist': song_data['artist']
                }

                # Add album cover if available
                if 'albumCover' in song_data:
                    song_dict['albumCover'] = song_data['albumCover']

                # Add audio URL if available
                if 'audioUrl' in song_data:
                    song_dict['audioUrl'] = song_data['audioUrl']

                path_details.append(song_dict)

            return path_details
        except nx.NetworkXNoPath:
            return None
        except nx.NodeNotFound:
            return None

    def get_similar_songs(self, song_id, n=5):
        """
        Get the n most similar songs to a given song.

        Parameters:
        -----------
        song_id : str or int
            ID of the song to find similar songs for
        n : int, optional
            Number of similar songs to return

        Returns:
        --------
        list
            List of dictionaries containing similar song details
        """
        if not self.graph or self.graph.number_of_edges() == 0:
            self.build_graph()

        # Check if song exists in the graph
        if song_id not in self.graph:
            raise ValueError(f"Song with ID {song_id} not found in the graph")

        # Get neighbors with weights
        neighbors = [(neighbor, self.graph[song_id][neighbor]['weight'])
                     for neighbor in self.graph.neighbors(song_id)]

        # Sort by similarity (weight) in descending order
        neighbors.sort(key=lambda x: x[1], reverse=True)

        # Get top n neighbors
        top_neighbors = neighbors[:n]

        # Get song details
        similar_songs = []
        for neighbor_id, similarity in top_neighbors:
            song_data = self.songs_df[self.songs_df['id'] == neighbor_id].iloc[0]
            song_dict = {
                'id': neighbor_id,
                'title': song_data['title'],
                'artist': song_data['artist'],
                'similarity': float(similarity)
            }

            # Add album cover if available
            if 'albumCover' in song_data:
                song_dict['albumCover'] = song_data['albumCover']

            # Add audio URL if available
            if 'audioUrl' in song_data:
                song_dict['audioUrl'] = song_data['audioUrl']

            similar_songs.append(song_dict)

        return similar_songs

    def get_graph_stats(self):
        """
        Get statistics about the music graph.

        Returns:
        --------
        dict
            Dictionary containing graph statistics
        """
        if not self.graph or self.graph.number_of_edges() == 0:
            self.build_graph()

        # Calculate graph statistics
        stats = {
            'num_nodes': self.graph.number_of_nodes(),
            'num_edges': self.graph.number_of_edges(),
            'avg_degree': sum(dict(self.graph.degree()).values()) / self.graph.number_of_nodes(),
            'density': nx.density(self.graph),
            'connected_components': nx.number_connected_components(self.graph),
            'avg_clustering': nx.average_clustering(self.graph),
            'diameter': -1  # Placeholder for diameter
        }

        # Calculate diameter for each connected component
        if stats['connected_components'] > 1:
            # If graph is not connected, calculate diameter for largest component
            largest_cc = max(nx.connected_components(self.graph), key=len)
            subgraph = self.graph.subgraph(largest_cc)
            stats['diameter'] = nx.diameter(subgraph)
        else:
            # If graph is connected, calculate diameter for the whole graph
            stats['diameter'] = nx.diameter(self.graph)

        return stats

    def visualize_graph(self, save_path=None, highlight_path=None):
        """
        Visualize the music graph

        Parameters:
        -----------
        save_path : str, optional
            Path to save the visualization
        highlight_path : list, optional
            List of node IDs to highlight as a path
        """
        if not self.graph.nodes:
            print("No nodes in graph to visualize")
            return None

        # Create a mapping from node ID to song title for labels
        node_to_title = {}
        for node in self.graph.nodes:
            # Try to get title from node attributes
            if 'title' in self.graph.nodes[node]:
                title = self.graph.nodes[node]['title']
                node_to_title[node] = title[:15] + "..." if len(title) > 15 else title
            else:
                # Fall back to looking up in the DataFrame
                song_data = self.songs_df[self.songs_df['id'] == node]
                if not song_data.empty:
                    title = song_data.iloc[0]['title']
                    node_to_title[node] = title[:15] + "..." if len(title) > 15 else title
                else:
                    node_to_title[node] = str(node)[:10]  # Use truncated ID as fallback

        # Limit visualization to a subset of nodes if the graph is large
        if len(self.graph.nodes) > 20:
            print(f"Graph has {len(self.graph.nodes)} nodes, limiting visualization to 20 nodes")
            if highlight_path:
                # Include highlighted path nodes in the subset
                subset_nodes = set(highlight_path)
                # Add more nodes to reach 20 if needed
                other_nodes = [n for n in self.graph.nodes if n not in subset_nodes]
                subset_nodes.update(other_nodes[:20 - len(subset_nodes)])
            else:
                # Just take the first 20 nodes
                subset_nodes = list(self.graph.nodes)[:20]

            # Create subgraph
            subgraph = self.graph.subgraph(subset_nodes)
        else:
            subgraph = self.graph
            subset_nodes = list(self.graph.nodes)

        # Create the plot
        plt.figure(figsize=(14, 10))

        # Get positions for nodes
        pos = nx.spring_layout(subgraph, seed=42, k=2, iterations=50)

        # Draw the edges
        nx.draw_networkx_edges(
            subgraph, pos,
            alpha=0.6,
            width=1.5,
            edge_color='lightgray'
        )

        # Draw nodes
        if highlight_path:
            # Draw regular nodes
            regular_nodes = [n for n in subset_nodes if n not in highlight_path]
            if regular_nodes:
                nx.draw_networkx_nodes(
                    subgraph, pos,
                    nodelist=regular_nodes,
                    node_color='lightblue',
                    node_size=800,
                    alpha=0.8
                )

            # Draw highlighted path nodes
            path_nodes = [n for n in highlight_path if n in subset_nodes]
            if path_nodes:
                # Color nodes along the path with gradient
                colors = plt.cm.Reds(np.linspace(0.4, 1, len(path_nodes)))
                nx.draw_networkx_nodes(
                    subgraph, pos,
                    nodelist=path_nodes,
                    node_color=colors,
                    node_size=1000,
                    alpha=0.9
                )

            # Draw edges in the path
            path_edges = []
            for i in range(len(path_nodes) - 1):
                if subgraph.has_edge(path_nodes[i], path_nodes[i+1]):
                    path_edges.append((path_nodes[i], path_nodes[i+1]))

            if path_edges:
                nx.draw_networkx_edges(
                    subgraph, pos,
                    edgelist=path_edges,
                    edge_color='red',
                    width=4,
                    alpha=0.8
                )
        else:
            # Draw all nodes the same
            nx.draw_networkx_nodes(
                subgraph, pos,
                node_color='lightblue',
                node_size=800,
                alpha=0.8
            )

        # Draw labels using the node_to_title mapping
        labels = {node: node_to_title.get(node, node) for node in subset_nodes}
        nx.draw_networkx_labels(
            subgraph, pos,
            labels=labels,
            font_size=8,
            font_family='sans-serif',
            font_weight='bold'
        )

        plt.title("Music Similarity Graph", fontsize=16, fontweight='bold')
        plt.axis('off')
        plt.tight_layout()

        # Save or show the plot
        if save_path:
            try:
                # Ensure directory exists
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                plt.savefig(save_path, bbox_inches='tight', dpi=150, facecolor='white')
                plt.close()
                print(f"Visualization saved to: {save_path}")
                return save_path
            except Exception as e:
                print(f"Error saving visualization: {e}")
                plt.close()
                return None
        else:
            plt.show()
            plt.close()
            return None





    def get_visualization_as_base64(self, highlight_path=None, figsize=(12, 10)):
        """
        Get the graph visualization as a base64-encoded string for embedding in web pages.

        Parameters:
        -----------
        highlight_path : list, optional
            List of song IDs to highlight in the visualization
        figsize : tuple, optional
            Figure size (width, height) in inches

        Returns:
        --------
        str
            Base64-encoded image string
        """
        # Create a BytesIO object to save the figure
        buf = io.BytesIO()

        # Save the figure to the BytesIO object
        self.visualize_graph(save_path=buf, figsize=figsize, highlight_path=highlight_path)

        # Encode the figure as base64
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')

        return img_str
