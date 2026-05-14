import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SongPlayer from './songplayer';
import '../styling/musicmap.css';

const MusicMapExplorer: React.FC = () => {
    const navigate = useNavigate();
    const [songs, setSongs] = useState<any[]>([]);
    const [mapUrl, setMapUrl] = useState('');
    const [sourceSong, setSourceSong] = useState<any>(null);
    const [targetSong, setTargetSong] = useState<any>(null);
    const [pathType, setPathType] = useState('shortest');
    const [musicPath, setMusicPath] = useState<any>(null);
    const [currentSong, setCurrentSong] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [mapStats, setMapStats] = useState<any>(null);
    const [minPathLength, setMinPathLength] = useState<number>(3);

    // Reference for debouncing the path length changes
    const minPathLengthTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (minPathLengthTimeoutRef.current) {
                clearTimeout(minPathLengthTimeoutRef.current);
            }
        };
    }, []);

    // Reset music path when source or target song changes
    useEffect(() => {
        if (musicPath) {
            setMusicPath(null);
            setCurrentSong(null);
        }
    }, [sourceSong, targetSong]);

    useEffect(() => {
        // Fetch all songs
        const fetchSongs = async () => {
            try {
                const response = await fetch('http://localhost:5001/api/songs');
                if (response.ok) {
                    const data = await response.json();
                    setSongs(data);
                }
            } catch (error) {
                console.error('Error fetching songs:', error);
            }
        };

        fetchSongs();
    }, []);

    const generateMusicMap = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:5001/api/graph/music-map');

            if (!response.ok) {
                throw new Error('Failed to generate music map');
            }

            const data = await response.json();
            setMapUrl(data.music_map_url);
            setMapStats(data.stats);
        } catch (error) {
            console.error('Error generating music map:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const findPath = async () => {
        if (!sourceSong || !targetSong) return;

        setMusicPath(null);
        setCurrentSong(null);
        setIsLoading(true);

        try {
            console.log(`Finding path with minimum length: ${minPathLength}`);
            console.log(`Source: ${sourceSong.title}, Target: ${targetSong.title}`);

            const response = await fetch(
                `http://localhost:5001/api/graph/path?source=${sourceSong.id}&target=${targetSong.id}&type=${pathType}&min_length=${minPathLength}`
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Path finding error:", errorText);
                throw new Error(`Failed to find path: ${response.status}`);
            }

            const data = await response.json();
            console.log("Path response:", data);

            if (data.path && data.path.length < minPathLength) {
                console.warn(`Path found only has ${data.path.length} songs, but minimum requested was ${minPathLength}`);
            }

            setMusicPath(data);

            if (data.path && data.path.length > 0) {
                setCurrentSong(data.path[0]);
            }

            // Log visualization URL for debugging
            if (data.path_visualization) {
                console.log('Visualization URL:', `http://localhost:5001${data.path_visualization}`);
            } else {
                console.log('No visualization URL in response');
            }

        } catch (error) {
            console.error('Error finding path:', error);
            alert(`Couldn't find a path with ${minPathLength} songs. Try different songs or settings.`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMinPathLengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = parseInt(e.target.value);
        setMinPathLength(newValue);

        // Clear any existing timeout
        if (minPathLengthTimeoutRef.current) {
            clearTimeout(minPathLengthTimeoutRef.current);
        }

        // Only update the path if we already have one
        if (musicPath && sourceSong && targetSong && !isLoading) {
            // Set a new timeout to update after 500ms of no changes
            minPathLengthTimeoutRef.current = setTimeout(() => {
                findPath();
            }, 500);
        }
    };

    const generateJourney = async () => {
        if (!sourceSong) return;

        setIsLoading(true);
        try {
            const response = await fetch(
                `http://localhost:5001/api/graph/path?source=${sourceSong.id}&target=${targetSong.id}&type=${pathType}&min_length=${minPathLength}`
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Path finding error:", errorText);
                throw new Error(`Failed to find path: ${response.status}`);
            }

            // Get response as text first to check for NaN issues
            const responseText = await response.text();
            console.log("Raw response:", responseText.substring(0, 500)); // Log first 500 chars

            // Clean any NaN values before parsing
            const cleanedResponse = responseText.replace(/:\s*NaN\b/g, ': null')
                .replace(/:\s*Infinity\b/g, ': null')
                .replace(/:\s*-Infinity\b/g, ': null');

            const data = JSON.parse(cleanedResponse);


            // Format the journey data to match the path structure
            setMusicPath({
                source: data.seed_song,
                path: data.journey,
                path_type: 'journey',
                path_visualization: null
            });

            // Set the first song in the journey as current
            if (data.journey && data.journey.length > 0) {
                setCurrentSong(data.journey[0]);
            }
        } catch (error) {
            console.error('Error generating journey:', error);
            alert('Could not generate journey. You may need more songs in your library or songs with more similar features.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="music-map-explorer-container">
            <header className="explorer-header">
                <h1>Music Map Explorer</h1>
                <p className="subtitle">Discover connections between your songs</p>
            </header>

            <div className="main-content">
                <section className="map-section">
                    <div className="map-controls">
                        <button
                            onClick={generateMusicMap}
                            disabled={isLoading || songs.length < 5}
                            className="primary-button map-button"
                        >
                            {isLoading ?
                                <><span className="spinner"></span>Generating...</> :
                                <>🌍 Generate Music Map</>
                            }
                        </button>
                    </div>

                    {mapUrl && (
                        <div className="music-map">
                            <h2>Your Music Universe</h2>
                            <div className="map-container">
                                <img src={`http://localhost:5001${mapUrl}`} alt="Music Map" />
                            </div>

                            {mapStats && (
                                <div className="map-stats">
                                    <h3>Map Statistics</h3>
                                    <div className="stats-grid">
                                        <div className="stat-item">
                                            <span className="stat-label">Songs</span>
                                            <span className="stat-value">{mapStats.num_nodes}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Connections</span>
                                            <span className="stat-value">{mapStats.num_edges}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Avg. Connections</span>
                                            <span className="stat-value">{mapStats.avg_degree.toFixed(2)}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Components</span>
                                            <span className="stat-value">{mapStats.connected_components}</span>
                                        </div>
                                        <div className="stat-item">
                                            <span className="stat-label">Diameter</span>
                                            <span className="stat-value">{mapStats.diameter}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </section>

                <section className="path-finder-section">
                    <div className="path-finder-container">
                        <h2>Find a Path Between Songs</h2>

                        <div className="path-finder-grid">
                            <div className="path-controls-panel">
                                <div className="song-selectors">
                                    <div className="song-selector">
                                        <label>Starting Song:</label>
                                        <select
                                            value={sourceSong?.id || ''}
                                            onChange={(e) => {
                                                const song = songs.find(s => s.id === e.target.value);
                                                setSourceSong(song || null);
                                            }}
                                        >
                                            <option value="">Select a song</option>
                                            {songs.map(song => (
                                                <option key={song.id} value={song.id}>
                                                    {song.title} - {song.artist}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="song-selector">
                                        <label>Destination Song:</label>
                                        <select
                                            value={targetSong?.id || ''}
                                            onChange={(e) => {
                                                const song = songs.find(s => s.id === e.target.value);
                                                setTargetSong(song || null);
                                            }}
                                        >
                                            <option value="">Select a song</option>
                                            {songs.map(song => (
                                                <option key={song.id} value={song.id}>
                                                    {song.title} - {song.artist}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="path-options">
                                    <div className="path-type-selector">
                                        <label>Path Type:</label>
                                        <select
                                            value={pathType}
                                            onChange={(e) => setPathType(e.target.value)}
                                        >
                                            <option value="shortest">Shortest Path</option>
                                            <option value="diverse">Most Diverse Path</option>
                                            <option value="smooth">Smooth Transition Path</option>
                                        </select>
                                    </div>

                                    <div className="min-path-length">
                                        <label>Minimum Songs: <span className="min-length-value">{minPathLength}</span></label>
                                        <input
                                            type="range"
                                            min="2"
                                            max="10"
                                            value={minPathLength}
                                            onChange={handleMinPathLengthChange}
                                            className="path-length-slider"
                                        />
                                        <div className="slider-markers">
                                            <span>2</span>
                                            <span>6</span>
                                            <span>10</span>
                                        </div>
                                    </div>

                                    <div className="path-buttons">
                                        <button
                                            onClick={findPath}
                                            disabled={isLoading || !sourceSong || !targetSong}
                                            className="primary-button find-path-button"
                                        >
                                            {isLoading ? 'Finding Path...' : '🔍 Find Path'}
                                        </button>

                                        <button
                                            onClick={generateJourney}
                                            disabled={isLoading || !sourceSong}
                                            className="secondary-button journey-button"
                                        >
                                            🚀 Generate Journey
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {musicPath && (
                                <div className="path-results-panel">
                                    <div className="path-header">
                                        <h3>
                                            {musicPath.path_type === 'journey'
                                                ? '🎵 Musical Journey'
                                                : `🔄 ${pathType.charAt(0).toUpperCase() + pathType.slice(1)} Path`}
                                        </h3>

                                        {musicPath && musicPath.path && (
                                            <div className="path-info">
                                                <div className="path-info-item">
                                                    <span className="info-label">Path Length:</span>
                                                    <span className="info-value">{musicPath.path.length} songs</span>
                                                </div>
                                                <div className="path-info-item">
                                                    <span className="info-label">Requested:</span>
                                                    <span className="info-value">{minPathLength} songs</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {musicPath.path_visualization && (
                                        <div className="path-visualization">
                                            <h4>Path Visualization:</h4>
                                            <div className="visualization-container">
                                                <img
                                                    key={`path-viz-${Date.now()}`}
                                                    src={`http://localhost:5001${musicPath.path_visualization}?t=${Date.now()}`}
                                                    alt="Path visualization"
                                                    onLoad={() => console.log('Visualization loaded successfully')}
                                                    onError={(e) => {
                                                        console.error('Failed to load visualization:', e);
                                                        console.log('Attempted URL:', `http://localhost:5001${musicPath.path_visualization}`);
                                                    }}
                                                    style={{ maxWidth: '100%', height: 'auto' }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="path-songs">
                                        <h4>Songs in Path:</h4>
                                        <div className="path-list">
                                            {musicPath.path.map((song: any, index: number) => (
                                                <div
                                                    key={index}
                                                    className={`path-item ${currentSong?.id === song.id ? 'active' : ''}`}
                                                    onClick={() => setCurrentSong(song)}
                                                >
                                                    <div className="path-number">{index + 1}</div>
                                                    <div className="path-song-info">
                                                        <h4>{song.title}</h4>
                                                        <p>{song.artist}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {currentSong && (
                                        <div className="path-player">
                                            <h4>Now Playing:</h4>
                                            <SongPlayer
                                                song={currentSong}
                                                playlist={musicPath.path}
                                                currentIndex={musicPath.path.findIndex((s: any) => s.id === currentSong.id)}
                                                onSongChange={(index) => setCurrentSong(musicPath.path[index])}
                                                playlistMode={true}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            <button onClick={() => navigate('/')} className="back-button">
                ← Back to Library
            </button>
        </div>
    );
};

export default MusicMapExplorer;
