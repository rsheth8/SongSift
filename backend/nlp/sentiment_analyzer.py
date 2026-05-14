# nlp/sentiment_analyzer.py
import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from collections import Counter
import matplotlib.pyplot as plt
import numpy as np
import os
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import io
import base64

# Download required NLTK resources
try:
    nltk.data.find('vader_lexicon')
except LookupError:
    nltk.download('vader_lexicon')

try:
    nltk.data.find('punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('stopwords')
except LookupError:
    nltk.download('stopwords')

try:
    nltk.data.find('wordnet')
except LookupError:
    nltk.download('wordnet')

class LyricAnalyzer:
    """
    Analyzes lyrics for sentiment, keywords, and themes.
    """

    def __init__(self):
        """Initialize the lyric analyzer."""
        self.sentiment_analyzer = SentimentIntensityAnalyzer()
        self.stop_words = set(stopwords.words('english'))
        self.lemmatizer = WordNetLemmatizer()

        # Add music-specific stop words
        self.stop_words.update(['oh', 'yeah', 'hey', 'uh', 'ah', 'la', 'na', 'ooh', 'whoa', 'chorus', 'verse', 'bridge'])

        # Emotion lexicon
        self.emotion_lexicon = {
            'happy': ['happy', 'joy', 'love', 'smile', 'laugh', 'dance', 'sun', 'bright', 'light', 'hope', 'dream'],
            'sad': ['sad', 'cry', 'tear', 'pain', 'hurt', 'broken', 'heart', 'alone', 'lonely', 'dark', 'rain', 'goodbye'],
            'angry': ['angry', 'hate', 'rage', 'fight', 'scream', 'burn', 'fire', 'fury', 'mad', 'bitter', 'revenge'],
            'calm': ['calm', 'peace', 'quiet', 'gentle', 'soft', 'slow', 'breath', 'flow', 'sea', 'sky', 'blue', 'sleep'],
            'energetic': ['energy', 'fast', 'run', 'jump', 'beat', 'wild', 'crazy', 'party', 'high', 'alive', 'power']
        }

    def analyze_sentiment(self, lyrics):
        """
        Analyze the sentiment of lyrics.

        Parameters:
        -----------
        lyrics : str
            Lyrics text

        Returns:
        --------
        dict
            Dictionary containing sentiment scores and overall sentiment
        """
        if not lyrics or lyrics.startswith('No lyrics found'):
            return {
                'compound': 0,
                'pos': 0,
                'neu': 0,
                'neg': 0,
                'overall': 'Neutral'
            }

        sentiment = self.sentiment_analyzer.polarity_scores(lyrics)

        # Determine overall sentiment
        if sentiment['compound'] >= 0.05:
            overall = "Positive"
        elif sentiment['compound'] <= -0.05:
            overall = "Negative"
        else:
            overall = "Neutral"

        sentiment['overall'] = overall

        return sentiment

    def extract_keywords(self, lyrics, top_n=10):
        """
        Extract the most important keywords from lyrics.

        Parameters:
        -----------
        lyrics : str
            Lyrics text
        top_n : int, optional
            Number of top keywords to extract

        Returns:
        --------
        list
            List of (word, frequency) tuples
        """
        if not lyrics or lyrics.startswith('No lyrics found'):
            return []

        # Tokenize
        tokens = word_tokenize(lyrics.lower())

        # Remove stop words and non-alphabetic tokens
        filtered_tokens = [
            self.lemmatizer.lemmatize(token)
            for token in tokens
            if token.isalpha() and token not in self.stop_words and len(token) > 2
        ]

        # Count word frequencies
        word_counts = Counter(filtered_tokens)

        # Get top N words
        top_words = word_counts.most_common(top_n)

        return top_words

    def detect_emotions(self, lyrics):
        """
        Detect emotions in lyrics based on emotion lexicon.

        Parameters:
        -----------
        lyrics : str
            Lyrics text

        Returns:
        --------
        dict
            Dictionary mapping emotions to scores
        """
        if not lyrics or lyrics.startswith('No lyrics found'):
            return {emotion: 0 for emotion in self.emotion_lexicon}

        # Tokenize and lemmatize
        tokens = word_tokenize(lyrics.lower())
        lemmas = [self.lemmatizer.lemmatize(token) for token in tokens if token.isalpha()]

        # Count occurrences of emotion words
        emotion_scores = {emotion: 0 for emotion in self.emotion_lexicon}

        for lemma in lemmas:
            for emotion, words in self.emotion_lexicon.items():
                if lemma in words:
                    emotion_scores[emotion] += 1

        # Normalize scores
        total = sum(emotion_scores.values())
        if total > 0:
            for emotion in emotion_scores:
                emotion_scores[emotion] /= total

        return emotion_scores

    def calculate_lyric_similarity(self, lyrics1, lyrics2):
        """
        Calculate similarity between two sets of lyrics.

        Parameters:
        -----------
        lyrics1 : str
            First lyrics text
        lyrics2 : str
            Second lyrics text

        Returns:
        --------
        float
            Similarity score between 0 and 1
        """
        if not lyrics1 or not lyrics2 or lyrics1.startswith('No lyrics found') or lyrics2.startswith('No lyrics found'):
            return 0

        # Create TF-IDF vectors
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform([lyrics1, lyrics2])

        # Calculate cosine similarity
        similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0]

        return similarity

    def visualize_sentiment(self, sentiment_data, save_path=None, figsize=(10, 6)):
        """
        Create a visualization of sentiment analysis.

        Parameters:
        -----------
        sentiment_data : dict
            Dictionary containing sentiment scores
        save_path : str, optional
            Path to save the visualization image
        figsize : tuple, optional
            Figure size (width, height) in inches

        Returns:
        --------
        str or None
            Path to the saved image if save_path is provided, None otherwise
        """
        # Create bar chart
        labels = ['Positive', 'Neutral', 'Negative']
        values = [sentiment_data['pos'], sentiment_data['neu'], sentiment_data['neg']]

        plt.figure(figsize=figsize)
        bars = plt.bar(labels, values, color=['green', 'gray', 'red'])

        # Add values on top of bars
        for bar in bars:
            height = bar.get_height()
            plt.text(
                bar.get_x() + bar.get_width()/2.,
                height + 0.02,
                f'{height:.2f}',
                ha='center'
            )

        plt.title('Lyric Sentiment Analysis')
        plt.ylim(0, 1.0)
        plt.ylabel('Score')
        plt.tight_layout()

        if save_path:
            plt.savefig(save_path)
            plt.close()
            return save_path
        else:
            plt.show()
            return None

    def visualize_emotions(self, emotion_data, save_path=None, figsize=(10, 6)):
        """
        Create a visualization of emotion analysis.

        Parameters:
        -----------
        emotion_data : dict
            Dictionary mapping emotions to scores
        save_path : str, optional
            Path to save the visualization image
        figsize : tuple, optional
            Figure size (width, height) in inches

        Returns:
        --------
        str or None
            Path to the saved image if save_path is provided, None otherwise
        """
        # Create bar chart
        emotions = list(emotion_data.keys())
        scores = list(emotion_data.values())

        plt.figure(figsize=figsize)
        bars = plt.bar(emotions, scores, color='skyblue')

        # Add values on top of bars
        for bar in bars:
            height = bar.get_height()
            plt.text(
                bar.get_x() + bar.get_width()/2.,
                height + 0.02,
                f'{height:.2f}',
                ha='center'
            )

        plt.title('Emotion Analysis')
        plt.ylim(0, max(scores) + 0.1)
        plt.ylabel('Score')
        plt.xticks(rotation=45)
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
            Visualization function to call
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

    def full_analysis(self, lyrics):
        """
        Perform complete lyric analysis.

        Parameters:
        -----------
        lyrics : str
            Lyrics text

        Returns:
        --------
        dict
            Dictionary containing all analysis results
        """
        sentiment = self.analyze_sentiment(lyrics)
        keywords = self.extract_keywords(lyrics)
        emotions = self.detect_emotions(lyrics)

        return {
            'lyrics': lyrics,
            'sentiment': sentiment,
            'keywords': keywords,
            'emotions': emotions
        }
