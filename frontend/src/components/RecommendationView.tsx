import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SongPlayer from './songplayer';

const RecommendationView: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const seedSong = location.state?.song;

    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [selectedSong, setSelectedSong] = useState(seedSong);
    const [recommendationType, setRecommendationType] = useState('content-based');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (seedSong) {
            fetchRecommendations();
        }
    }, [seedSong, recommendationType]);

    const fetchRecommendations = async () => {
        setIsLoading(true);
        try {
            let endpoint = '';

            switch(recommendationType) {
                case 'content-based':
                    endpoint = `/api/recommend/similar/${seedSong.id}?count=10`;
                    break;
                case 'collaborative':
                    // Assuming user ID 1 for demo purposes
                    endpoint = `/api/recommend/collaborative/1?count=10`;
                    break;
                case 'hybrid':
                    endpoint = `/api/recommend/hybrid/1?seed_song_id=${seedSong.id}&count=10`;
                    break;
                case 'mood':
                    // Using 'happy' as default mood
                    endpoint = `/api/recommend/mood/happy?count=10`;
                    break;
            }

            const response = await fetch(`http://localhost:5001${endpoint}`);

            if (!response.ok) {
                throw new Error('Failed to fetch recommendations');
            }

            const data = await response.json();
            setRecommendations(data.recommendations || []);
        } catch (error) {
            console.error('Error fetching recommendations:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="recommendation-view">
            <h1>Music Recommendations</h1>

            <div className="recommendation-controls">
                <div className="seed-song">
                    <h2>Based on: {seedSong?.title}</h2>
                    {seedSong && <SongPlayer song={seedSong} />}
                </div>

                <div className="recommendation-types">
                    <h3>Recommendation Type:</h3>
                    <div className="recommendation-buttons">
                        <button
                            className={recommendationType === 'content-based' ? 'active' : ''}
                            onClick={() => setRecommendationType('content-based')}
                        >
                            Similar Songs
                        </button>
                        <button
                            className={recommendationType === 'collaborative' ? 'active' : ''}
                            onClick={() => setRecommendationType('collaborative')}
                        >
                            Based on User Ratings
                        </button>
                        <button
                            className={recommendationType === 'hybrid' ? 'active' : ''}
                            onClick={() => setRecommendationType('hybrid')}
                        >
                            Hybrid Recommendations
                        </button>
                        <button
                            className={recommendationType === 'mood' ? 'active' : ''}
                            onClick={() => setRecommendationType('mood')}
                        >
                            Mood-Based
                        </button>
                    </div>
                </div>
            </div>

            <div className="recommendations-list">
                <h2>Recommended Songs</h2>
                {isLoading ? (
                    <p>Loading recommendations...</p>
                ) : recommendations.length > 0 ? (
                    <ul>
                        {recommendations.map((song, index) => (
                            <li key={index} onClick={() => setSelectedSong(song)}>
                                <div className="recommendation-item">
                                    {song.albumCover && (
                                        <img
                                            src={`http://localhost:5001${song.albumCover}`}
                                            alt={`${song.title} album cover`}
                                            className="recommendation-cover"
                                        />
                                    )}
                                    <div className="recommendation-info">
                                        <h3>{song.title}</h3>
                                        <p>{song.artist}</p>
                                        {song.similarity_score && (
                                            <p>Similarity: {(song.similarity_score * 100).toFixed(1)}%</p>
                                        )}
                                    </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No recommendations found</p>
                )}
            </div>

            {selectedSong && selectedSong.id !== seedSong.id && (
                <div className="selected-recommendation">
                    <h2>Selected Song</h2>
                    <SongPlayer song={selectedSong} />
                </div>
            )}

            <button onClick={() => navigate('/')} className="back-button">
                Back to Library
            </button>
        </div>
    );
};

export default RecommendationView;
