import React, { useEffect, useState } from "react";
import "../styling/fileupload.css";
import SongPlayer from "./songplayer";
import { useNavigate } from 'react-router-dom';

interface SongData {
    id: string;
    title: string;
    artist: string;
    albumCover: string | "";
    audioUrl: string;
    waveformUrl?: string;
    features?: {
        tempo: number;
        key: string;
        energy: number;
        danceability?: number;
        acousticness?: number;
        instrumentalness?: number;
        valence?: number;
    };
    analysis?: {
        tempo: number;
        key: string;
        energy: number;
    };
    isAnalyzed: boolean;
    fileSize?: number;
    dateAdded?: string;
}

const FileUpload: React.FC = () => {
    useEffect(() => {
        localStorage.clear();
    }, []);

    const [files, setFiles] = useState<File[]>([]);
    const [songs, setSongs] = useState<SongData[]>([]);
    const [selectedSong, setSelectedSong] = useState<SongData | null>(null);
    const [analyzedSongs, setAnalyzedSongs] = useState<SongData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [sortBy, setSortBy] = useState<'title' | 'artist' | 'dateAdded'>('title');
    const navigate = useNavigate();

    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'analyzing' | 'success' | 'error'>('idle');
    const [currentlyProcessing, setCurrentlyProcessing] = useState<string>('');
    const [processedCount, setProcessedCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);


    useEffect(() => {
        const fetchSongs = async () => {
            try {
                const response = await fetch("http://localhost:5001/api/songs");
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.length > 0) {
                        setSongs(data);
                        const analyzed = data.filter((song: SongData) => song.isAnalyzed);
                        setAnalyzedSongs(analyzed);
                    }
                }
            } catch (error) {
                console.error("Error fetching songs:", error);
            }
        };

        fetchSongs();
    }, []);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const newFiles = Array.from(event.target.files);
            const uniqueFiles = newFiles.filter(
                (newFile) => !files.some((file) => file.name === newFile.name)
            );
            setFiles((prevFiles) => [...prevFiles, ...uniqueFiles]);
        }
    };

    const removeFile = (indexToRemove: number) => {
        setFiles(files.filter((_, index) => index !== indexToRemove));
    };

    const handleUpload = async () => {
        if (files.length === 0) {
            alert("Please select one or more files first!");
            return;
        }

        setIsLoading(true);
        setUploadProgress(0);
        setUploadStatus('uploading');
        setProcessedCount(0);
        setTotalCount(files.length);
        setCurrentlyProcessing('Preparing files for upload...');

        try {
            const formData = new FormData();
            files.forEach((file) => formData.append("files[]", file));

            setCurrentlyProcessing('Uploading files to server...');

            const response = await fetch("http://localhost:5001/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Server error:", errorText);
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }

            const responseData = await response.json();
            console.log("Upload response:", responseData);

            // Handle different response formats
            let data: SongData[] = [];

            if (Array.isArray(responseData)) {
                data = responseData;
            } else if (responseData && typeof responseData === 'object') {
                const possibleArrays = ['songs', 'data', 'results', 'tracks'];
                for (const prop of possibleArrays) {
                    if (responseData[prop] && Array.isArray(responseData[prop])) {
                        data = responseData[prop];
                        break;
                    }
                }
            }

            if (!Array.isArray(data) || data.length === 0) {
                console.error("No valid song data received:", responseData);
                throw new Error("No songs were processed successfully");
            }

            // Filter out duplicates
            const uniqueSongs = data.filter(
                (newSong) => !songs.some((song) => song.id === newSong.id)
            );

            const songsWithAnalysisStatus = uniqueSongs.map(song => ({
                ...song,
                analysis: song.analysis || { tempo: 0, key: '', energy: 0 },
                isAnalyzed: song.isAnalyzed || false,
                dateAdded: new Date().toISOString()
            }));

            // Add songs to the main list first
            setSongs((prevSongs) => [...prevSongs, ...songsWithAnalysisStatus]);
            setFiles([]);
            setUploadProgress(50);
            setUploadStatus('analyzing');
            setCurrentlyProcessing('Starting audio analysis...');

            // Now automatically analyze each uploaded song
            console.log(`Starting automatic analysis of ${songsWithAnalysisStatus.length} songs...`);

            const analyzedSongs: SongData[] = [];

            for (let i = 0; i < songsWithAnalysisStatus.length; i++) {
                const song = songsWithAnalysisStatus[i];

                setCurrentlyProcessing(`Analyzing "${song.title}" by ${song.artist}...`);
                setProcessedCount(i);

                try {
                    console.log(`Analyzing song ${i + 1}/${songsWithAnalysisStatus.length}: ${song.title}`);

                    const analysisResponse = await fetch(`http://localhost:5001/api/analyze/${song.id}`, {
                        method: 'GET',
                    });

                    if (analysisResponse.ok) {
                        const analysisData = await analysisResponse.json();

                        const analyzedSong = {
                            ...song,
                            analysis: analysisData.analysis,
                            features: analysisData.analysis,
                            isAnalyzed: true
                        };

                        analyzedSongs.push(analyzedSong);

                        // Update songs list in real-time
                        setSongs(prevSongs =>
                            prevSongs.map(s =>
                                s.id === song.id ? analyzedSong : s
                            )
                        );

                        // Update analyzed songs list in real-time
                        setAnalyzedSongs(prevAnalyzed => {
                            const existingIndex = prevAnalyzed.findIndex(s => s.id === song.id);
                            if (existingIndex !== -1) {
                                const updated = [...prevAnalyzed];
                                updated[existingIndex] = analyzedSong;
                                return updated;
                            } else {
                                return [...prevAnalyzed, analyzedSong];
                            }
                        });

                        console.log(`✓ Analysis complete for: ${song.title}`);
                    } else {
                        console.warn(`Failed to analyze: ${song.title}`);
                    }

                    // Update progress
                    const analysisProgress = 50 + ((i + 1) / songsWithAnalysisStatus.length) * 50;
                    setUploadProgress(analysisProgress);

                } catch (error) {
                    console.error(`Error analyzing ${song.title}:`, error);
                }
            }

            setUploadProgress(100);
            setUploadStatus('success');
            setProcessedCount(songsWithAnalysisStatus.length);
            setCurrentlyProcessing('All files processed successfully!');

            // const successMessage = analyzedSongs.length === songsWithAnalysisStatus.length
            //     ? `Successfully uploaded and analyzed ${analyzedSongs.length} songs!`
            //     : `Uploaded ${songsWithAnalysisStatus.length} songs. ${analyzedSongs.length} analyzed successfully.`;

            setTimeout(() => {
                setUploadStatus('idle');
                setCurrentlyProcessing('');
            }, 3000);

        } catch (error) {
            console.error("Error uploading files:", error);
            setUploadStatus('error');
            setCurrentlyProcessing(`Error: ${error || 'Unknown error occurred'}`);
            setTimeout(() => {
                setUploadStatus('idle');
                setCurrentlyProcessing('');
            }, 5000);
        } finally {
            setIsLoading(false);
            setTimeout(() => setUploadProgress(0), 3000);
        }
    };

    const handleAnalyze = async () => {
        if (selectedSong) {
            try {
                setIsLoading(true);
                const response = await fetch(`http://localhost:5001/api/analyze/${selectedSong.id}`, {
                    method: 'GET',
                });

                if (!response.ok) {
                    throw new Error('Failed to analyze song');
                }

                const analysisData = await response.json();

                setAnalyzedSongs(prevSongs => {
                    const existingSongIndex = prevSongs.findIndex(song => song.id === selectedSong.id);
                    if (existingSongIndex !== -1) {
                        const updatedSongs = [...prevSongs];
                        updatedSongs[existingSongIndex] = {
                            ...updatedSongs[existingSongIndex],
                            analysis: analysisData.analysis,
                            features: analysisData.analysis,
                            isAnalyzed: true
                        };
                        return updatedSongs;
                    } else {
                        return [...prevSongs, {
                            ...selectedSong,
                            analysis: analysisData.analysis,
                            features: analysisData.analysis,
                            isAnalyzed: true
                        }];
                    }
                });

                setSongs(prevSongs => {
                    return prevSongs.map(song =>
                        song.id === selectedSong.id ? {
                            ...song,
                            analysis: analysisData.analysis,
                            features: analysisData.analysis,
                            isAnalyzed: true
                        } : song
                    );
                });

                setSelectedSong(prevSong => ({
                    ...prevSong!,
                    analysis: analysisData.analysis,
                    features: analysisData.analysis,
                    isAnalyzed: true
                }));

            } catch (error) {
                console.error('Error analyzing song:', error);
                alert('An error occurred while analyzing the song.');
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleInDepthAnalysis = () => {
        if (selectedSong && selectedSong.isAnalyzed) {
            navigate('/in-depth-analysis', {
                state: {
                    song: selectedSong,
                    previousPageState: {
                        files,
                        songs,
                        selectedSong,
                        analyzedSongs,
                        isLoading
                    }
                }
            });
        }
    };

    const navigateToRecommendations = () => {
        if (selectedSong) {
            navigate('/recommendations', {
                state: { song: selectedSong }
            });
        }
    };

    const navigateToPlaylists = () => {
        navigate('/playlists/generate');
    };

    const navigateToMusicMap = () => {
        navigate('/music-map');
    };

    const navigateToLyrics = () => {
        if (selectedSong) {
            navigate('/lyrics', {
                state: { song: selectedSong }
            });
        }
    };

    const navigateToMashup = () => {
        navigate('/mashup');
    };

    const getLibraryStats = () => {
        const totalSongs = songs.length;
        const analyzedCount = analyzedSongs.length;
        const analysisPercentage = totalSongs > 0 ? Math.round((analyzedCount / totalSongs) * 100) : 0;
        const totalSize = songs.reduce((acc, song) => acc + (song.fileSize || 0), 0);

        return { totalSongs, analyzedCount, analysisPercentage, totalSize };
    };

    const stats = getLibraryStats();

    const filteredAndSortedSongs = songs
        .filter(song =>
            song.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            song.artist.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            switch (sortBy) {
                case 'artist':
                    return a.artist.localeCompare(b.artist);
                case 'dateAdded':
                    return new Date(b.dateAdded || 0).getTime() - new Date(a.dateAdded || 0).getTime();
                default:
                    return a.title.localeCompare(b.title);
            }
        });

    return (
        <div className="tunesift-app">
            {/* Enhanced Header with Better Space Usage */}
            <header className="app-header-enhanced">
                <div className="header-container">
                    <div className="brand-section">
                        <div className="brand-logo">
                            <span className="logo-icon">🎵</span>
                            <div className="brand-text">
                                <h1>TuneSift</h1>
                                <span className="tagline">AI-Powered Music Discovery</span>
                            </div>
                        </div>
                    </div>

                    <div className="header-stats-dashboard">
                        <div className="stat-card">
                            <div className="stat-icon">📚</div>
                            <div className="stat-content">
                                <span className="stat-value">{stats.totalSongs}</span>
                                <span className="stat-label">Songs</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">🔬</div>
                            <div className="stat-content">
                                <span className="stat-value">{stats.analyzedCount}</span>
                                <span className="stat-label">Analyzed</span>
                            </div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-icon">📊</div>
                            <div className="stat-content">
                                <span className="stat-value">{stats.analysisPercentage}%</span>
                                <span className="stat-label">Complete</span>
                            </div>
                        </div>
                    </div>

                    <div className="header-actions">
                        <button className="quick-upload-btn" onClick={() => document.getElementById('file-upload')?.click()}>
                            <span className="btn-icon">⬆️</span>
                            Quick Upload
                        </button>
                    </div>
                </div>
            </header>

            {/* Hero Section for Better First Impression */}
            <section className="hero-section">
                <div className="hero-container">
                    <div className="hero-content">
                        <h2>Transform Your Music Library</h2>
                        <p>Upload, analyze, and discover connections in your music with AI-powered insights</p>

                        <div className="quick-upload-zone">
                            <input
                                type="file"
                                accept=".mp3,.wav,.ogg,.flac"
                                multiple
                                onChange={handleFileChange}
                                id="file-upload"
                                className="file-input-hidden"
                            />
                            <label htmlFor="file-upload" className="upload-drop-zone">
                                <div className="upload-icon">📁</div>
                                <h3>Drop files here or click to browse</h3>
                                <p>Supports MP3, WAV, OGG, FLAC</p>
                                {files.length > 0 && (
                                    <div className="files-ready">
                                        <span className="files-count">{files.length} files ready</span>
                                        <button onClick={handleUpload} className="upload-now-btn">
                                            Upload Now
                                        </button>
                                    </div>
                                )}
                            </label>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content Area with Better Space Distribution */}
            <main className="main-content-area">
                <div className="content-container content-container--wide">

                    {/* Music Library Section - Now Wider */}
                    <section className="library-section">
                        <div className="section-header">
                            <div className="section-title">
                                <h2>
                                    <span className="section-icon">📚</span>
                                    Music Library
                                </h2>
                                <span className="song-count">{filteredAndSortedSongs.length} songs</span>
                            </div>

                            <div className="library-controls">
                                <div className="search-and-filter">
                                    <div className="search-container">
                                        <input
                                            type="text"
                                            placeholder="Search your library..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="search-input"
                                        />
                                        <span className="search-icon">🔍</span>
                                    </div>

                                    <select
                                        value={sortBy}
                                        onChange={(e) => setSortBy(e.target.value as never)}
                                        className="sort-select"
                                    >
                                        <option value="title">Sort by Title</option>
                                        <option value="artist">Sort by Artist</option>
                                        <option value="dateAdded">Sort by Date Added</option>
                                    </select>

                                    <div className="view-toggle">
                                        <button
                                            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                                            onClick={() => setViewMode('grid')}
                                        >
                                            ⊞
                                        </button>
                                        <button
                                            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
                                            onClick={() => setViewMode('list')}
                                        >
                                            ☰
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className={`songs-container ${viewMode}-view`}>
                            {filteredAndSortedSongs.length > 0 ? (
                                filteredAndSortedSongs.map((song) => (
                                    <div
                                        key={song.id}
                                        className={`song-card ${selectedSong?.id === song.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedSong(song)}
                                    >
                                        <div className="song-artwork">
                                            {song.albumCover ? (
                                                <img
                                                    src={`http://localhost:5001${song.albumCover}`}
                                                    alt={`${song.title} album cover`}
                                                />
                                            ) : (
                                                <div className="artwork-placeholder">🎵</div>
                                            )}
                                        </div>
                                        <div className="song-details">
                                            <h3 className="song-title">{song.title}</h3>
                                            <p className="song-artist">{song.artist}</p>
                                            {song.isAnalyzed && (
                                                <div className="analysis-badge">
                                                    <span className="badge-icon">✓</span>
                                                    Analyzed
                                                </div>
                                            )}
                                        </div>
                                        <div className="song-actions">
                                            <button
                                                className="play-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedSong(song);
                                                }}
                                            >
                                                ▶
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="empty-library">
                                    <div className="empty-icon">🎶</div>
                                    <h3>Your library is empty</h3>
                                    <p>Upload some music files to get started</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Now Playing & AI Features Side Panel */}
                    <aside className="sidebar-content sidebar-content--large">

                        {/* Now Playing Card */}
                        <div className="now-playing-card now-playing-card--large">
                            <div className="card-header">
                                <h3>
                                    <span className="header-icon">🎧</span>
                                    Now Playing
                                </h3>
                                {selectedSong?.isAnalyzed && (
                                    <span className="analyzed-indicator">
                <span className="indicator-icon">📊</span>
                Analyzed
            </span>
                                )}
                            </div>

                            {selectedSong ? (
                                <div className="player-content player-content--expanded">
                                    <SongPlayer song={selectedSong} compact={false} showAnalysis={false}/>

                                    <div className="player-actions player-actions--spaced">
                                        <button
                                            onClick={handleAnalyze}
                                            className={`action-btn analyze-btn ${selectedSong.isAnalyzed ? 'completed' : ''}`}
                                            disabled={selectedSong.isAnalyzed || isLoading}
                                        >
                                            {isLoading ? (
                                                <>
                                                    <span className="loading-spinner"></span>
                                                    Analyzing...
                                                </>
                                            ) : selectedSong.isAnalyzed ? (
                                                <>
                                                    <span className="btn-icon">✓</span>
                                                    Analyzed
                                                </>
                                            ) : (
                                                <>
                                                    <span className="btn-icon">🔬</span>
                                                    Analyze
                                                </>
                                            )}
                                        </button>

                                        <button
                                            onClick={handleInDepthAnalysis}
                                            className="action-btn secondary-btn"
                                            disabled={!selectedSong.isAnalyzed}
                                        >
                                            <span className="btn-icon">📈</span>
                                            Deep Analysis
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="no-selection">
                                    <div className="no-selection-icon">🎵</div>
                                    <h4>Select a song to play</h4>
                                    <p>Choose from your library to start listening</p>
                                </div>
                            )}
                        </div>

                        {/* AI Features Card */}
                        <div className="ai-features-card">
                            <div className="card-header">
                                <h3>
                                    <span className="header-icon">🚀</span>
                                    AI Features
                                </h3>
                            </div>

                            <div className="features-grid">
                                <button className="feature-btn" onClick={navigateToPlaylists}>
                                    <div className="feature-icon">🎧</div>
                                    <span>Smart Playlists</span>
                                </button>

                                <button className="feature-btn" onClick={navigateToMusicMap}>
                                    <div className="feature-icon">🗺️</div>
                                    <span>Music Map</span>
                                </button>

                                <button className="feature-btn" onClick={navigateToMashup}>
                                    <div className="feature-icon">🎚️</div>
                                    <span>Mashups</span>
                                </button>

                                <button
                                    className="feature-btn"
                                    onClick={navigateToRecommendations}
                                    disabled={!selectedSong?.isAnalyzed}
                                >
                                    <div className="feature-icon">🎯</div>
                                    <span>Similar Songs</span>
                                </button>

                                <button
                                    className="feature-btn"
                                    onClick={navigateToLyrics}
                                    disabled={!selectedSong}
                                >
                                    <div className="feature-icon">📝</div>
                                    <span>Lyrics Analysis</span>
                                </button>
                            </div>
                        </div>
                    </aside>
                </div>
            </main>

            {/* Analysis Dashboard - Full Width */}
            <section className="analysis-dashboard">
                <div className="dashboard-container">
                    <div className="dashboard-header">
                        <h2>
                            <span className="section-icon">📊</span>
                            Analysis Dashboard
                        </h2>
                        <div className="progress-overview">
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{width: `${stats.analysisPercentage}%`}}
                                ></div>
                            </div>
                            <span className="progress-text">{stats.analysisPercentage}% Complete</span>
                        </div>
                    </div>

                    <div className="dashboard-content">
                        <div className="recently-analyzed">
                            <h3>Recently Analyzed</h3>
                            <div className="analyzed-grid">
                                {analyzedSongs.map((song) => {
                                    // Get analysis data from either analysis or features object
                                    const analysisData = song.analysis || song.features;
                                    const tempo = analysisData?.tempo;
                                    const key = analysisData?.key;
                                    const energy = analysisData?.energy;

                                    return (
                                        <div
                                            key={song.id}
                                            className="analyzed-item"
                                            onClick={() => setSelectedSong(song)}
                                        >
                                            <div className="item-artwork">
                                                {song.albumCover ? (
                                                    <img src={`http://localhost:5001${song.albumCover}`} alt=""/>
                                                ) : (
                                                    <div className="artwork-placeholder">🎵</div>
                                                )}
                                            </div>
                                            <div className="item-info">
                                                <h4>{song.title}</h4>
                                                <p>{song.artist}</p>
                                                <div className="analysis-preview">
                                                <span>
                                                    Tempo: {
                                                    tempo && typeof tempo === 'number'
                                                        ? `${tempo.toFixed(1)} BPM`
                                                        : 'N/A'
                                                }
                                                </span>
                                                                            <span>
                                                    Key: {key || 'N/A'}
                                                </span>
                                                                            <span>
                                                    Energy: {
                                                            energy && typeof energy === 'number'
                                                                ? energy.toFixed(2)
                                                                : 'N/A'
                                                        }
                                                </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {analyzedSongs.length === 0 && (
                                <div className="empty-analysis">
                                    <div className="empty-icon">📈</div>
                                    <h4>No analyzed songs yet</h4>
                                    <p>Select a song and click "Analyze" to see detailed insights here</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Upload Progress Overlay */}
            {(uploadStatus !== 'idle' || uploadProgress > 0) && (
                <div className="upload-overlay">
                    <div className="upload-progress-card">
                        <div className="upload-status-header">
                            <div className="status-icon">
                                {uploadStatus === 'uploading' && <div className="loading-spinner loading-spinner--large"></div>}
                                {uploadStatus === 'analyzing' && <div className="analyzing-icon">🔬</div>}
                                {uploadStatus === 'success' && <div className="success-icon">✅</div>}
                                {uploadStatus === 'error' && <div className="error-icon">❌</div>}
                            </div>
                            <h3>
                                {uploadStatus === 'uploading' && 'Uploading Files...'}
                                {uploadStatus === 'analyzing' && 'Analyzing Audio...'}
                                {uploadStatus === 'success' && 'Complete!'}
                                {uploadStatus === 'error' && 'Upload Failed'}
                            </h3>
                        </div>

                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${uploadProgress}%` }}
                            ></div>
                        </div>

                        <div className="progress-details">
                <span className="progress-text">
                    {uploadProgress.toFixed(0)}% complete
                </span>

                            {uploadStatus === 'analyzing' && (
                                <span className="file-counter">
                        {processedCount} of {totalCount} files processed
                    </span>
                            )}
                        </div>

                        <p className="current-task">
                            {currentlyProcessing}
                        </p>

                        {uploadStatus === 'analyzing' && (
                            <div className="analysis-steps">
                                <div className="step completed">
                                    <span className="step-icon">✓</span>
                                    <span>Files Uploaded</span>
                                </div>
                                <div className="step active">
                                    <span className="step-icon">🔬</span>
                                    <span>Analyzing Audio Features</span>
                                </div>
                                <div className="step">
                                    <span className="step-icon">📊</span>
                                    <span>Updating Dashboard</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Enhanced Selected Files */}
            {files.length > 0 && (
                <div className="selected-files">
                    <div className="files-header">
                        <h3>
                            <span className="files-icon">📋</span>
                            Selected Files ({files.length})
                        </h3>
                        <button
                            onClick={() => setFiles([])}
                            className="clear-files-button"
                            title="Clear all files"
                        >
                            Clear All
                        </button>
                    </div>
                    <ul className="file-list">
                        {files.map((file, index) => (
                            <li key={index} className="file-item">
                                <span className="file-icon">🎵</span>
                                <div className="file-info">
                                    <span className="file-name">{file.name}</span>
                                    <span className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                </div>
                                <button
                                    onClick={() => removeFile(index)}
                                    className="remove-file-button"
                                    title="Remove file"
                                >
                                    ×
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default FileUpload;
