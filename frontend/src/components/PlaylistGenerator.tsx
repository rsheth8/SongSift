import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SongPlayer from './songplayer';
import '../styling/playlists.css';

const PlaylistGenerator: React.FC = () => {
    const navigate = useNavigate();
    const [songs, setSongs] = useState<any[]>([]);
    const [selectedSongs, setSelectedSongs] = useState<string[]>([]);
    const [numClusters, setNumClusters] = useState(3);
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [visualizationUrl, setVisualizationUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentPlaylist, setCurrentPlaylist] = useState<any>(null);
    const [currentSong, setCurrentSong] = useState<any>(null);

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

    const toggleSongSelection = (songId: string) => {
        setSelectedSongs(prev => {
            if (prev.includes(songId)) {
                return prev.filter(id => id !== songId);
            } else {
                return [...prev, songId];
            }
        });
    };

    const selectAllSongs = () => {
        setSelectedSongs(songs.map(song => song.id));
    };

    const deselectAllSongs = () => {
        setSelectedSongs([]);
    };

    const generatePlaylists = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('http://localhost:5001/api/playlists/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    song_ids: selectedSongs.length > 0 ? selectedSongs : undefined,
                    num_clusters: numClusters,
                    user_id: '1' // Default user ID for demo
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server error:', errorText);
                throw new Error('Failed to generate playlists');
            }

            const data = await response.json();
            console.log('Generated playlists:', data);
            setPlaylists(data.playlists);
            setVisualizationUrl(data.visualization_url);

            // Select the first playlist by default
            if (data.playlists.length > 0) {
                setCurrentPlaylist(data.playlists[0]);
            }
        } catch (error) {
            console.error('Error generating playlists:', error);
            alert('Failed to generate playlists. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="playlist-generator">
            {/* Enhanced Header */}
            <div className="playlist-header">
                <div className="header-content">
                    <div className="header-title">
                        <span className="header-icon">🎵</span>
                        <div>
                            <h1>Playlist Generator</h1>
                            <p className="header-subtitle">Discover your perfect playlists through AI-powered clustering and audio analysis</p>
                        </div>
                    </div>
                    <button onClick={() => navigate('/')} className="back-button">
                        ← Back to Library
                    </button>
                </div>
            </div>

            {/* Main Container */}
            <div className="main-container">
                {/* Control Panel */}
                <div className="control-panel">
                    <div className="control-section">
                        <h3 className="control-title">
                            <span className="control-icon">⚙️</span>
                            Generation Settings
                        </h3>
                        <div className="cluster-control">
                            <label htmlFor="clusters">Number of Playlists</label>
                            <div className="cluster-slider-container">
                                <input
                                    type="range"
                                    id="clusters"
                                    min="2"
                                    max="10"
                                    value={numClusters}
                                    onChange={(e) => setNumClusters(parseInt(e.target.value))}
                                    className="cluster-slider"
                                />
                                <div className="cluster-value">{numClusters}</div>
                            </div>
                        </div>
                        <button
                            onClick={generatePlaylists}
                            disabled={isLoading || songs.length < numClusters}
                            className="generate-button"
                        >
                            {isLoading ? (
                                <>
                                    <div className="loading-spinner"></div>
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <span className="button-icon">🚀</span>
                                    Generate Playlists
                                </>
                            )}
                        </button>
                    </div>

                    {/* Visualization in Control Panel */}
                    {visualizationUrl && (
                        <div className="control-section">
                            <h3 className="control-title">
                                <span className="control-icon">📊</span>
                                Cluster Analysis
                            </h3>
                            <div className="visualization-container">
                                <img
                                    src={`http://localhost:5001${visualizationUrl}`}
                                    alt="Playlist clusters visualization"
                                    className="cluster-visualization"
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Content Area */}
                <div className="content-area">
                    {/* Song Selection */}
                    <div className="song-selection-section">
                        <div className="section-header">
                            <h2 className="section-title">
                                <span className="section-icon">🎶</span>
                                Song Selection
                            </h2>
                            <div className="selection-controls">
                                <button onClick={selectAllSongs} className="control-button">
                                    Select All
                                </button>
                                <button onClick={deselectAllSongs} className="control-button">
                                    Deselect All
                                </button>
                                <span className="selection-count">
                                    {selectedSongs.length > 0 ? `${selectedSongs.length} selected` : 'All songs will be used'}
                                </span>
                            </div>
                        </div>
                        <p className="section-description">
                            Leave empty to use all songs, or select specific songs to cluster
                        </p>

                        <div className="songs-grid">
                            {songs.map(song => (
                                <div
                                    key={song.id}
                                    className={`song-card ${selectedSongs.includes(song.id) ? 'selected' : ''}`}
                                    onClick={() => toggleSongSelection(song.id)}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`${selectedSongs.includes(song.id) ? 'Deselect' : 'Select'} song: ${song.title} by ${song.artist}`}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            toggleSongSelection(song.id);
                                        }
                                    }}
                                >
                                    {song.albumCover ? (
                                        <img
                                            src={`http://localhost:5001${song.albumCover}`}
                                            alt={`Album cover for ${song.title} by ${song.artist}`}
                                            className="song-card-cover"
                                        />
                                    ) : (
                                        <div className="song-card-cover song-card-placeholder">
                                            <span className="placeholder-icon">🎵</span>
                                        </div>
                                    )}
                                    <div className="song-card-details">
                                        <h3 className="song-card-title">{song.title}</h3>
                                        <p className="song-card-artist">{song.artist}</p>
                                    </div>
                                    {selectedSongs.includes(song.id) && (
                                        <div className="selection-indicator">
                                            <span className="checkmark">✓</span>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Generated Playlists */}
                    {playlists.length > 0 && (
                        <div className="playlist-results">
                            <div className="section-header">
                                <h2 className="section-title">
                                    <span className="section-icon">📋</span>
                                    Generated Playlists
                                </h2>
                            </div>

                            <div className="playlists-grid">
                                <div className="playlist-sidebar">
                                    <h3 className="sidebar-title">Your Playlists</h3>
                                    {playlists.map(playlist => (
                                        <div
                                            key={playlist.id}
                                            className={`playlist-item ${currentPlaylist?.id === playlist.id ? 'active' : ''}`}
                                            onClick={() => setCurrentPlaylist(playlist)}
                                            role="button"
                                            tabIndex={0}
                                            aria-label={`Select playlist: ${playlist.name}`}
                                        >
                                            <div className="playlist-info">
                                                <h4 className="playlist-name">{playlist.name}</h4>
                                                <p className="playlist-count">
                                                    {playlist.song_details ? playlist.song_details.length : playlist.songs.length} songs
                                                </p>
                                            </div>
                                            <div className="playlist-icon">🎵</div>
                                        </div>
                                    ))}
                                </div>

                                {currentPlaylist && (
                                    <div className="playlist-content">
                                        <div className="playlist-header-section">
                                            <h3 className="playlist-title">{currentPlaylist.name}</h3>
                                            <p className="playlist-description">
                                                {currentPlaylist.song_details?.length || 0} songs • AI-generated playlist
                                            </p>
                                        </div>

                                        <div className="playlist-songs-container">
                                            <ul className="playlist-songs">
                                                {(currentPlaylist.song_details || []).map((song: any, index: number) => (
                                                    <li
                                                        key={song.id}
                                                        className={`playlist-song-item ${currentSong?.id === song.id ? 'playing' : ''}`}
                                                        onClick={() => setCurrentSong(song)}
                                                        role="button"
                                                        tabIndex={0}
                                                        aria-label={`Play ${song.title} by ${song.artist}`}
                                                    >
                                                        <div className="song-number">{index + 1}</div>
                                                        <div className="song-info">
                                                            <span className="song-title">{song.title}</span>
                                                            <span className="song-artist">{song.artist}</span>
                                                        </div>
                                                        <div className="song-actions">
                                                            {currentSong?.id === song.id ? (
                                                                <span className="now-playing-indicator">♪</span>
                                                            ) : (
                                                                <span className="play-icon">▶</span>
                                                            )}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {currentSong && (
                                <div className="playlist-player">
                                    <div className="player-header">
                                        <h3 className="player-title">
                                            <span className="player-icon">🎧</span>
                                            Now Playing
                                        </h3>
                                    </div>
                                    <SongPlayer
                                        song={currentSong}
                                        playlist={currentPlaylist.song_details}
                                        currentIndex={currentPlaylist.song_details.findIndex((s: any) => s.id === currentSong.id)}
                                        onSongChange={(index) => setCurrentSong(currentPlaylist.song_details[index])}
                                        playlistMode={true}
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlaylistGenerator;
