# graph/path_finder.py
import networkx as nx
import numpy as np
import random
import pandas as pd
from .music_graph import MusicGraph

class MusicPathFinder:
    """
    Advanced path finding algorithms for music graphs.
    """

    def __init__(self, music_graph):
        """
        Initialize the music path finder.

        Parameters:
        -----------
        music_graph : MusicGraph
            MusicGraph instance with a built graph
        """
        self.music_graph = music_graph

        # Build the graph if it hasn't been built yet
        if not self.music_graph.graph or self.music_graph.graph.number_of_edges() == 0:
            self.music_graph.build_graph()

    def find_shortest_path(self, source_id, target_id):
        """Find the shortest path between two songs"""
        if source_id not in self.music_graph.graph or target_id not in self.music_graph.graph:
            print(f"One or both songs not in graph: {source_id}, {target_id}")
            return None

        try:
            path = nx.shortest_path(
                self.music_graph.graph,
                source=source_id,
                target=target_id,
                weight='weight'
            )

            # Convert path of IDs to song objects
            path_songs = []
            for song_id in path:
                song = self.music_graph.songs_df[self.music_graph.songs_df['id'] == song_id].iloc[0].to_dict()
                path_songs.append(song)

            return path_songs
        except nx.NetworkXNoPath:
            print(f"No path found between {source_id} and {target_id}")
            return None


    def find_all_paths(self, source_id, target_id, cutoff=5):
        """
        Find all paths between two songs up to a certain length.

        Parameters:
        -----------
        source_id : str or int
            ID of the source song
        target_id : str or int
            ID of the target song
        cutoff : int, optional
            Maximum path length

        Returns:
        --------
        list
            List of paths, where each path is a list of song IDs
        """
        try:
            # Find all simple paths
            all_paths = list(nx.all_simple_paths(
                self.music_graph.graph,
                source=source_id,
                target=target_id,
                cutoff=cutoff
            ))

            return all_paths
        except (nx.NetworkXNoPath, nx.NodeNotFound):
            return []

    def find_most_diverse_path(self, source_id, target_id, min_length=2, cutoff=10):
        """
        Find the most diverse path between two songs.

        Parameters:
        -----------
        source_id : str or int
            ID of the source song
        target_id : str or int
            ID of the target song
        min_length : int, optional
            Minimum number of nodes in the path (including source and target)
        cutoff : int, optional
            Maximum path length

        Returns:
        --------
        list or None
            List of dictionaries containing song details in the path,
            or None if no path exists
        """
        # Get all paths
        all_paths = self.find_all_paths(source_id, target_id, cutoff)

        if not all_paths:
            return None

        # Filter paths that meet the minimum length
        all_paths = [p for p in all_paths if len(p) >= min_length]

        if not all_paths:
            # If no paths meet the minimum length, try with the shortest path
            shortest_path = self.find_shortest_path(source_id, target_id)
            if shortest_path:
                return self._extend_path(shortest_path, min_length)
            return None

        # Calculate diversity score for each path
        path_diversity = []

        for path in all_paths:
            # Get features for songs in the path
            path_features = []
            for song_id in path:
                song_data = self.music_graph.songs_df[self.music_graph.songs_df['id'] == song_id]
                if not song_data.empty:
                    # Use the feature columns that were actually used to build the graph
                    feature_values = []
                    for col in self.music_graph.feature_columns:
                        if col in song_data.columns:
                            # Convert to numeric to ensure proper calculation
                            value = pd.to_numeric(song_data[col].values[0], errors='coerce')
                            if not pd.isna(value):
                                feature_values.append(value)
                    if feature_values:
                        path_features.append(feature_values)

            # Skip paths with insufficient feature data
            if len(path_features) < 2:
                continue

            # Check if all feature vectors have the same length
            feature_lengths = [len(features) for features in path_features]
            if len(set(feature_lengths)) > 1:
                # Pad shorter vectors with zeros to match the longest
                max_length = max(feature_lengths)
                path_features = [features + [0] * (max_length - len(features)) for features in path_features]

            # Calculate standard deviation for each feature across the path
            try:
                feature_std = np.std(path_features, axis=0)
                # Use mean of standard deviations as diversity score
                diversity_score = np.mean(feature_std)
                path_diversity.append((path, diversity_score))
            except Exception as e:
                print(f"Error calculating diversity for path: {e}")
                continue

        # If no valid paths with diversity scores, return None
        if not path_diversity:
            return None

        # Sort paths by diversity score (descending)
        path_diversity.sort(key=lambda x: x[1], reverse=True)

        # Get the most diverse path
        most_diverse_path = path_diversity[0][0]

        # Get song details for each node in the path
        path_details = []
        for song_id in most_diverse_path:
            try:
                song_data = self.music_graph.songs_df[self.music_graph.songs_df['id'] == song_id].iloc[0]
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
            except IndexError:
                # If song data can't be found, add minimal info
                path_details.append({'id': song_id, 'title': f'Unknown Song ({song_id})', 'artist': 'Unknown'})

        return path_details


    def find_smooth_transition_path(self, source_id, target_id, min_length=2, cutoff=10):
        """
        Find a path with smooth transitions between songs.

        Parameters:
        -----------
        source_id : str or int
            ID of the source song
        target_id : str or int
            ID of the target song
        min_length : int, optional
            Minimum number of nodes in the path (including source and target)
        cutoff : int, optional
            Maximum path length

        Returns:
        --------
        list or None
            List of dictionaries containing song details in the path,
            or None if no path exists
        """
        # Get all paths
        all_paths = self.find_all_paths(source_id, target_id, cutoff)

        if not all_paths:
            return None

        # Filter paths that meet the minimum length
        all_paths = [p for p in all_paths if len(p) >= min_length]

        if not all_paths:
            # If no paths meet the minimum length, try with the shortest path
            shortest_path = self.find_shortest_path(source_id, target_id)
            if shortest_path:
                return self._extend_path(shortest_path, min_length)
            return None

        # Calculate smoothness score for each path
        path_smoothness = []

        for path in all_paths:
            # Calculate edge weights (similarities) along the path
            edge_weights = []
            for i in range(len(path) - 1):
                edge_weight = self.music_graph.graph[path[i]][path[i+1]]['weight']
                edge_weights.append(edge_weight)

            # Use minimum similarity as smoothness score (weakest link)
            smoothness_score = min(edge_weights)

            path_smoothness.append((path, smoothness_score))

        # Sort paths by smoothness score (descending)
        path_smoothness.sort(key=lambda x: x[1], reverse=True)

        # Get the smoothest path
        smoothest_path = path_smoothness[0][0]

        # Get song details for each node in the path
        path_details = []
        for song_id in smoothest_path:
            song_data = self.music_graph.songs_df[self.music_graph.songs_df['id'] == song_id].iloc[0]
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

    def generate_musical_journey(self, seed_song_id, length=5, diversity_weight=0.5):
        """
        Generate a musical journey starting from a seed song.

        Parameters:
        -----------
        seed_song_id : str or int
            ID of the seed song
        length : int, optional
            Length of the journey
        diversity_weight : float, optional
            Weight for diversity vs. similarity (0-1)

        Returns:
        --------
        list
            List of dictionaries containing song details in the journey
        """
        if seed_song_id not in self.music_graph.graph:
            raise ValueError(f"Seed song with ID {seed_song_id} not found in the graph")

        # Initialize journey with seed song
        journey = [seed_song_id]
        current_song_id = seed_song_id

        # Build journey one song at a time
        for _ in range(length - 1):
            # Get neighbors of current song
            neighbors = list(self.music_graph.graph.neighbors(current_song_id))

            # Remove songs already in the journey
            neighbors = [n for n in neighbors if n not in journey]

            if not neighbors:
                # If no unvisited neighbors, try to find a path to a random song
                unvisited_songs = [n for n in self.music_graph.graph.nodes if n not in journey]
                if not unvisited_songs:
                    break  # All songs are in the journey

                # Try to find a path to a random unvisited song
                target_song = random.choice(unvisited_songs)
                try:
                    path = nx.shortest_path(
                        self.music_graph.graph,
                        source=current_song_id,
                        target=target_song
                    )
                    # Add the next song in the path
                    next_song = path[1]
                    journey.append(next_song)
                    current_song_id = next_song
                except (nx.NetworkXNoPath, IndexError):
                    break  # No path found or path is too short
            else:
                # Calculate scores for each neighbor
                neighbor_scores = []

                for neighbor in neighbors:
                    # Similarity score (from graph edge weight)
                    similarity_score = self.music_graph.graph[current_song_id][neighbor]['weight']

                    # Diversity score (based on feature difference from current journey)
                    journey_features = []
                    for song_id in journey:
                        song_data = self.music_graph.songs_df[self.music_graph.songs_df['id'] == song_id]
                        if not song_data.empty:
                            # Get features for the song
                            feature_values = []
                            for col in self.music_graph.feature_columns:
                                if col in song_data.columns:
                                    value = pd.to_numeric(song_data[col].values[0], errors='coerce')
                                    if not pd.isna(value):
                                        feature_values.append(value)
                            if feature_values:
                                journey_features.append(feature_values)

                    neighbor_data = self.music_graph.songs_df[self.music_graph.songs_df['id'] == neighbor]
                    if not neighbor_data.empty:
                        # Get features for the neighbor
                        neighbor_features = []
                        for col in self.music_graph.feature_columns:
                            if col in neighbor_data.columns:
                                value = pd.to_numeric(neighbor_data[col].values[0], errors='coerce')
                                if not pd.isna(value):
                                    neighbor_features.append(value)

                        if neighbor_features and journey_features:
                            # Ensure all feature vectors have the same length
                            feature_lengths = [len(features) for features in journey_features] + [len(neighbor_features)]
                            if len(set(feature_lengths)) > 1:
                                max_length = max(feature_lengths)
                                journey_features = [features + [0] * (max_length - len(features)) for features in journey_features]
                                neighbor_features = neighbor_features + [0] * (max_length - len(neighbor_features))

                            # Calculate average feature vector for journey
                            avg_journey_features = np.mean(journey_features, axis=0)

                            # Calculate Euclidean distance as diversity score
                            diversity_score = np.linalg.norm(np.array(neighbor_features) - avg_journey_features)

                            # Normalize diversity score (0-1)
                            max_diversity = np.sqrt(len(neighbor_features))
                            diversity_score = min(diversity_score / max_diversity, 1.0)

                            # Combined score
                            combined_score = (1 - diversity_weight) * similarity_score + diversity_weight * diversity_score

                            neighbor_scores.append((neighbor, combined_score))

                if neighbor_scores:
                    # Sort by combined score (descending)
                    neighbor_scores.sort(key=lambda x: x[1], reverse=True)

                    # Add the highest scoring neighbor to the journey
                    next_song = neighbor_scores[0][0]
                    journey.append(next_song)
                    current_song_id = next_song
                else:
                    break  # No valid neighbors

        # Get song details for each node in the journey
        journey_details = []
        for song_id in journey:
            try:
                song_data = self.music_graph.songs_df[self.music_graph.songs_df['id'] == song_id].iloc[0]
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

                journey_details.append(song_dict)
            except (IndexError, KeyError):
                # If song data can't be found, add minimal info
                journey_details.append({'id': song_id, 'title': f'Unknown Song ({song_id})', 'artist': 'Unknown'})

        return journey_details

    def find_path_with_min_length(self, source_id, target_id, min_length=2):
        """
        Find a path between two songs with at least min_length nodes

        Parameters:
        -----------
        source_id : str
            ID of the source song
        target_id : str
            ID of the target song
        min_length : int
            Minimum number of nodes in the path (including source and target)

        Returns:
        --------
        list or None
            List of dictionaries containing song details in the path,
            or None if no path exists
        """
        # First try to find the shortest path
        shortest_path = self.find_shortest_path(source_id, target_id)

        if not shortest_path:
            return None

        # If the shortest path is already long enough, return it
        if len(shortest_path) >= min_length:
            return shortest_path

        # Otherwise, we need to find a longer path
        # Get all simple paths up to a reasonable length
        all_paths = list(nx.all_simple_paths(
            self.music_graph.graph,
            source=source_id,
            target=target_id,
            cutoff=min(20, min_length*2)  # Limit search depth to avoid excessive computation
        ))

        # Filter paths that meet the minimum length
        valid_paths = [p for p in all_paths if len(p) >= min_length]

        if not valid_paths:
            # If no paths meet the minimum length, try to extend the shortest path
            return self._extend_path(shortest_path, min_length)

        # Sort by length (ascending) to get the shortest path that meets the minimum length
        valid_paths.sort(key=len)
        best_path = valid_paths[0]

        # Convert path of IDs to song objects
        path_details = []
        for song_id in best_path:
            song_data = self.music_graph.songs_df[self.music_graph.songs_df['id'] == song_id]
            if not song_data.empty:
                song_dict = {
                    'id': song_id,
                    'title': song_data.iloc[0]['title'],
                    'artist': song_data.iloc[0]['artist']
                }

                # Add album cover if available
                if 'albumCover' in song_data.columns:
                    song_dict['albumCover'] = song_data.iloc[0]['albumCover']

                # Add audio URL if available
                if 'audioUrl' in song_data.columns:
                    song_dict['audioUrl'] = song_data.iloc[0]['audioUrl']

                path_details.append(song_dict)

        return path_details

    def _extend_path(self, path, min_length):
        """
        Extend a path to meet the minimum length by adding detours

        Parameters:
        -----------
        path : list
            List of song dictionaries in the current path
        min_length : int
            Minimum path length to achieve

        Returns:
        --------
        list
            Extended path with at least min_length nodes
        """
        if not path or len(path) >= min_length:
            return path

        # Get IDs from the path
        path_ids = [song['id'] for song in path]

        # How many more songs we need to add
        needed = min_length - len(path)

        # Try to insert songs between existing path nodes
        extended_path = [path[0]]  # Start with the source song

        for i in range(1, len(path)):
            current_id = path[i-1]['id']
            next_id = path[i]['id']

            # Find common neighbors that could be inserted between these songs
            current_neighbors = set(self.music_graph.graph.neighbors(current_id))
            next_neighbors = set(self.music_graph.graph.neighbors(next_id))
            common_neighbors = current_neighbors.intersection(next_neighbors)

            # Filter out nodes already in the path
            common_neighbors = [n for n in common_neighbors if n not in path_ids]

            # If we found common neighbors, add some to the path
            for neighbor in common_neighbors[:needed]:
                # Get song data
                song_data = self.music_graph.songs_df[self.music_graph.songs_df['id'] == neighbor]
                if not song_data.empty:
                    song_dict = {
                        'id': neighbor,
                        'title': song_data.iloc[0]['title'],
                        'artist': song_data.iloc[0]['artist']
                    }

                    # Add album cover if available
                    if 'albumCover' in song_data.columns:
                        song_dict['albumCover'] = song_data.iloc[0]['albumCover']

                    # Add audio URL if available
                    if 'audioUrl' in song_data.columns:
                        song_dict['audioUrl'] = song_data.iloc[0]['audioUrl']

                    extended_path.append(song_dict)
                    needed -= 1
                    path_ids.append(neighbor)

            # Add the next song from the original path
            extended_path.append(path[i])

            # If we've added enough songs, we're done
            if needed <= 0:
                break

        # If we still need more songs, try adding neighbors at the end
        if needed > 0 and len(path) > 0:
            last_id = path[-1]['id']
            neighbors = list(self.music_graph.graph.neighbors(last_id))
            neighbors = [n for n in neighbors if n not in path_ids]

            for neighbor in neighbors[:needed]:
                # Get song data
                song_data = self.music_graph.songs_df[self.music_graph.songs_df['id'] == neighbor]
                if not song_data.empty:
                    song_dict = {
                        'id': neighbor,
                        'title': song_data.iloc[0]['title'],
                        'artist': song_data.iloc[0]['artist']
                    }

                    # Add album cover if available
                    if 'albumCover' in song_data.columns:
                        song_dict['albumCover'] = song_data.iloc[0]['albumCover']

                    # Add audio URL if available
                    if 'audioUrl' in song_data.columns:
                        song_dict['audioUrl'] = song_data.iloc[0]['audioUrl']

                    extended_path.append(song_dict)
                    needed -= 1
                    path_ids.append(neighbor)

        return extended_path
