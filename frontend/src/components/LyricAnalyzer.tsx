import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SongPlayer from './songplayer';

const LyricAnalyzer: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const song = location.state?.song;

    const [lyrics, setLyrics] = useState('');
    const [analysis, setAnalysis] = useState<any>(null);
    const [visualizations, setVisualizations] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (song) {
            fetchLyrics();
        }
    }, [song]);

    const fetchLyrics = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(
                `http://localhost:5001/api/lyrics/fetch?artist=${encodeURIComponent(song.artist)}&title=${encodeURIComponent(song.title)}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch lyrics');
            }

            const data = await response.json();
            setLyrics(data.lyrics);

            // Automatically analyze lyrics once fetched
            if (data.lyrics && !data.lyrics.startsWith('No lyrics found')) {
                analyzeLyrics(data.lyrics);
            }
        } catch (error) {
            console.error('Error fetching lyrics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const analyzeLyrics = async (lyricsText: string) => {
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:5001/api/lyrics/analyze', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ lyrics: lyricsText })
            });

            if (!response.ok) {
                throw new Error('Failed to analyze lyrics');
            }

            const data = await response.json();
            setAnalysis(data.analysis);
            setVisualizations(data.visualizations);
        } catch (error) {
            console.error('Error analyzing lyrics:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!song) {
        return <div>No song selected</div>;
    }

    return (
        <div className="lyric-analyzer">
            <h1>Lyric Analysis: {song.title}</h1>

            <div className="song-player-section">
                <SongPlayer song={song} />
            </div>

            <div className="lyrics-section">
                <h2>Lyrics</h2>
                {isLoading && !lyrics ? (
                    <p>Loading lyrics...</p>
                ) : (
                    <div className="lyrics-text">
                        {lyrics ? (
                            <pre>{lyrics}</pre>
                        ) : (
                            <p>No lyrics found for this song.</p>
                        )}
                    </div>
                )}
            </div>

            {analysis && (
                <div className="analysis-section">
                    <h2>Sentiment Analysis</h2>
                    <div className="sentiment-results">
                        <div className="sentiment-score">
                            <h3>Overall Sentiment: {analysis.sentiment.overall}</h3>
                            <p>Compound Score: {analysis.sentiment.compound.toFixed(2)}</p>
                            <div className="sentiment-breakdown">
                                <div className="sentiment-item">
                                    <span>Positive:</span>
                                    <span>{(analysis.sentiment.pos * 100).toFixed(1)}%</span>
                                </div>
                                <div className="sentiment-item">
                                    <span>Neutral:</span>
                                    <span>{(analysis.sentiment.neu * 100).toFixed(1)}%</span>
                                </div>
                                <div className="sentiment-item">
                                    <span>Negative:</span>
                                    <span>{(analysis.sentiment.neg * 100).toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>

                        {visualizations && (
                            <div className="sentiment-visualization">
                                <img
                                    src={`http://localhost:5001${visualizations.sentiment}`}
                                    alt="Sentiment visualization"
                                />
                            </div>
                        )}
                    </div>

                    <h2>Emotions</h2>
                    {visualizations && (
                        <div className="emotions-visualization">
                            <img
                                src={`http://localhost:5001${visualizations.emotions}`}
                                alt="Emotions visualization"
                            />
                        </div>
                    )}

                    <h2>Key Words</h2>
                    <div className="keywords-list">
                        {analysis.keywords.map((keyword: [string, number], index: number) => (
                            <div key={index} className="keyword-item">
                                <span className="keyword">{keyword[0]}</span>
                                <span className="keyword-count">{keyword[1]}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <button onClick={() => navigate('/')} className="back-button">
                Back to Library
            </button>
        </div>
    );
};

export default LyricAnalyzer;
