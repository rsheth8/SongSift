# recommendation/collaborative.py
import numpy as np
import pandas as pd
from scipy.sparse.linalg import svds
from sklearn.metrics.pairwise import cosine_similarity

class CollaborativeRecommender:
    """
    Collaborative filtering recommendation system that suggests songs based on
    user ratings and preferences.
    """

    def __init__(self, ratings_df, num_factors=20):
        """
        Initialize the collaborative recommender.

        Parameters:
        -----------
        ratings_df : pandas.DataFrame
            DataFrame containing user ratings with columns: user_id, song_id, rating
        num_factors : int, optional
            Number of latent factors to use in matrix factorization
        """
        self.ratings_df = ratings_df
        self.num_factors = num_factors
        self.user_features = None
        self.song_features = None
        self.predicted_ratings = None
        self.user_ids = None
        self.song_ids = None

    def create_matrix(self):
        """Create a user-item matrix from ratings DataFrame"""
        # Create a pivot table: users as rows, songs as columns
        user_song_matrix = self.ratings_df.pivot(
            index='user_id',
            columns='song_id',
            values='rating'
        ).fillna(0)

        # Convert to numpy array
        ratings_matrix = user_song_matrix.values

        # Keep track of mappings
        self.user_ids = list(user_song_matrix.index)
        self.song_ids = list(user_song_matrix.columns)

        return ratings_matrix, user_song_matrix

    def fit(self):
        """Train the SVD model on the ratings matrix"""
        # Create matrix if not already done
        ratings_matrix, _ = self.create_matrix()

        # Check if we have enough data
        if ratings_matrix.shape[0] < 2 or ratings_matrix.shape[1] < 2:
            raise ValueError("Not enough ratings data for collaborative filtering")

        # Adjust num_factors if necessary
        k = min(self.num_factors, min(ratings_matrix.shape) - 1)

        # Calculate the mean rating for each user
        user_ratings_mean = np.mean(ratings_matrix, axis=1)

        # Center the ratings by subtracting mean
        ratings_centered = ratings_matrix - user_ratings_mean.reshape(-1, 1)

        # Perform SVD
        U, sigma, Vt = svds(ratings_centered, k=k)

        # Convert sigma to diagonal matrix
        sigma_diag = np.diag(sigma)

        # Store the latent factors
        self.user_features = U
        self.song_features = Vt.T

        # Reconstruct the ratings matrix
        self.predicted_ratings = np.dot(np.dot(U, sigma_diag), Vt) + user_ratings_mean.reshape(-1, 1)

        return self.predicted_ratings

    def recommend_songs(self, user_id, n=5, exclude_heard=True):
        """
        Recommend top n songs for a specific user.

        Parameters:
        -----------
        user_id : str or int
            ID of the user to recommend songs for
        n : int, optional
            Number of recommendations to return
        exclude_heard : bool, optional
            Whether to exclude songs the user has already rated

        Returns:
        --------
        list
            List of dictionaries containing recommended song details
        """
        if self.predicted_ratings is None:
            self.fit()

        # Get the index of the user
        try:
            user_idx = self.user_ids.index(user_id)
        except ValueError:
            raise ValueError(f"User with ID {user_id} not found in the ratings data")

        # Get predicted ratings for this user
        user_ratings = self.predicted_ratings[user_idx]

        # Create a DataFrame with song_ids and predicted ratings
        songs_df = pd.DataFrame({
            'song_id': self.song_ids,
            'predicted_rating': user_ratings
        })

        # If exclude_heard is True, remove songs the user has already rated
        if exclude_heard:
            # Get song_ids the user has already rated
            rated_songs = self.ratings_df[self.ratings_df['user_id'] == user_id]['song_id'].values
            songs_df = songs_df[~songs_df['song_id'].isin(rated_songs)]

        # Sort by predicted rating and get top n
        top_recommendations = songs_df.sort_values('predicted_rating', ascending=False).head(n)

        return top_recommendations.to_dict('records')

    def get_similar_users(self, user_id, n=5):
        """
        Find users with similar taste to the given user.

        Parameters:
        -----------
        user_id : str or int
            ID of the user to find similar users for
        n : int, optional
            Number of similar users to return

        Returns:
        --------
        list
            List of dictionaries containing similar user details
        """
        if self.user_features is None:
            self.fit()

        # Get the index of the user
        try:
            user_idx = self.user_ids.index(user_id)
        except ValueError:
            raise ValueError(f"User with ID {user_id} not found in the ratings data")

        # Get user feature vector
        user_vector = self.user_features[user_idx].reshape(1, -1)

        # Calculate similarity with all users
        similarities = cosine_similarity(user_vector, self.user_features)[0]

        # Get top n+1 similar users (first one is the user itself)
        top_indices = np.argsort(similarities)[::-1][1:n+1]

        # Return user details
        similar_users = []
        for idx in top_indices:
            similar_users.append({
                'user_id': self.user_ids[idx],
                'similarity_score': float(similarities[idx])
            })

        return similar_users
