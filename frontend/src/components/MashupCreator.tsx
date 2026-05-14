import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import SongPlayer from './songplayer';
import '../styling/mashup.css';

const MashupCreator: React.FC = () => {
    const navigate = useNavigate();
    const [songs, setSongs] = useState<any[]>([]);
    const [song1, setSong1] = useState<any>(null);
    const [song2, setSong2] = useState<any>(null);
    const [compatibility, setCompatibility] = useState<any>(null);
    const [mashup, setMashup] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [crossfadeDuration, setCrossfadeDuration] = useState(5);
    const [activeTab, setActiveTab] = useState<number>(1);
    const [playerExpanded, setPlayerExpanded] = useState<{song1: boolean, song2: boolean}>({song1: false, song2: false});

    // Add these state variables
    const [pitchShift, setPitchShift] = useState<number>(0);
    const [tempoAdjustment, setTempoAdjustment] = useState<number>(0);
    const [isPreviewLoading, setIsPreviewLoading] = useState<boolean>(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [adjustedCompatibilityScore, setAdjustedCompatibilityScore] = useState<number>(0);

    // Add this effect to initialize values from recommendations when compatibility data arrives
    useEffect(() => {
        if (compatibility && compatibility.recommendations) {
            setPitchShift(compatibility.recommendations.pitch_shift);
            setTempoAdjustment(Math.round(compatibility.recommendations.tempo_adjustment));
            setAdjustedCompatibilityScore(compatibility.compatibility.compatibility_score);
        }
    }, [compatibility]);

    // Add this effect to recalculate compatibility when adjustments change
    useEffect(() => {
        if (!compatibility) return;

        // Calculate new compatibility score based on adjustments
        const calculateNewScore = () => {
            // Base score
            const baseScore = compatibility.compatibility.compatibility_score;

            // Pitch improvement (each semitone closer to recommended adds up to 8.33%)
            const recommendedPitchShift = compatibility.recommendations.pitch_shift;
            const pitchImprovement = (Math.abs(recommendedPitchShift) - Math.abs(recommendedPitchShift - pitchShift)) * 8.33;

            // Tempo improvement (each percent closer to recommended adds up to 1%)
            const recommendedTempoAdj = compatibility.recommendations.tempo_adjustment;
            const tempoImprovement = (Math.abs(recommendedTempoAdj) - Math.abs(recommendedTempoAdj - tempoAdjustment)) * 1;

            // Calculate new score (capped at 100%)
            return Math.min(100, baseScore + pitchImprovement + tempoImprovement);
        };

        setAdjustedCompatibilityScore(calculateNewScore());
    }, [compatibility, pitchShift, tempoAdjustment]);

    // Auto-advance to next tab when conditions are met
    // With this version that only advances forward, not backward
    useEffect(() => {
        // Only auto-advance when data becomes available, not when tab changes
        if (compatibility && activeTab === 2) {
            // Only auto-advance if we're currently on the analyze tab
            setActiveTab(3);
        }

        if (mashup && activeTab === 3) {
            // Only auto-advance if we're currently on the tweak tab
            setActiveTab(4);
        }
    }, [compatibility, mashup]); // Remove activeTab from dependencies

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

    const analyzeCompatibility = async (e?: React.MouseEvent) => {
        // Prevent default if event is provided
        if (e) e.preventDefault();

        if (!song1 || !song2) return;

        setIsLoading(true);

        // Use setTimeout to prevent UI freezing
        setTimeout(async () => {
            try {
                console.log("Analyzing compatibility between:", song1.title, "and", song2.title);

                const response = await fetch('http://localhost:5001/api/mashup/analyze', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        song1_id: song1.id,
                        song2_id: song2.id
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error("Server error response:", errorText);
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log("Compatibility data received:", data);
                setCompatibility(data.compatibility);
            } catch (error) {
                console.error('Error analyzing compatibility:', error);
                alert(`Failed to analyze compatibility: ${error}`);
            } finally {
                setIsLoading(false);
            }
        }, 0);
    };

    const createMashup = async (e?: React.MouseEvent) => {
        if (e) e.preventDefault();

        if (!song1 || !song2) return;

        setIsLoading(true);
        try {
            // Log the parameters being sent to verify they're correct
            console.log("Creating mashup with settings:", {
                song1_id: song1.id,
                song2_id: song2.id,
                crossfade_duration: crossfadeDuration,
                pitch_shift: pitchShift,
                tempo_adjustment: tempoAdjustment
            });

            const response = await fetch('http://localhost:5001/api/mashup/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    song1_id: song1.id,
                    song2_id: song2.id,
                    crossfade_duration: crossfadeDuration,
                    pitch_shift: pitchShift,
                    tempo_adjustment: tempoAdjustment
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("Error creating mashup:", errorText);
                throw new Error('Failed to create mashup');
            }

            const data = await response.json();
            console.log("Mashup created successfully:", data);
            setMashup(data.mashup);
        } catch (error) {
            console.error('Error creating mashup:', error);
            alert('Failed to create mashup. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const previewAdjustedMashup = async () => {
        if (!song1 || !song2) return;

        setIsPreviewLoading(true);
        setPreviewUrl(null);

        try {
            const response = await fetch('http://localhost:5001/api/mashup/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    song1_id: song1.id,
                    song2_id: song2.id,
                    pitch_shift: pitchShift,
                    tempo_adjustment: tempoAdjustment,
                    crossfade_duration: crossfadeDuration
                })
            });

            if (!response.ok) {
                throw new Error('Failed to generate preview');
            }

            const data = await response.json();
            setPreviewUrl(`http://localhost:5001${data.previewUrl}`);
        } catch (error) {
            console.error('Error generating preview:', error);
            alert('Failed to generate preview. Please try again.');
        } finally {
            setIsPreviewLoading(false);
        }
    };

    const togglePlayer = (player: 'song1' | 'song2') => {
        setPlayerExpanded({
            ...playerExpanded,
            [player]: !playerExpanded[player]
        });
    };

    return (
        <div className="mashup-creator">
            <div className="header-section">
                <h1>Mashup Creator</h1>
                <button onClick={() => navigate('/')} className="back-button">
                    ← Back to Library
                </button>
            </div>

            <div className="workflow-tabs">
                <button
                    className={`tab-button ${activeTab === 1 ? 'active' : ''}`}
                    onClick={() => setActiveTab(1)}
                >
                    <span className="tab-number">1</span>
                    <span className="tab-label">Select Songs</span>
                </button>
                <button
                    className={`tab-button ${activeTab === 2 ? 'active' : ''}`}
                    onClick={() => setActiveTab(2)}
                    disabled={!song1 || !song2}
                >
                    <span className="tab-number">2</span>
                    <span className="tab-label">Analyze</span>
                </button>
                <button
                    className={`tab-button ${activeTab === 3 ? 'active' : ''}`}
                    onClick={() => setActiveTab(3)}
                    disabled={!compatibility}
                >
                    <span className="tab-number">3</span>
                    <span className="tab-label">Tweak</span>
                </button>
                <button
                    className={`tab-button ${activeTab === 4 ? 'active' : ''}`}
                    onClick={() => setActiveTab(4)}
                    disabled={!mashup}
                >
                    <span className="tab-number">4</span>
                    <span className="tab-label">Mashup</span>
                </button>
            </div>

            {/* Tab 1: Select Songs */}
            {activeTab === 1 && (
                <div className="tab-content">
                    <div className="song-selectors">
                        <div className="song-selector">
                            <h2>First Song</h2>
                            <select
                                value={song1?.id || ''}
                                onChange={(e) => {
                                    const song = songs.find(s => s.id === e.target.value);
                                    setSong1(song || null);
                                    // Reset compatibility and mashup when songs change
                                    setCompatibility(null);
                                    setMashup(null);
                                }}
                            >
                                <option value="">Select a song</option>
                                {songs.map(song => (
                                    <option key={song.id} value={song.id}>
                                        {song.title} - {song.artist}
                                    </option>
                                ))}
                            </select>

                            {song1 && (
                                <div className="player-container">
                                    <div className="player-header" onClick={() => togglePlayer('song1')}>
                                        <h3>{song1.title}</h3>
                                        <span className="toggle-icon">{playerExpanded.song1 ? '▲' : '▼'}</span>
                                    </div>
                                    {playerExpanded.song1 && (
                                        <div className="selected-song">
                                            <SongPlayer song={song1} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="song-selector">
                            <h2>Second Song</h2>
                            <select
                                value={song2?.id || ''}
                                onChange={(e) => {
                                    const song = songs.find(s => s.id === e.target.value);
                                    setSong2(song || null);
                                    // Reset compatibility and mashup when songs change
                                    setCompatibility(null);
                                    setMashup(null);
                                }}
                            >
                                <option value="">Select a song</option>
                                {songs.map(song => (
                                    <option key={song.id} value={song.id}>
                                        {song.title} - {song.artist}
                                    </option>
                                ))}
                            </select>

                            {song2 && (
                                <div className="player-container">
                                    <div className="player-header" onClick={() => togglePlayer('song2')}>
                                        <h3>{song2.title}</h3>
                                        <span className="toggle-icon">{playerExpanded.song2 ? '▲' : '▼'}</span>
                                    </div>
                                    {playerExpanded.song2 && (
                                        <div className="selected-song">
                                            <SongPlayer song={song2} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="tab-actions">
                        <button
                            onClick={() => {
                                analyzeCompatibility();
                                setActiveTab(2);
                            }}
                            disabled={isLoading || !song1 || !song2}
                            className="primary-button"
                            type="button"
                        >
                            {isLoading ? 'Analyzing...' : 'Analyze Compatibility'}
                        </button>
                    </div>
                </div>
            )}

            {/* Tab 2: Analyze Compatibility */}
            {activeTab === 2 && (
                <div className="tab-content">
                    {!compatibility && (
                        <div className="analyzing-container">
                            <div className="loading-spinner"></div>
                            <p>Analyzing compatibility between songs...</p>
                        </div>
                    )}

                    {compatibility && (
                        <div className="compatibility-results">
                            <h2>Compatibility Analysis</h2>

                            <div className="compatibility-score">
                                <div className="score-meter">
                                    <div
                                        className="score-fill"
                                        style={{ width: `${compatibility.compatibility.compatibility_score}%` }}
                                    ></div>
                                </div>
                                <span>{compatibility.compatibility.compatibility_score.toFixed(1)}% Compatible</span>
                            </div>

                            <div className="compatibility-details">
                                <div className="detail-item">
                                    <h3>Key Distance</h3>
                                    <p>{compatibility.compatibility.key_distance} semitones</p>
                                    <p>{compatibility.compatibility.key_distance <= 2 ? 'Good match!' : 'Consider pitch shifting'}</p>
                                </div>

                                <div className="detail-item">
                                    <h3>Tempo Ratio</h3>
                                    <p>{compatibility.compatibility.tempo_ratio.toFixed(2)}</p>
                                    <p>{compatibility.compatibility.tempo_ratio < 1.1 ? 'Good match!' : 'Consider tempo adjustment'}</p>
                                </div>
                            </div>

                            <div className="song-details">
                                <div className="song-detail">
                                    <h3>{song1.title}</h3>
                                    <p>Key: {compatibility.track1.key_name}</p>
                                    <p>Tempo: {compatibility.track1.tempo.toFixed(1)} BPM</p>
                                    <p>Energy: {(compatibility.track1.energy * 100).toFixed(1)}%</p>
                                </div>

                                <div className="song-detail">
                                    <h3>{song2.title}</h3>
                                    <p>Key: {compatibility.track2.key_name}</p>
                                    <p>Tempo: {compatibility.track2.tempo.toFixed(1)} BPM</p>
                                    <p>Energy: {(compatibility.track2.energy * 100).toFixed(1)}%</p>
                                </div>
                            </div>

                            {compatibility.recommendations && (
                                <div className="recommendations">
                                    <h3>Recommendations</h3>
                                    {compatibility.recommendations.pitch_shift !== 0 && (
                                        <p>Try shifting {song2.title} by {compatibility.recommendations.pitch_shift} semitones for better key matching.</p>
                                    )}
                                    {Math.abs(compatibility.recommendations.tempo_adjustment) > 5 && (
                                        <p>Try adjusting the tempo of {song2.title} by {compatibility.recommendations.tempo_adjustment.toFixed(1)}% for better beat matching.</p>
                                    )}
                                </div>
                            )}

                            <div className="tab-actions">
                                <button
                                    onClick={() => setActiveTab(1)}
                                    className="secondary-button"
                                    type="button"
                                >
                                    Back to Song Selection
                                </button>
                                <button
                                    onClick={() => setActiveTab(3)}
                                    className="primary-button"
                                    type="button"
                                >
                                    Continue to Tweaking
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab 3: Tweak Settings */}
            {activeTab === 3 && compatibility && (
                <div className="tab-content">
                    <div className="tweaking-studio">
                        <h2>Tweak Your Mashup</h2>
                        <p>Adjust parameters to improve compatibility score: {compatibility.compatibility.compatibility_score.toFixed(1)}%</p>

                        <div className="tweaking-controls">
                            <div className="control-group">
                                <h3>Pitch Adjustment</h3>
                                <div className="pitch-control">
                                    <label>Shift {song2.title} by:</label>
                                    <div className="pitch-buttons">
                                        {[-3, -2, -1, 0, 1, 2, 3].map(semitones => (
                                            <button
                                                key={semitones}
                                                className={`pitch-button ${pitchShift === semitones ? 'active' : ''}`}
                                                onClick={() => setPitchShift(semitones)}
                                            >
                                                {semitones > 0 ? `+${semitones}` : semitones}
                                            </button>
                                        ))}
                                    </div>
                                    <span>semitones</span>
                                </div>
                            </div>

                            <div className="control-group">
                                <h3>Tempo Adjustment</h3>
                                <div className="tempo-control">
                                    <label>Adjust {song2.title} tempo by:</label>
                                    <input
                                        type="range"
                                        min="-20"
                                        max="20"
                                        value={tempoAdjustment}
                                        onChange={(e) => setTempoAdjustment(parseInt(e.target.value))}
                                        className="tempo-slider"
                                    />
                                    <span>{tempoAdjustment}%</span>
                                </div>
                            </div>

                            <div className="control-group">
                                <h3>Crossfade</h3>
                                <div className="crossfade-control">
                                    <label>Crossfade Duration:</label>
                                    <input
                                        type="range"
                                        min="1"
                                        max="10"
                                        value={crossfadeDuration}
                                        onChange={(e) => setCrossfadeDuration(parseInt(e.target.value))}
                                        className="crossfade-slider"
                                    />
                                    <span>{crossfadeDuration}s</span>
                                </div>
                            </div>
                        </div>

                        <div className="updated-compatibility">
                            <h3>Updated Compatibility</h3>
                            <div className="compatibility-score">
                                <div className="score-meter">
                                    <div
                                        className="score-fill"
                                        style={{ width: `${adjustedCompatibilityScore}%` }}
                                    ></div>
                                </div>
                                <span>{adjustedCompatibilityScore.toFixed(1)}% Compatible</span>
                                {adjustedCompatibilityScore > compatibility.compatibility.compatibility_score && (
                                    <span className="improvement">+{(adjustedCompatibilityScore - compatibility.compatibility.compatibility_score).toFixed(1)}%</span>
                                )}
                            </div>
                        </div>

                        <div className="preview-section">
                            <button
                                className="preview-button"
                                onClick={previewAdjustedMashup}
                                disabled={isPreviewLoading}
                            >
                                {isPreviewLoading ? 'Generating Preview...' : 'Preview Adjusted Mashup'}
                            </button>

                            {previewUrl && (
                                <div className="audio-preview">
                                    <audio
                                        controls
                                        src={previewUrl}
                                        className="preview-player"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="tab-actions">
                            <button
                                onClick={() => setActiveTab(2)}
                                className="secondary-button"
                                type="button"
                            >
                                Back to Analysis
                            </button>
                            <button
                                onClick={(e) => {
                                    createMashup(e);
                                }}
                                disabled={isLoading}
                                className="primary-button"
                                type="button"
                            >
                                Create Final Mashup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 4: Final Mashup */}
            {activeTab === 4 && mashup && (
                <div className="tab-content">
                    <div className="mashup-result">
                        <h2>Mashup Created!</h2>

                        {/* Add this section to show the settings used */}
                        <div className="mashup-settings">
                            <h3>Applied Settings</h3>
                            <div className="settings-grid">
                                <div className="setting-item">
                                    <span className="setting-label">Pitch Shift:</span>
                                    <span className="setting-value">{pitchShift} semitones</span>
                                </div>
                                <div className="setting-item">
                                    <span className="setting-label">Tempo Adjustment:</span>
                                    <span className="setting-value">{tempoAdjustment}%</span>
                                </div>
                                <div className="setting-item">
                                    <span className="setting-label">Crossfade Duration:</span>
                                    <span className="setting-value">{crossfadeDuration} seconds</span>
                                </div>
                            </div>
                        </div>

                        <div className="mashup-player">
                            <h3>{mashup.title}</h3>
                            <audio
                                controls
                                src={`http://localhost:5001${mashup.audioUrl}`}
                                className="mashup-audio"
                            ></audio>
                            <p>Duration: {Math.floor(mashup.duration / 60)}:{Math.floor(mashup.duration % 60).toString().padStart(2, '0')}</p>

                            {/* Add visualization display */}
                            {mashup.visualization_url && (
                                <div className="mashup-visualization">
                                    <h4>Mashup Visualization</h4>
                                    <img
                                        src={`http://localhost:5001${mashup.visualization_url}`}
                                        alt="Mashup visualization"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="tab-actions">
                            <button
                                onClick={() => setActiveTab(3)}
                                className="secondary-button"
                                type="button"
                            >
                                Back to Tweaking
                            </button>
                            <button
                                onClick={() => {
                                    // Reset everything for a new mashup
                                    setSong1(null);
                                    setSong2(null);
                                    setCompatibility(null);
                                    setMashup(null);
                                    setPitchShift(0);
                                    setTempoAdjustment(0);
                                    setPreviewUrl(null);
                                    setCrossfadeDuration(5);
                                    setActiveTab(1);
                                }}
                                className="primary-button"
                                type="button"
                            >
                                Create New Mashup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MashupCreator;
