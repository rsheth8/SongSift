import React, { useState, useEffect } from 'react';
import AudioFeatureChart from './AudioFeatureChart';
import '../styling/songcomparison.css';

interface Song {
    id: string;
    title: string;
    artist: string;
    albumCover?: string;
    analysis?: any;
    features?: any;
}

interface SongComparisonProps {
    primarySong: Song;
    onClose: () => void;
}

const SongComparison: React.FC<SongComparisonProps> = ({ primarySong, onClose }) => {
    const [availableSongs, setAvailableSongs] = useState<Song[]>([]);
    const [selectedSong, setSelectedSong] = useState<Song | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [chartType, setChartType] = useState<'radar' | 'bar' | 'line'>('radar');
    const [primarySongFeatures, setPrimarySongFeatures] = useState<any>(null);
    const [selectedSongFeatures, setSelectedSongFeatures] = useState<any>(null);
    const [similaritiesCalculated, setSimilaritiesCalculated] = useState<{[key: string]: number}>({});
    const [showFullLibrary, setShowFullLibrary] = useState(false);

    // All available features for comparison
    const allFeatures = [
        'energy', 'danceability', 'valence', 'acousticness',
        'instrumentalness', 'speechiness', 'liveness'
    ];

    // Features to display in the key differences section
    const keyFeatures = ['energy', 'danceability', 'valence', 'acousticness', 'instrumentalness', 'speechiness'];

    useEffect(() => {
        fetchAvailableSongs();
        fetchPrimarySongFeatures();
    }, []);

    // Calculate similarities for top 5 songs when primary song features are loaded
    useEffect(() => {
        if (primarySongFeatures && availableSongs.length > 0) {
            calculateTopSimilarities();
        }
    }, [primarySongFeatures, availableSongs]);

    // Fetch full analysis for primary song
    const fetchPrimarySongFeatures = async () => {
        if (!primarySong) return;

        try {
            setIsLoading(true);
            const response = await fetch(`http://localhost:5001/api/analyze/${primarySong.id}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch primary song features');
            }

            const data = await response.json();
            const features = data.analysis || data.features;
            setPrimarySongFeatures(features);
        } catch (error) {
            console.error('Error fetching primary song features:', error);
            setPrimarySongFeatures(primarySong.analysis || primarySong.features);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch full analysis for selected song
    const fetchSelectedSongFeatures = async (songId: string) => {
        try {
            setIsLoading(true);
            const response = await fetch(`http://localhost:5001/api/analyze/${songId}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch selected song features');
            }

            const data = await response.json();
            const features = data.analysis || data.features;
            setSelectedSongFeatures(features);
        } catch (error) {
            console.error('Error fetching selected song features:', error);
            const song = availableSongs.find(s => s.id === songId);
            setSelectedSongFeatures(song?.analysis || song?.features);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchAvailableSongs = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('http://localhost:5001/api/songs');
            if (response.ok) {
                const songs = await response.json();
                const filteredSongs = songs.filter((song: Song) =>
                    song.id !== primarySong.id
                );
                setAvailableSongs(filteredSongs);
            }
        } catch (error) {
            console.error('Error fetching songs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate similarity for top 5 songs only
    const calculateTopSimilarities = async () => {
        if (!primarySongFeatures || availableSongs.length === 0) return;

        setIsLoading(true);
        const similarities: {[key: string]: number} = {};

        // Only analyze the first 5 songs initially for efficiency
        const songsToAnalyze = availableSongs.slice(0, 5);

        for (const song of songsToAnalyze) {
            try {
                const response = await fetch(`http://localhost:5001/api/analyze/${song.id}`);
                if (response.ok) {
                    const data = await response.json();
                    const songFeatures = data.analysis || data.features;
                    similarities[song.id] = calculateSimilarity(primarySongFeatures, songFeatures);
                }
            } catch (error) {
                console.error(`Error fetching features for song ${song.id}:`, error);
                similarities[song.id] = 0;
            }
        }

        setSimilaritiesCalculated(similarities);
        setIsLoading(false);
    };

    // Calculate similarity for a specific song (on-demand)
    const calculateSongSimilarity = async (songId: string) => {
        if (!primarySongFeatures) return 0;

        try {
            const response = await fetch(`http://localhost:5001/api/analyze/${songId}`);
            if (response.ok) {
                const data = await response.json();
                const songFeatures = data.analysis || data.features;
                const similarity = calculateSimilarity(primarySongFeatures, songFeatures);

                // Update the similarities state
                setSimilaritiesCalculated(prev => ({
                    ...prev,
                    [songId]: similarity
                }));

                return similarity;
            }
        } catch (error) {
            console.error(`Error fetching features for song ${songId}:`, error);
        }
        return 0;
    };

    const handleSongSelection = async (song: Song) => {
        setSelectedSong(song);
        setIsLoading(true);

        // If this song hasn't been analyzed yet, calculate its similarity
        if (similaritiesCalculated[song.id] === undefined) {
            await calculateSongSimilarity(song.id);
        }

        // Fetch full features for comparison
        await fetchSelectedSongFeatures(song.id);
        setIsLoading(false);
    };

    // MISSING FUNCTION - ADD THIS:
    const calculateSimilarity = (features1: any, features2: any) => {
        if (!features1 || !features2) return 0;

        let similarity = 0;
        let validFeatures = 0;

        allFeatures.forEach(feature => {
            if (features1[feature] !== undefined && features2[feature] !== undefined) {
                const val1 = typeof features1[feature] === 'number' ? features1[feature] : 0;
                const val2 = typeof features2[feature] === 'number' ? features2[feature] : 0;
                similarity += 1 - Math.abs(val1 - val2);
                validFeatures++;
            }
        });

        return validFeatures > 0 ? (similarity / validFeatures) * 100 : 0;
    };

    const getSimilarityColor = (similarity: number) => {
        if (similarity >= 80) return '#4ecdc4';
        if (similarity >= 60) return '#03dac6';
        if (similarity >= 40) return '#ffa726';
        return '#ff6b6b';
    };

    const formatFeatureName = (feature: string) => {
        return feature.charAt(0).toUpperCase() + feature.slice(1);
    };

    const getFeatureValue = (features: any, feature: string): number => {
        if (!features || features[feature] === undefined) return 0;
        const value = features[feature];
        return typeof value === 'number' ? value : 0;
    };

    // Filter songs by search term
    const searchFilteredSongs = availableSongs.filter(song =>
        song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        song.artist.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Separate analyzed and unanalyzed songs
    const analyzedSongs = searchFilteredSongs.filter(song =>
        similaritiesCalculated[song.id] !== undefined
    );
    const unanalyzedSongs = searchFilteredSongs.filter(song =>
        similaritiesCalculated[song.id] === undefined
    );

    // Sort analyzed songs by similarity
    const sortedAnalyzedSongs = analyzedSongs.sort((a, b) => {
        const similarityA = similaritiesCalculated[a.id] || 0;
        const similarityB = similaritiesCalculated[b.id] || 0;
        return similarityB - similarityA;
    });

    // Combine: analyzed songs first (sorted by similarity), then unanalyzed songs
    const allFilteredSongs = [...sortedAnalyzedSongs, ...unanalyzedSongs];

    // Show top 5 analyzed songs or full library based on user preference
    const filteredSongs = showFullLibrary ? allFilteredSongs : sortedAnalyzedSongs.slice(0, 5);

    return (
        <div className="song-comparison-overlay">
            <div className="song-comparison-modal">
                <div className="comparison-header">
                    <h2>Compare Songs</h2>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>

                <div className="comparison-content">
                    {/* Song Selection */}
                    <div className="song-selection">
                        <div className="primary-song">
                            <h3>Primary Song</h3>
                            <div className="song-card selected">
                                <div className="song-artwork">
                                    {primarySong.albumCover ? (
                                        <img src={`http://localhost:5001${primarySong.albumCover}`} alt="" />
                                    ) : (
                                        <div className="artwork-placeholder">🎵</div>
                                    )}
                                </div>
                                <div className="song-info">
                                    <h4>{primarySong.title}</h4>
                                    <p>{primarySong.artist}</p>
                                </div>
                            </div>
                        </div>

                        <div className="comparison-song">
                            <h3>Compare With</h3>
                            {selectedSong ? (
                                <div className="song-card selected">
                                    <div className="song-artwork">
                                        {selectedSong.albumCover ? (
                                            <img src={`http://localhost:5001${selectedSong.albumCover}`} alt="" />
                                        ) : (
                                            <div className="artwork-placeholder">🎵</div>
                                        )}
                                    </div>
                                    <div className="song-info">
                                        <h4>{selectedSong.title}</h4>
                                        <p>{selectedSong.artist}</p>
                                        {primarySongFeatures && selectedSongFeatures && (
                                            <div
                                                className="similarity-score"
                                                style={{ color: getSimilarityColor(calculateSimilarity(primarySongFeatures, selectedSongFeatures)) }}
                                            >
                                                {calculateSimilarity(primarySongFeatures, selectedSongFeatures).toFixed(1)}% Similar
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        className="remove-song-btn"
                                        onClick={() => {
                                            setSelectedSong(null);
                                            setSelectedSongFeatures(null);
                                        }}
                                    >
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <div className="song-selector">
                                    <div className="search-container">
                                        <input
                                            type="text"
                                            placeholder="Search for a song to compare..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="search-input"
                                        />
                                    </div>

                                    <div className={`song-list-scrollable ${showFullLibrary ? 'full-library' : ''}`}>
                                        {isLoading ? (
                                            <div className="loading">Loading songs...</div>
                                        ) : filteredSongs.length > 0 ? (
                                            <>
                                                <div className="similarity-header">
                                                    <span>
                                                        {showFullLibrary ? '📚 Full Library' : '🎯 Top 5 Similar Songs'}
                                                    </span>
                                                    <button
                                                        className="library-toggle-btn"
                                                        onClick={() => setShowFullLibrary(!showFullLibrary)}
                                                        data-tooltip={showFullLibrary ? 'Back to analyzed songs' : 'Browse all songs (analyze on-demand)'}
                                                    >
                                                        {showFullLibrary ? 'Show Top 5' : 'Show Entire Library'}
                                                    </button>
                                                </div>

                                                {filteredSongs.map(song => (
                                                    <div
                                                        key={song.id}
                                                        className="song-option"
                                                        onClick={() => handleSongSelection(song)}
                                                    >
                                                        <div className="song-artwork">
                                                            {song.albumCover ? (
                                                                <img src={`http://localhost:5001${song.albumCover}`}
                                                                     alt=""/>
                                                            ) : (
                                                                <div className="artwork-placeholder">🎵</div>
                                                            )}
                                                        </div>
                                                        <div className="song-info">
                                                            <h5>{song.title}</h5>
                                                            <p>{song.artist}</p>
                                                        </div>
                                                        <div className="similarity-preview">
                                                            {similaritiesCalculated[song.id] !== undefined ? (
                                                                <span
                                                                    className="similarity-percentage"
                                                                    style={{color: getSimilarityColor(similaritiesCalculated[song.id])}}
                                                                >
                                                                    {similaritiesCalculated[song.id].toFixed(1)}%
                                                                </span>
                                                            ) : showFullLibrary ? (
                                                                <span className="not-analyzed">Click to analyze</span>
                                                            ) : (
                                                                <span className="calculating">Analyzing...</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}

                                                {!showFullLibrary && allFilteredSongs.length > 5 && (
                                                    <div className="show-more-hint">
                                                        <span>+ {allFilteredSongs.length - 5} more songs available</span>
                                                        <small>Only top 5 analyzed for efficiency</small>
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="no-songs">
                                                {availableSongs.length === 0 ?
                                                    'No songs available for comparison' :
                                                    'No matching songs found'
                                                }
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Chart Controls and Comparison */}
                    {selectedSong && selectedSongFeatures && primarySongFeatures && (
                        <>
                            <div className="chart-controls">
                                <h3>Comparison Chart</h3>
                                <div className="chart-type-selector">
                                    {[
                                        {type: 'radar', label: 'Radar', icon: '🕸️'},
                                        {type: 'bar', label: 'Bar', icon: '📊'},
                                        {type: 'line', label: 'Line', icon: '📈'}
                                    ].map(chart => (
                                        <button
                                            key={chart.type}
                                            className={`chart-type-btn ${chartType === chart.type ? 'active' : ''}`}
                                            onClick={() => setChartType(chart.type as any)}
                                        >
                                            <span className="chart-icon">{chart.icon}</span>
                                            <span>{chart.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Comparison Chart */}
                            <div className="comparison-chart">
                                <AudioFeatureChart
                                    features={primarySongFeatures}
                                    comparisonFeatures={selectedSongFeatures}
                                    chartType={chartType}
                                    title="Audio Features Comparison"
                                />
                            </div>

                            {/* Feature Differences */}
                            <div className="feature-differences">
                                <h3>Key Differences</h3>
                                <div className="differences-grid">
                                    {keyFeatures.map(feature => {
                                        const primary = getFeatureValue(primarySongFeatures, feature);
                                        const comparison = getFeatureValue(selectedSongFeatures, feature);
                                        const difference = Math.abs(primary - comparison);
                                        const winner = primary > comparison ? 'primary' : 'comparison';

                                        return (
                                            <div key={feature} className="difference-item">
                                                <div className="feature-name">{formatFeatureName(feature)}</div>
                                                <div className="feature-comparison">
                                                    <div className={`feature-bar primary ${winner === 'primary' ? 'winner' : ''}`}>
                                                        <span>{(primary * 100).toFixed(0)}%</span>
                                                    </div>
                                                    <div className="difference-indicator">
                                                        <span className="difference-value">
                                                            {(difference * 100).toFixed(0)}% diff
                                                        </span>
                                                    </div>
                                                    <div className={`feature-bar comparison ${winner === 'comparison' ? 'winner' : ''}`}>
                                                        <span>{(comparison * 100).toFixed(0)}%</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Comparison Insights */}
                            <div className="comparison-insights">
                                <h3>Comparison Insights</h3>
                                <div className="insights-grid">
                                    <div className="insight-card">
                                        <h4>🎵 Musical Similarity</h4>
                                        <p>
                                            These songs are <strong>{calculateSimilarity(primarySongFeatures, selectedSongFeatures).toFixed(1)}% similar</strong> based on their audio characteristics.
                                        </p>
                                    </div>

                                    <div className="insight-card">
                                        <h4>🎯 Best Match For</h4>
                                        <p>
                                            {(() => {
                                                const similarity = calculateSimilarity(primarySongFeatures, selectedSongFeatures);
                                                if (similarity >= 80) return "Perfect for the same playlist or mood!";
                                                if (similarity >= 60) return "Good companions for similar listening sessions.";
                                                if (similarity >= 40) return "Interesting contrast while maintaining some common ground.";
                                                return "Very different styles - great for diverse playlists!";
                                            })()}
                                        </p>
                                    </div>

                                    <div className="insight-card">
                                        <h4>📊 Key Differences</h4>
                                        <p>
                                            {(() => {
                                                let maxDiff = 0;
                                                let maxDiffFeature = '';

                                                keyFeatures.forEach(feature => {
                                                    const diff = Math.abs(getFeatureValue(primarySongFeatures, feature) - getFeatureValue(selectedSongFeatures, feature));
                                                    if (diff > maxDiff) {
                                                        maxDiff = diff;
                                                        maxDiffFeature = feature;
                                                    }
                                                });

                                                return `Biggest difference is in ${formatFeatureName(maxDiffFeature).toLowerCase()} (${(maxDiff * 100).toFixed(0)}% difference)`;
                                            })()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SongComparison;
