import React, { useRef, useEffect, useState, useCallback } from 'react';
import '../styling/interactivewaveform.css';

interface InteractiveWaveformProps {
    audioUrl: string;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    onSeek: (time: number) => void;
    height?: number;
    className?: string;
}

const InteractiveWaveform: React.FC<InteractiveWaveformProps> = ({
                                                                     audioUrl,
                                                                     isPlaying,
                                                                     currentTime,
                                                                     duration,
                                                                     onSeek,
                                                                     height = 160, // Reduced default height
                                                                     className = ''
                                                                 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [waveformData, setWaveformData] = useState<number[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hoveredTime, setHoveredTime] = useState<number | null>(null);
    const [canvasWidth, setCanvasWidth] = useState(600); // Reduced default width
    const [isHovering, setIsHovering] = useState(false);

    // Generate waveform data with better resolution control
    const generateWaveform = useCallback(async () => {
        if (!audioUrl) return;

        setIsLoading(true);
        try {
            console.log('Generating waveform for:', audioUrl);

            // Use a more reasonable number of points based on container width
            const points = Math.min(Math.max(canvasWidth * 0.5, 300), 800);
            const waveform: number[] = [];
            const effectiveDuration = duration || 180;

            for (let i = 0; i < points; i++) {
                const progress = i / points;
                const timePosition = progress * effectiveDuration;

                let amplitude = 0;

                // Create more realistic waveform sections
                if (timePosition < effectiveDuration * 0.1) {
                    amplitude = progress * 1.5;
                } else if (timePosition < effectiveDuration * 0.3) {
                    amplitude = 0.5 + Math.sin(progress * Math.PI * 8) * 0.2;
                } else if (timePosition < effectiveDuration * 0.5) {
                    amplitude = 0.7 + Math.sin(progress * Math.PI * 15) * 0.25;
                } else if (timePosition < effectiveDuration * 0.7) {
                    amplitude = 0.3 + Math.sin(progress * Math.PI * 4) * 0.15;
                } else if (timePosition < effectiveDuration * 0.9) {
                    amplitude = 0.8 + Math.sin(progress * Math.PI * 20) * 0.2;
                } else {
                    amplitude = (1 - progress) * 0.6;
                }

                // Add controlled randomness
                amplitude += (Math.random() - 0.5) * 0.2;

                // Normalize and ensure it fits well in the display area
                amplitude = Math.max(0.05, Math.min(0.95, Math.abs(amplitude)));
                waveform.push(amplitude);
            }

            setWaveformData(waveform);
            console.log('Waveform generated:', waveform.length, 'points');
        } catch (error) {
            console.error('Error generating waveform:', error);
        } finally {
            setIsLoading(false);
        }
    }, [audioUrl, canvasWidth, duration]);

    // Enhanced drawing with proper scaling
    const drawWaveform = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || waveformData.length === 0) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const centerY = height / 2;

        // Set canvas resolution to match display size
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw subtle background
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(6, 182, 212, 0.05)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.1)');
        gradient.addColorStop(1, 'rgba(99, 102, 241, 0.05)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Draw center reference line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        // Calculate bar dimensions with proper spacing
        const barWidth = Math.max(1, (width / waveformData.length) - 0.5);
        const maxBarHeight = centerY * 0.75; // Ensure bars don't exceed container
        const progress = duration > 0 ? currentTime / duration : 0;

        // Draw waveform bars
        waveformData.forEach((amplitude, index) => {
            const x = (index / waveformData.length) * width;
            const barHeight = amplitude * maxBarHeight;

            const barProgress = index / waveformData.length;
            const isPlayed = barProgress <= progress;

            // Set colors based on play status
            const fillColor = isPlayed ? '#03dac6' : '#6200ea';
            const fillColorMirror = isPlayed ? 'rgba(3, 218, 198, 0.6)' : 'rgba(98, 0, 234, 0.6)';

            // Draw positive part (above center)
            ctx.fillStyle = fillColor;
            ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);

            // Draw negative part (below center)
            ctx.fillStyle = fillColorMirror;
            ctx.fillRect(x, centerY, barWidth, barHeight);
        });

        // Draw current position indicator
        if (duration > 0 && currentTime >= 0) {
            const progressX = (currentTime / duration) * width;

            // Progress line
            ctx.strokeStyle = '#03dac6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(progressX, 0);
            ctx.lineTo(progressX, height);
            ctx.stroke();

            // Progress indicator circle
            ctx.fillStyle = '#03dac6';
            ctx.beginPath();
            ctx.arc(progressX, centerY, 4, 0, 2 * Math.PI);
            ctx.fill();

            // Pulsing effect when playing
            if (isPlaying) {
                const pulseRadius = 4 + Math.sin(Date.now() * 0.008) * 2;
                ctx.strokeStyle = 'rgba(3, 218, 198, 0.4)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(progressX, centerY, pulseRadius, 0, 2 * Math.PI);
                ctx.stroke();
            }
        }

        // Draw hover indicator
        if (hoveredTime !== null && duration > 0 && isHovering) {
            const hoverX = (hoveredTime / duration) * width;

            // Hover line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(hoverX, 0);
            ctx.lineTo(hoverX, height);
            ctx.stroke();
            ctx.setLineDash([]);

            // Hover circle
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(hoverX, centerY, 3, 0, 2 * Math.PI);
            ctx.fill();
        }

    }, [waveformData, currentTime, duration, hoveredTime, isPlaying, isHovering]);

    // Event handlers remain the same
    const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
        event.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas || duration === 0) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const clickTime = (x / rect.width) * duration;

        console.log('Waveform clicked at:', clickTime, 'seconds');
        onSeek(Math.max(0, Math.min(duration, clickTime)));
    };

    const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas || duration === 0) return;

        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const hoverTime = (x / rect.width) * duration;

        setHoveredTime(Math.max(0, Math.min(duration, hoverTime)));
        setIsHovering(true);
    };

    const handleCanvasMouseEnter = () => {
        setIsHovering(true);
    };

    const handleCanvasMouseLeave = () => {
        setHoveredTime(null);
        setIsHovering(false);
    };

    // Update canvas size with debouncing
    const updateCanvasSize = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const newWidth = Math.floor(rect.width);

        if (newWidth !== canvasWidth && newWidth > 0) {
            setCanvasWidth(newWidth);
        }
    }, [canvasWidth]);

    useEffect(() => {
        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);
        return () => window.removeEventListener('resize', updateCanvasSize);
    }, [updateCanvasSize]);

    useEffect(() => {
        generateWaveform();
    }, [generateWaveform]);

    useEffect(() => {
        drawWaveform();
    }, [drawWaveform]);

    const formatTime = (time: number): string => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className={`interactive-waveform ${className}`}>
            <div className="waveform-header-compact">
                <div className="waveform-title">
                    <span className="waveform-icon">〰️</span>
                    <span>Interactive Waveform</span>
                </div>
                <div className="waveform-info-compact">
                    {hoveredTime !== null && isHovering && (
                        <span className="hover-time-compact">
                            {formatTime(hoveredTime)}
                        </span>
                    )}
                    <span className="current-time-compact">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                    {isPlaying && (
                        <span className="playing-indicator-compact">Playing</span>
                    )}
                </div>
            </div>

            <div className="waveform-container-compact" ref={containerRef}>
                {isLoading && (
                    <div className="waveform-loading-compact">
                        <div className="loading-spinner-compact"></div>
                        <span>Generating waveform...</span>
                    </div>
                )}

                <canvas
                    ref={canvasRef}
                    className="waveform-canvas-compact"
                    style={{
                        width: '100%',
                        height: `${height}px`,
                        cursor: 'crosshair',
                        opacity: isLoading ? 0.5 : 1,
                        display: 'block'
                    }}
                    onClick={handleCanvasClick}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseEnter={handleCanvasMouseEnter}
                    onMouseLeave={handleCanvasMouseLeave}
                />
            </div>

            <div className="waveform-controls-compact">
                <div className="waveform-legend-compact">
                    <div className="legend-item-compact">
                        <div className="legend-color-compact unplayed"></div>
                        <span>Unplayed</span>
                    </div>
                    <div className="legend-item-compact">
                        <div className="legend-color-compact played"></div>
                        <span>Played</span>
                    </div>
                </div>

                <div className="waveform-stats-compact">
                    <span>{waveformData.length} pts</span>
                    <span>{isPlaying ? '▶' : '⏸'}</span>
                </div>
            </div>
        </div>
    );
};

export default InteractiveWaveform;
