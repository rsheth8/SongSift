export interface Song {
    id: string;
    title: string;
    artist: string;
    album?: string;
    albumCover?: string;
    audioUrl: string;
    waveformUrl?: string;
    features?: AudioFeatures;
    analysis?: AudioFeatures; // For backward compatibility
    isAnalyzed: boolean;
    created_at?: string;
}

export interface AudioFeatures {
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
}

export interface SongRecommendation {
    id: string;
    title: string;
    artist: string;
    albumCover?: string;
    audioUrl?: string;
    similarity_score?: number;
    predicted_rating?: number;
}

export interface Playlist {
    id: string;
    name: string;
    user_id?: string;
    songs: string[];
    song_details?: Song[];
    is_auto_generated?: boolean;
    created_at?: string;
    updated_at?: string;
}

export interface Mashup {
    id: string;
    title: string;
    song1_id: string;
    song2_id: string;
    audioUrl: string;
    visualization_url?: string;
    duration: number;
    created_at: string;
}

export interface SongCompatibility {
    track1: {
        tempo: number;
        key: number;
        key_name: string;
        energy: number;
        duration: number;
    };
    track2: {
        tempo: number;
        key: number;
        key_name: string;
        energy: number;
        duration: number;
    };
    compatibility: {
        key_distance: number;
        tempo_ratio: number;
        is_compatible: boolean;
        compatibility_score: number;
    };
    recommendations?: {
        pitch_shift: number;
        tempo_adjustment: number;
    };
}
