export interface AudioAnalysis {
    tempo: number;
    key: string;
    energy: number;
    danceability?: number;
    acousticness?: number;
    instrumentalness?: number;
    valence?: number;
    speechiness?: number;
    liveness?: number;
    loudness?: number;
    duration?: number;
    time_signature?: number;
    mode?: string;
}

export interface WaveformData {
    waveformPlotUrl: string;
}

export interface SpectrogramData {
    spectrogramUrl: string;
}

export interface ChromagramData {
    chromagramUrl: string;
}

export interface VisualizationData {
    visualizationUrl: string;
    type: 'waveform' | 'spectrum' | 'chromagram' | 'tempo' | 'pitch';
}

export interface LyricAnalysis {
    sentiment: {
        compound: number;
        pos: number;
        neu: number;
        neg: number;
        overall: 'Positive' | 'Negative' | 'Neutral';
    };
    keywords: [string, number][];
    emotions: {
        [emotion: string]: number;
    };
}

export interface LyricVisualization {
    sentiment: string;
    emotions: string;
}
