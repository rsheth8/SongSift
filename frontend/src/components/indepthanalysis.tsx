import React, {useState, useEffect, useCallback} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styling/indepthanalysis.css';
import SongPlayer from './songplayer';
import AudioFeatureChart from './AudioFeatureChart';
import SongComparison from './SongComparison';
import AIInsights from './AIInsights';
import ExportShare from './ExportShare';
import InteractiveWaveform from './InteractiveWaveform';

// Add interface for better type safety
interface AudioFeatures {
    tempo: number;
    key: string;
    energy: number;
    danceability?: number;
    acousticness?: number;
    instrumentalness?: number;
    valence?: number;
    loudness?: number;
    speechiness?: number;
    liveness?: number;
}

// Feature descriptions for educational tooltips
const FEATURE_DESCRIPTIONS = {
    tempo: "The overall estimated tempo of a track in beats per minute (BPM)",
    key: "The key the track is in. Integers map to pitches using standard Pitch Class notation",
    energy: "A measure from 0.0 to 1.0 representing intensity and powerful feeling",
    danceability: "How suitable a track is for dancing based on musical elements",
    acousticness: "A confidence measure of whether the track is acoustic",
    instrumentalness: "Predicts whether a track contains no vocals",
    valence: "The musical positiveness conveyed by a track (happiness/euphoria vs sadness/anger)",
    loudness: "The overall loudness of a track in decibels (dB)",
    speechiness: "Detects the presence of spoken words in a track",
    liveness: "Detects the presence of an audience in the recording"
};

const InDepthAnalysis: React.FC = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const song = location.state?.song;
    const previousPageState = location.state?.previousPageState;

    // State variables
    const [waveformUrl, setWaveformUrl] = useState<string | null>(null);
    const [featureVisualizations, setFeatureVisualizations] = useState<{[key: string]: string}>({});
    const [audioFeatures, setAudioFeatures] = useState<AudioFeatures | null>(null);
    const [showTooltip, setShowTooltip] = useState<string | null>(null);
    const [analysisMode, setAnalysisMode] = useState<'basic' | 'advanced'>('basic');
    const [showComparison, setShowComparison] = useState(false);
    const [showExportShare, setShowExportShare] = useState(false);
    const [chartType, setChartType] = useState<'radar' | 'bar' | 'line'>('radar');
    const [aiInsights, ] = useState<string[]>([]);
    const [audioCurrentTime, setAudioCurrentTime] = useState(0);
    const [audioIsPlaying, setAudioIsPlaying] = useState(false);
    const [audioDuration, setAudioDuration] = useState(0);
    const [activeAnalysisType, setActiveAnalysisType] = useState<'overview' | 'waveform' | 'features' | 'insights' | 'compare'>('overview');
    const [isLoadingFeatures, setIsLoadingFeatures] = useState(false);
    const [analysisProgress, setAnalysisProgress] = useState(0);
    const [dominantColors, setDominantColors] = useState({
        primary: '#6366F1',
        secondary: '#06B6D4',
        accent: '#8B5CF6'
    });
    const [albumImageLoaded, setAlbumImageLoaded] = useState(false);

    const [volume, setVolume] = useState(1);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [openVisualizations, setOpenVisualizations] = useState<{[key: string]: boolean}>({});

    // Add callback to handle audio state changes
    const handleAudioStateChange = (state: {
        currentTime: number;
        duration: number;
        isPlaying: boolean;
    }) => {
        setAudioCurrentTime(state.currentTime);
        setAudioDuration(state.duration);
        setAudioIsPlaying(state.isPlaying);
    };

    // Add seek handler for the waveform
    const handleWaveformSeek = (time: number) => {
        console.log('Seeking to:', time);
        const audioElement = document.querySelector('audio');
        if (audioElement) {
            audioElement.currentTime = time;
        }
    };

    // Handle quick actions
    const handleQuickAction = (action: string) => {
        switch (action) {
            case 'export':
                setShowExportShare(true);
                break;
            case 'share':
                setShowExportShare(true);
                break;
            case 'compare':
                setShowComparison(true);
                break;
            case 'insights':
                setActiveAnalysisType('insights');
                break;
            default:
                break;
        }
    };

    useEffect(() => {
        if (song) {
            fetchAudioFeatures();
        }
    }, [song]);

    const formatTime = (time: number): string => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const extractColorsFromImage = useCallback((imageUrl: string) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            try {
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;

                const colorCounts: { [key: string]: number } = {};

                for (let i = 0; i < data.length; i += 16) {
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];
                    const alpha = data[i + 3];

                    if (alpha > 128) {
                        const color = `${Math.floor(r/32)*32},${Math.floor(g/32)*32},${Math.floor(b/32)*32}`;
                        colorCounts[color] = (colorCounts[color] || 0) + 1;
                    }
                }

                const sortedColors = Object.entries(colorCounts)
                    .sort(([,a], [,b]) => b - a)
                    .slice(0, 3);

                if (sortedColors.length >= 3) {
                    setDominantColors({
                        primary: sortedColors[0][0],    // Just RGB values like "255, 128, 0"
                        secondary: sortedColors[1][0],
                        accent: sortedColors[2][0]
                    });
                }
            } catch (error) {
                console.log('Could not extract colors, using defaults', error);
            }

            setAlbumImageLoaded(true);
        };

        img.src = imageUrl;
    }, []);

    useEffect(() => {
        if (song?.albumCover) {
            extractColorsFromImage(`http://localhost:5001${song.albumCover}`);
        }
    }, [song?.albumCover, extractColorsFromImage]);

    // ADD THIS NEW useEffect
    useEffect(() => {
        // Update CSS custom properties on the document root
        document.documentElement.style.setProperty('--dynamic-primary', dominantColors.primary);
        document.documentElement.style.setProperty('--dynamic-secondary', dominantColors.secondary);
        document.documentElement.style.setProperty('--dynamic-accent', dominantColors.accent);
    }, [dominantColors]);

    const handleVolumeChange = (newVolume: number) => {
        setVolume(newVolume);
        const audioElement = document.querySelector('audio');
        if (audioElement) {
            audioElement.volume = newVolume;
        }
    };

    const handleSpeedChange = (newSpeed: number) => {
        setPlaybackSpeed(newSpeed);
        const audioElement = document.querySelector('audio');
        if (audioElement) {
            audioElement.playbackRate = newSpeed;
        }
        setShowSpeedMenu(false);
    };

    // const toggleMute = () => {
    //     const audioElement = document.querySelector('audio');
    //     if (audioElement) {
    //         if (audioElement.volume > 0) {
    //             audioElement.volume = 0;
    //             setVolume(0);
    //         } else {
    //             audioElement.volume = 1;
    //             setVolume(1);
    //         }
    //     }
    // };

    const toggleVisualization = (vizKey: string) => {
        setOpenVisualizations(prev => ({
            ...prev,
            [vizKey]: !prev[vizKey]
        }));
    };


    const handleGoBack = () => {
        navigate('/', { state: previousPageState });
    };

    const fetchAudioFeatures = async () => {
        if (!song) return;

        try {
            setIsLoadingFeatures(true);
            setAnalysisProgress(25);
            const response = await fetch(`http://localhost:5001/api/analyze/${song.id}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch audio features');
            }

            const data = await response.json();
            setAudioFeatures(data.analysis || data.features);
            setAnalysisProgress(75);

            // Automatically generate waveform
            handleWaveform();
            setAnalysisProgress(100);
        } catch (error) {
            console.error('Error fetching audio features:', error);
        } finally {
            setIsLoadingFeatures(false);
        }
    };

    const handleWaveform = async () => {
        if (!song || waveformUrl) return;

        try {
            const response = await fetch(`http://localhost:5001/api/in-depth-analysis/${song.id}`, {
                method: 'GET',
            });

            if (!response.ok) {
                throw new Error('Failed to generate waveform');
            }

            const data = await response.json();
            setWaveformUrl(data.waveformPlotUrl);

            setFeatureVisualizations(prev => ({
                ...prev,
                'waveform': data.waveformPlotUrl
            }));
        } catch (error) {
            console.error('Error generating waveform:', error);
        }
    };

    const fetchFeatureVisualization = async (feature: string) => {
        try {
            const response = await fetch(`http://localhost:5001/api/visualize/${song.id}/${feature}`);

            if (!response.ok) {
                throw new Error(`Failed to generate ${feature} visualization`);
            }

            const data = await response.json();
            setFeatureVisualizations(prev => ({
                ...prev,
                [feature]: data.visualizationUrl
            }));
        } catch (error) {
            console.error(`Error generating ${feature} visualization:`, error);
        }
    };

    const formatFeatureValue = (feature: string, value: any) => {
        if (typeof value === 'string') {
            return value; // Return strings as-is (like 'key')
        }

        if (typeof value !== 'number') {
            return 'N/A'; // Handle null/undefined values
        }

        if (feature === 'tempo') return `${value.toFixed(1)} BPM`;
        if (feature === 'loudness') return `${value.toFixed(1)} dB`;
        if (['energy', 'danceability', 'acousticness', 'instrumentalness', 'valence', 'speechiness', 'liveness'].includes(feature)) {
            return `${(value * 100).toFixed(1)}%`;
        }
        return value.toFixed(2);
    };

    const getFeatureColor = (feature: string, value: any) => {
        if (typeof value !== 'number') return '#666'; // Default color for non-numeric values

        const intensity = Math.min(value, 1);
        if (feature === 'energy') return `hsl(${intensity * 60}, 70%, 50%)`;
        if (feature === 'valence') return `hsl(${intensity * 120}, 70%, 50%)`;
        if (feature === 'danceability') return `hsl(${280 + intensity * 40}, 70%, 50%)`;
        return `hsl(${200 + intensity * 60}, 70%, 50%)`;
    };

    const renderFeatureBar = (feature: string, value: any) => {
        if (typeof value !== 'number') return null; // Don't render bar for non-numeric values

        const percentage = Math.min(value * 100, 100);
        return (
            <div className="feature-bar-container">
                <div
                    className="feature-bar"
                    style={{
                        width: `${percentage}%`,
                        backgroundColor: getFeatureColor(feature, value)
                    }}
                />
            </div>
        );
    };

    const getAnalysisTypeIcon = (type: string) => {
        const icons = {
            overview: '📊',
            waveform: '〰️',
            features: '🎛️',
            insights: '🤖',
            compare: '⚖️'
        };
        return icons[type as keyof typeof icons] || '📊';
    };

    const getAnalysisTypeLabel = (type: string) => {
        const labels = {
            overview: 'Overview',
            waveform: 'Waveform',
            features: 'Features',
            insights: 'AI Insights',
            compare: 'Compare'
        };
        return labels[type as keyof typeof labels] || 'Overview';
    };

    if (!song) {
        return (
            <div className="no-song-container">
                <div className="no-song-icon">🎵</div>
                <h2>No song data available</h2>
                <p>Please select a song from your library to view its analysis</p>
                <button onClick={() => navigate('/')} className="back-button">
                    Return to Library
                </button>
            </div>
        );
    }

    return (
        <div className="analysis-studio">
            {/* Zone 1: Audio Control Hub */}
            {/* Zone 1: Audio Control Hub */}
            <div className="audio-control-hub glassmorphism-enhanced">
                <div className="control-hub-content glassmorphism-card">
                    {/* Animated Background Layers */}
                    <div className="dynamic-background-overlay"></div>
                    <div className="dynamic-gradient-overlay"></div>

                    {/* Enhanced Album Artwork */}
                    <div className="album-artwork-enhanced-container">
                        <div className="album-glow-ring"></div>
                        <div className="album-artwork-hub enhanced">
                            {song.albumCover ? (
                                <img
                                    src={`http://localhost:5001${song.albumCover}`}
                                    alt={`${song.title} album cover`}
                                    className={`artwork-image-hub enhanced ${albumImageLoaded ? 'loaded' : ''} ${audioIsPlaying ? 'playing' : ''}`}
                                    onLoad={() => setAlbumImageLoaded(true)}
                                />
                            ) : (
                                <div className="artwork-placeholder-hub enhanced">
                                    <span className="placeholder-icon-hub">🎵</span>
                                </div>
                            )}
                        </div>

                        {/* Circular Progress Ring */}
                        <svg className="progress-ring-overlay" width="106" height="106" viewBox="0 0 106 106">
                            <circle
                                className="progress-ring-background"
                                cx="53"
                                cy="53"
                                r="50"
                                fill="none"
                                stroke="rgba(255,255,255,0.15)"
                                strokeWidth="3"
                            />
                            <circle
                                className="progress-ring-progress"
                                cx="53"
                                cy="53"
                                r="50"
                                fill="none"
                                strokeWidth="3"
                                strokeLinecap="round"
                                style={{
                                    strokeDasharray: `${2 * Math.PI * 50}`,
                                    strokeDashoffset: `${2 * Math.PI * 50 * (1 - (audioDuration > 0 ? audioCurrentTime / audioDuration : 0))}`,
                                    stroke: `rgb(${dominantColors.accent})`
                                }}
                            />
                        </svg>
                    </div>

                    {/* Enhanced Song Metadata */}
                    <div className="song-metadata-hub enhanced">
                        <h1 className="song-title-hub enhanced">{song.title}</h1>
                        <h2 className="song-artist-hub enhanced">{song.artist}</h2>
                        {song.album && <p className="album-name-hub enhanced">{song.album}</p>}

                        {/* Enhanced Key Metrics */}
                        {audioFeatures && (
                            <div className="key-metrics-hub enhanced">
                                <div className="metric-pill enhanced energy">
                                    <span className="metric-icon">⚡</span>
                                    <span className="metric-label">Energy</span>
                                    <span className="metric-value">{(audioFeatures.energy * 100).toFixed(0)}%</span>
                                </div>
                                <div className="metric-pill enhanced tempo">
                                    <span className="metric-icon">🎵</span>
                                    <span className="metric-label">Tempo</span>
                                    <span className="metric-value">{audioFeatures.tempo?.toFixed(0)} BPM</span>
                                </div>
                                <div className="metric-pill enhanced mood">
                                    <span className="metric-icon">😊</span>
                                    <span className="metric-label">Mood</span>
                                    <span
                                        className="metric-value">{audioFeatures.valence ? (audioFeatures.valence * 100).toFixed(0) : 0}%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Enhanced Compact Player */}
                    <div className="playback-controls-hub enhanced">
                        <div className="compact-player-hub enhanced">
                            {/* Enhanced Progress Bar */}
                            <div className="progress-section enhanced">
                                <div className="time-display enhanced">
                                    {formatTime(audioCurrentTime)}
                                </div>
                                <div
                                    className="progress-bar-hub enhanced"
                                    onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const x = e.clientX - rect.left;
                                        const percentage = x / rect.width;
                                        const newTime = percentage * audioDuration;
                                        handleWaveformSeek(newTime);
                                    }}
                                >
                                    <div className="progress-track-enhanced"></div>
                                    <div
                                        className="progress-fill-hub enhanced"
                                        style={{width: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%`}}
                                    ></div>
                                    <div
                                        className="progress-thumb-enhanced"
                                        style={{left: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%`}}
                                    ></div>
                                </div>
                                <div className="time-display enhanced">
                                    {formatTime(audioDuration)}
                                </div>
                            </div>

                            {/* Enhanced Control Buttons */}
                            <div className="control-buttons-hub enhanced">
                                <button className="control-btn-hub secondary enhanced">
                                    <span>⏮️</span>
                                    <div className="btn-ripple"></div>
                                </button>
                                <button
                                    className="control-btn-hub primary enhanced"
                                    onClick={() => {
                                        const audioElement = document.querySelector('audio');
                                        if (audioElement) {
                                            if (audioIsPlaying) {
                                                audioElement.pause();
                                            } else {
                                                audioElement.play();
                                            }
                                        }
                                    }}
                                >
                                    <span>{audioIsPlaying ? '⏸️' : '▶️'}</span>
                                    <div className="btn-ripple"></div>
                                </button>
                                <button className="control-btn-hub secondary enhanced">
                                    <span>⏭️</span>
                                    <div className="btn-ripple"></div>
                                </button>

                                {/* Enhanced Volume Control */}
                                <div className="volume-control-container enhanced">
                                    <button
                                        className="control-btn-hub secondary volume-btn enhanced"
                                        onClick={() => setShowVolumeSlider(!showVolumeSlider)}
                                    >
                                        <span>{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
                                    </button>

                                    {showVolumeSlider && (
                                        <div className="volume-slider-container enhanced">
                                            <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.1"
                                                value={volume}
                                                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                                                className="volume-slider enhanced"
                                            />
                                            <div className="volume-percentage">{Math.round(volume * 100)}%</div>
                                        </div>
                                    )}
                                </div>

                                {/* Enhanced Speed Control */}
                                <div className="speed-control-container enhanced">
                                    <button
                                        className="control-btn-hub secondary speed-btn enhanced"
                                        onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                                    >
                                        <span>{playbackSpeed}x</span>
                                    </button>

                                    {showSpeedMenu && (
                                        <div className="speed-menu enhanced">
                                            {[0.5, 0.75, 1, 1.25, 1.5, 2].map(speed => (
                                                <button
                                                    key={speed}
                                                    className={`speed-option enhanced ${playbackSpeed === speed ? 'active' : ''}`}
                                                    onClick={() => handleSpeedChange(speed)}
                                                >
                                                    {speed}x
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Enhanced Hub Actions */}
                    <div className="hub-actions enhanced">
                        <button onClick={handleGoBack} className="back-nav-hub enhanced">
                            <span className="back-icon">←</span>
                            <span>Back</span>
                        </button>

                        <div className="analysis-mode-toggle-hub enhanced">
                            <button
                                className={`mode-btn-hub enhanced ${analysisMode === 'basic' ? 'active' : ''}`}
                                onClick={() => setAnalysisMode('basic')}
                            >
                                Basic
                            </button>
                            <button
                                className={`mode-btn-hub enhanced ${analysisMode === 'advanced' ? 'active' : ''}`}
                                onClick={() => setAnalysisMode('advanced')}
                            >
                                Advanced
                            </button>
                        </div>
                    </div>
                </div>

                {/* Keep Hidden Player */}
                <div style={{display: 'none'}}>
                    <SongPlayer
                        song={song}
                        compact={true}
                        onAudioStateChange={handleAudioStateChange}
                        className="hidden-player"
                    />
                </div>
            </div>

            {/* Zone 2: Analysis Canvas */}
            <div className="analysis-canvas">
                {/* Sidebar Navigation */}
                <div className="analysis-sidebar-nav">
                    {['overview', 'waveform', 'features', 'insights', 'compare'].map(type => (
                        <button
                            key={type}
                            className={`nav-item ${activeAnalysisType === type ? 'active' : ''}`}
                            onClick={() => setActiveAnalysisType(type as never)}
                            title={getAnalysisTypeLabel(type)}
                        >
                            <span className="nav-icon">{getAnalysisTypeIcon(type)}</span>
                            <span className="nav-label">{getAnalysisTypeLabel(type)}</span>
                        </button>
                    ))}
                </div>

                {/* Main Canvas */}
                <div className="main-canvas">
                    <div className="canvas-header">
                        <h2 className="canvas-title">
                            {getAnalysisTypeIcon(activeAnalysisType)} {getAnalysisTypeLabel(activeAnalysisType)}
                        </h2>

                        {/* Contextual Toolbar */}
                        <div className="contextual-toolbar">
                            {activeAnalysisType === 'overview' && (
                                <div className="chart-type-selector-hub">
                                    {[
                                        { type: 'radar', label: 'Radar', icon: '🕸️' },
                                        { type: 'bar', label: 'Bar', icon: '📊' },
                                        { type: 'line', label: 'Line', icon: '📈' }
                                    ].map(chart => (
                                        <button
                                            key={chart.type}
                                            className={`chart-btn-hub ${chartType === chart.type ? 'active' : ''}`}
                                            onClick={() => setChartType(chart.type as never)}
                                            title={chart.label}
                                        >
                                            <span>{chart.icon}</span>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {activeAnalysisType === 'compare' && (
                                <button
                                    className="action-btn-hub primary"
                                    onClick={() => setShowComparison(true)}
                                >
                                    <span>⚖️</span>
                                    Start Comparison
                                </button>
                            )}

                            {activeAnalysisType === 'insights' && audioFeatures && (
                                <button
                                    className="action-btn-hub secondary"
                                    onClick={() => {
                                        // Regenerate insights
                                        console.log('Regenerating AI insights...');
                                    }}
                                >
                                    <span>🔄</span>
                                    Regenerate
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Canvas Content */}
                    <div className="canvas-content">
                        {activeAnalysisType === 'overview' && audioFeatures && (
                            <div className="overview-content">
                                <div className="chart-section">
                                    <AudioFeatureChart
                                        features={audioFeatures}
                                        chartType={chartType}
                                        title="Audio Features Analysis"
                                    />
                                </div>
                            </div>
                        )}

                        {activeAnalysisType === 'waveform' && (
                            <div className="waveform-content">
                                {song && (
                                    <InteractiveWaveform
                                        audioUrl={song.audioUrl}
                                        isPlaying={audioIsPlaying}
                                        currentTime={audioCurrentTime}
                                        duration={audioDuration || song.duration || 180}
                                        onSeek={handleWaveformSeek}
                                        height={250}
                                        className="studio-waveform"
                                    />
                                )}

                                {/* Additional Visualizations */}
                                <div className="additional-viz">
                                    <div className="viz-header">
                                        <h3>Additional Visualizations</h3>
                                        <p className="viz-description">Generate detailed frequency and temporal analysis</p>
                                    </div>
                                    <div className="viz-grid">
                                        {[
                                            { key: 'spectrum', label: 'Frequency Spectrum', icon: '📊', desc: 'Frequency distribution' },
                                            { key: 'chromagram', label: 'Chromagram', icon: '🌈', desc: 'Pitch class analysis' },
                                            { key: 'tempo', label: 'Tempo Analysis', icon: '🥁', desc: 'Beat tracking' },
                                            { key: 'pitch', label: 'Pitch Analysis', icon: '🎼', desc: 'Fundamental frequency' }
                                        ].map(viz => (
                                            <div key={viz.key} className="viz-item">
                                                <button
                                                    className="viz-btn-compact"
                                                    onClick={() => {
                                                        fetchFeatureVisualization(viz.key);
                                                        if (featureVisualizations[viz.key]) {
                                                            toggleVisualization(viz.key);
                                                        }
                                                    }}
                                                >
                                                    <span className="viz-icon-compact">{viz.icon}</span>
                                                    <div className="viz-text-compact">
                                                        <span className="viz-label-compact">{viz.label}</span>
                                                        <span className="viz-desc-compact">{viz.desc}</span>
                                                    </div>
                                                    {featureVisualizations[viz.key] && (
                                                        <span className="viz-toggle">
                                                            {openVisualizations[viz.key] ? '▼' : '▶'}
                                                        </span>
                                                    )}
                                                </button>

                                                {featureVisualizations[viz.key] && openVisualizations[viz.key] && (
                                                    <div className="viz-content">
                                                        <img
                                                            src={`http://localhost:5001${featureVisualizations[viz.key]}`}
                                                            alt={`${viz.label} visualization`}
                                                            className="viz-image-compact"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeAnalysisType === 'features' && audioFeatures && (
                            <div className="features-content">
                                <div className="features-grid-studio">
                                    {Object.entries(audioFeatures).map(([feature, value]) => (
                                        <div
                                            key={feature}
                                            className="feature-card-studio"
                                            onMouseEnter={() => setShowTooltip(feature)}
                                            onMouseLeave={() => setShowTooltip(null)}
                                        >
                                            <div className="feature-header-studio">
                                                <div className="feature-name-studio">{feature}</div>
                                                <div className="feature-value-studio">{formatFeatureValue(feature, value)}</div>
                                            </div>

                                            {typeof value === 'number' && feature !== 'tempo' && feature !== 'loudness' && feature !== 'key' && (
                                                renderFeatureBar(feature, value)
                                            )}

                                            {showTooltip === feature && FEATURE_DESCRIPTIONS[feature as keyof typeof FEATURE_DESCRIPTIONS] && (
                                                <div className="feature-tooltip-studio">
                                                    {FEATURE_DESCRIPTIONS[feature as keyof typeof FEATURE_DESCRIPTIONS]}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeAnalysisType === 'insights' && audioFeatures && (
                            <div className="insights-content">
                                <AIInsights
                                    song={song}
                                    features={audioFeatures}
                                />
                            </div>
                        )}

                        {activeAnalysisType === 'compare' && (
                            <div className="compare-content">
                                <div className="compare-placeholder">
                                    <div className="compare-icon">⚖️</div>
                                    <h3>Song Comparison</h3>
                                    <p>Compare this song with others in your library to discover similarities and differences</p>
                                    <button
                                        className="start-comparison-btn"
                                        onClick={() => setShowComparison(true)}
                                    >
                                        Start Comparison
                                    </button>
                                </div>
                            </div>
                        )}

                        {isLoadingFeatures && (
                            <div className="loading-overlay">
                                <div className="loading-content">
                                    <div className="loading-spinner-studio"></div>
                                    <p>Analyzing audio features...</p>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill"
                                            style={{ width: `${analysisProgress}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Zone 3: Insights & Actions */}
            <div className="insights-actions-bar">
                <div className="insights-actions-content">
                    <div className="smart-insights">
                        {audioFeatures && (
                            <>
                                <div className="insight-item">
                                    <span className="insight-icon">⚡</span>
                                    <span className="insight-text">
                                        {audioFeatures.energy > 0.7 ? 'High energy track' :
                                            audioFeatures.energy > 0.4 ? 'Moderate energy' : 'Low energy track'}
                                    </span>
                                </div>
                                <div className="insight-item">
                                    <span className="insight-icon">🎵</span>
                                    <span className="insight-text">
                                        {audioFeatures.danceability && audioFeatures.danceability > 0.7 ? 'Very danceable' :
                                            audioFeatures.danceability && audioFeatures.danceability > 0.4 ? 'Moderately danceable' : 'Not very danceable'}
                                    </span>
                                </div>
                                <div className="insight-item">
                                    <span className="insight-icon">😊</span>
                                    <span className="insight-text">
                                        {audioFeatures.valence && audioFeatures.valence > 0.7 ? 'Very positive mood' :
                                            audioFeatures.valence && audioFeatures.valence > 0.4 ? 'Neutral mood' : 'Melancholic mood'}
                                    </span>
                                </div>
                                {audioFeatures.acousticness !== undefined && (
                                    <div className="insight-item">
                                        <span className="insight-icon">🎸</span>
                                        <span className="insight-text">
                                            {audioFeatures.acousticness > 0.7 ? 'Highly acoustic' :
                                                audioFeatures.acousticness > 0.3 ? 'Mixed acoustic/electric' : 'Electronic/produced'}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div className="quick-actions-compact">
                        <button
                            className="quick-action-btn"
                            title="Export Analysis"
                            onClick={() => handleQuickAction('export')}
                        >
                            <span>📤</span>
                        </button>
                        <button
                            className="quick-action-btn"
                            title="Share"
                            onClick={() => handleQuickAction('share')}
                        >
                            <span>🔗</span>
                        </button>
                        <button
                            className="quick-action-btn"
                            title="Compare"
                            onClick={() => handleQuickAction('compare')}
                        >
                            <span>⚖️</span>
                        </button>
                        <button
                            className="quick-action-btn"
                            title="AI Insights"
                            onClick={() => handleQuickAction('insights')}
                        >
                            <span>🤖</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showComparison && (
                <SongComparison
                    primarySong={song}
                    onClose={() => setShowComparison(false)}
                />
            )}

            {showExportShare && audioFeatures && (
                <div className="modal-overlay" onClick={() => setShowExportShare(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Export & Share</h3>
                            <button
                                className="modal-close"
                                onClick={() => setShowExportShare(false)}
                            >
                                ×
                            </button>
                        </div>
                        <ExportShare
                            song={song}
                            features={audioFeatures}
                            insights={aiInsights}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default InDepthAnalysis;
