import React, { useState, useRef, useEffect } from "react";
import "../styling/songplayer.css";

interface Song {
    id: string;
    title: string;
    artist: string;
    albumCover?: string;
    audioUrl: string;
    duration?: number;
    analysis?: {
        tempo: number;
        key: string;
        energy: number;
    };
    features?: {
        tempo: number;
        key: string;
        energy: number;
        danceability?: number;
        acousticness?: number;
        instrumentalness?: number;
        valence?: number;
    };
}

interface SongPlayerProps {
    song: Song | null;
    playlist?: Song[];
    currentIndex?: number;
    onSongChange?: (index: number) => void;
    onEnded?: () => void;
    playlistMode?: boolean;
    compact?: boolean;
    showAnalysis?: boolean;
    className?: string;
    onAudioStateChange?: (state: {
        currentTime: number;
        duration: number;
        isPlaying: boolean;
    }) => void;
}

const SongPlayer: React.FC<SongPlayerProps> = ({
                                                   song,
                                                   playlist = [],
                                                   currentIndex = 0,
                                                   onSongChange,
                                                   onEnded,
                                                   playlistMode = false,
                                                   compact = false,
                                                   className = "",
                                                   onAudioStateChange
                                               }) => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [showSpeedControl, setShowSpeedControl] = useState(false);
    const [waveformProgress, setWaveformProgress] = useState(0);
    const [autoplayEnabled, setAutoplayEnabled] = useState(false);

    const currentSong = playlistMode && playlist.length > 0 ? playlist[currentIndex] : song;
    const nextSong = playlistMode && playlist.length > currentIndex + 1 ? playlist[currentIndex + 1] : null;
    const prevSong = playlistMode && currentIndex > 0 ? playlist[currentIndex - 1] : null;

    // Enhanced song loading with autoplay support
    useEffect(() => {
        const audio = audioRef.current;
        if (audio && currentSong) {
            const wasPlaying = isPlaying; // Remember if we were playing
            setIsLoading(true);
            audio.src = `http://localhost:5001${currentSong.audioUrl}`;

            const handleCanPlay = () => {
                setIsLoading(false);
                setDuration(audio.duration);

                // Auto-play if autoplay is enabled OR if we were already playing
                if (autoplayEnabled || wasPlaying) {
                    audio.play().catch(error => {
                        console.error("Auto-play failed:", error);
                        setIsPlaying(false);
                    });
                }
            };

            audio.addEventListener('loadeddata', handleCanPlay, { once: true });
            audio.load();

            return () => {
                audio.removeEventListener('loadeddata', handleCanPlay);
            };
        }
    }, [currentSong?.id, autoplayEnabled]); // Include autoplayEnabled in dependencies


    // Event listeners - simplified
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            if (audio.duration) {
                setWaveformProgress((audio.currentTime / audio.duration) * 100);
            }
        };

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);

        const handleEnded = () => {
            if (onEnded) onEnded();
            if (autoplayEnabled && playlistMode && nextSong && onSongChange) {
                onSongChange(currentIndex + 1);
            } else {
                setIsPlaying(false);
            }
        };

        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [autoplayEnabled, playlistMode, nextSong, onSongChange, currentIndex, onEnded]);

    // Add this useEffect in your SongPlayer component
    useEffect(() => {
        if (onAudioStateChange) {
            onAudioStateChange({
                currentTime,
                duration,
                isPlaying
            });
        }
    }, [currentTime, duration, isPlaying, onAudioStateChange]);



    // Simple autoplay toggle - no track reset
    const toggleAutoplay = () => {
        setAutoplayEnabled(prev => !prev);
    };

    // Simple play/pause
    const togglePlay = () => {
        const audio = audioRef.current;
        if (audio && currentSong && !isLoading) {
            if (isPlaying) {
                audio.pause();
            } else {
                audio.play().catch(error => {
                    console.error("Error playing audio:", error);
                });
            }
        }
    };

    const goToPrevious = () => {
        if (playlistMode && prevSong && onSongChange) {
            onSongChange(currentIndex - 1);
        }
    };

    const goToNext = () => {
        if (playlistMode && nextSong && onSongChange) {
            onSongChange(currentIndex + 1);
        }
    };

    const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        const newTime = parseFloat(event.target.value);
        if (audio && !isLoading) {
            audio.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const toggleMute = () => {
        const audio = audioRef.current;
        if (audio) {
            const newMutedState = !isMuted;
            audio.muted = newMutedState;
            setIsMuted(newMutedState);
        }
    };

    const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const audio = audioRef.current;
        const newVolume = parseFloat(event.target.value);
        if (audio) {
            audio.volume = newVolume;
            setVolume(newVolume);
            setIsMuted(newVolume === 0);
        }
    };

    const handlePlaybackRateChange = (rate: number) => {
        const audio = audioRef.current;
        if (audio) {
            audio.playbackRate = rate;
            setPlaybackRate(rate);
            setShowSpeedControl(false);
        }
    };

    const formatTime = (time: number): string => {
        if (isNaN(time)) return "0:00";
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    };

    if (!currentSong) {
        return (
            <div className={`song-player song-player--empty ${compact ? 'song-player--compact' : ''} ${className}`}>
                <div className="song-player__empty-state">
                    <div className="empty-state__icon">🎵</div>
                    <h3 className="empty-state__title">No song selected</h3>
                    <p className="empty-state__subtitle">Choose a track to start playing</p>
                </div>
            </div>
        );
    }

    return (
        <div
            className={`song-player song-player--embedded song-player--large ${compact ? 'song-player--compact' : ''} ${className}`}>
            <audio ref={audioRef} preload="metadata"/>

            {/* Prominent Album Cover Section */}
            <div className="song-player__artwork-section song-player__artwork-section--centered">
                <div className="artwork-container artwork-container--expanded">
                    <div className="artwork-main artwork-main--xl">
                        {currentSong.albumCover ? (
                            <img
                                src={`http://localhost:5001${currentSong.albumCover}`}
                                alt={`${currentSong.title} album cover`}
                                className="artwork__image"
                            />
                        ) : (
                            <div className="artwork__placeholder">
                                <span className="placeholder__icon">🎵</span>
                            </div>
                        )}

                        {/* Overlay Play Button */}
                        <div className="artwork-overlay">
                            <button
                                className="artwork-play-btn"
                                onClick={togglePlay}
                                disabled={isLoading}
                                title={isPlaying ? "Pause" : "Play"}
                                aria-label={isPlaying ? "Pause" : "Play"}
                            >
                                {isLoading ? (
                                    <div className="loading-spinner"></div>
                                ) : (
                                    <span className="play-icon">
                            {isPlaying ? "⏸" : "▶"}
                        </span>
                                )}
                            </button>
                        </div>

                        {/* Loading Overlay */}
                        {isLoading && (
                            <div className="artwork__loading-overlay">
                                <div className="loading-spinner loading-spinner--large"></div>
                            </div>
                        )}

                        {/* Progress Ring */}
                        <div className="progress-ring">
                            <svg className="progress-ring__svg" width="100%" height="100%">
                                <circle
                                    className="progress-ring__background"
                                    cx="50%"
                                    cy="50%"
                                    r="48%"
                                    fill="none"
                                    stroke="rgba(255, 255, 255, 0.1)"
                                    strokeWidth="3"
                                />
                                <circle
                                    className="progress-ring__progress"
                                    cx="50%"
                                    cy="50%"
                                    r="48%"
                                    fill="none"
                                    stroke="url(#progressGradient)"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    style={{
                                        strokeDasharray: `${2 * Math.PI * 48}`,
                                        strokeDashoffset: `${2 * Math.PI * 48 * (1 - waveformProgress / 100)}`,
                                        transform: 'rotate(-90deg)',
                                        transformOrigin: 'center'
                                    }}
                                />
                                <defs>
                                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#6200ea"/>
                                        <stop offset="100%" stopColor="#03dac6"/>
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                    </div>

                    {/* Song Information Below Cover */}
                    <div className="song-info-main song-info-main--spaced">
                        <h2 className="song-title-main">{currentSong.title}</h2>
                        <p className="song-artist-main">{currentSong.artist}</p>
                        {playlistMode && playlist.length > 1 && (
                            <span className="playlist-position-main">
                    Track {currentIndex + 1} of {playlist.length}
                </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Progress Section */}
            <div className="song-player__progress">
                <span className="progress__time progress__time--current">
                    {formatTime(currentTime)}
                </span>

                <div className="progress__container">
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        step="0.1"
                        onChange={handleProgressChange}
                        className="progress__slider"
                        disabled={isLoading}
                        aria-label="Seek audio position"
                    />
                    <div
                        className="progress__fill"
                        style={{width: `${waveformProgress}%`}}
                    ></div>
                </div>

                <span className="progress__time progress__time--duration">
                    {formatTime(duration)}
                </span>
            </div>

            {/* Controls */}
            <div className="song-player__controls">
                {/* Navigation Controls (if playlist mode) */}
                {playlistMode && (
                    <button
                        className="control-btn control-btn--nav"
                        onClick={goToPrevious}
                        disabled={!prevSong}
                        title="Previous track"
                        aria-label="Previous track"
                    >
                        <span className="btn-icon">⏮</span>
                    </button>
                )}

                {/* Secondary Play/Pause Button */}
                <button
                    className="control-btn control-btn--play-secondary"
                    onClick={togglePlay}
                    disabled={isLoading}
                    title={isPlaying ? "Pause" : "Play"}
                    aria-label={isPlaying ? "Pause" : "Play"}
                >
                    <span className="btn-icon">
                        {isPlaying ? "⏸" : "▶"}
                    </span>
                </button>

                {/* Navigation Controls (if playlist mode) */}
                {playlistMode && (
                    <button
                        className="control-btn control-btn--nav"
                        onClick={goToNext}
                        disabled={!nextSong}
                        title="Next track"
                        aria-label="Next track"
                    >
                        <span className="btn-icon">⏭</span>
                    </button>
                )}

                {/* Autoplay Toggle Button */}
                {playlistMode && playlist.length > 1 && (
                    <button
                        className={`control-btn control-btn--autoplay ${autoplayEnabled ? 'control-btn--autoplay-active' : ''}`}
                        onClick={toggleAutoplay}
                        title={autoplayEnabled ? "Disable Autoplay" : "Enable Autoplay"}
                        aria-label={autoplayEnabled ? "Disable Autoplay" : "Enable Autoplay"}
                    >
                    <span className="btn-icon">
                        {autoplayEnabled ? "🔄" : "⏹"}
                    </span>
                    </button>
                )}

                {/* Speed Control (if not compact) */}
                {!compact && (
                    <div className="speed-control">
                        <button
                            className="control-btn control-btn--speed"
                            onClick={() => setShowSpeedControl(!showSpeedControl)}
                            title="Playback speed"
                            aria-label="Playback speed"
                        >
                            <span className="btn-icon">⚡</span>
                            <span className="speed-value">{playbackRate}x</span>
                        </button>

                        {showSpeedControl && (
                            <div
                                className="speed-options speed-options--below speed-options--horizontal"
                                onMouseLeave={() => setShowSpeedControl(false)}
                            >
                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                                    <button
                                        key={rate}
                                        className={`speed-option ${playbackRate === rate ? 'speed-option--active' : ''}`}
                                        onClick={() => handlePlaybackRateChange(rate)}
                                    >
                                        {rate}x
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Volume Control */}
                <div className="volume-control">
                    <button
                        className="control-btn control-btn--volume"
                        onClick={toggleMute}
                        onMouseEnter={() => setShowVolumeSlider(true)}
                        title={isMuted ? "Unmute" : "Mute"}
                        aria-label={isMuted ? "Unmute" : "Mute"}
                    >
                    <span className="btn-icon">
                        {isMuted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
                    </span>
                    </button>

                    {showVolumeSlider && (
                        <div
                            className="volume-slider-container volume-slider-container--below"
                            onMouseLeave={() => setShowVolumeSlider(false)}
                        >
                            <div className="volume-slider-wrapper">
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={isMuted ? 0 : volume}
                                    onChange={handleVolumeChange}
                                    className="volume-slider volume-slider--horizontal"
                                    aria-label="Volume"
                                />
                                <span className="volume-percentage">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Autoplay Status Indicator */}
            {playlistMode && playlist.length > 1 && (
                <div className="autoplay-status">
                    <span className={`autoplay-indicator ${autoplayEnabled ? 'autoplay-indicator--active' : ''}`}>
                        <span className="autoplay-icon">
                            {autoplayEnabled ? "🔄" : "⏹"}
                        </span>
                        <span className="autoplay-text">
                            Autoplay {autoplayEnabled ? "ON" : "OFF"}
                        </span>
                    </span>
                </div>
            )}

            {/* Next Song Preview (if available and not compact) */}
            {!compact && nextSong && autoplayEnabled && (
                <div className="song-player__next-preview">
                    <div className="next-preview__content">
                        <span className="next-preview__label">Up Next:</span>
                        <span className="next-preview__title">{nextSong.title}</span>
                        <span className="next-preview__artist">by {nextSong.artist}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SongPlayer;
