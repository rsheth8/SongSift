import { Song, Playlist, Mashup, SongCompatibility } from '../types/song';
import { AudioAnalysis, LyricAnalysis } from '../types/analysis';

const API_BASE_URL = 'http://localhost:5001';

// Generic fetch function with error handling
async function fetchFromAPI<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    try {
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(
                errorData?.error || `API error: ${response.status} ${response.statusText}`
            );
        }

        return await response.json() as T;
    } catch (error) {
        console.error(`API request failed: ${endpoint}`, error);
        throw error;
    }
}

// Songs API
export const songsAPI = {
    getAllSongs: (): Promise<Song[]> =>
        fetchFromAPI('/api/songs'),

    analyzeSong: (songId: string): Promise<{analysis: AudioAnalysis}> =>
        fetchFromAPI(`/api/analyze/${songId}`),

    getInDepthAnalysis: (songId: string): Promise<{waveformPlotUrl: string}> =>
        fetchFromAPI(`/api/in-depth-analysis/${songId}`),

    uploadSongs: async (files: File[]): Promise<Song[]> => {
        const formData = new FormData();
        files.forEach(file => formData.append('files[]', file));

        const response = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || 'Upload failed');
        }

        return await response.json() as Song[];
    }
};

// Recommendations API
export const recommendationsAPI = {
    getSimilarSongs: (songId: string, count = 5): Promise<{recommendations: Song[]}> =>
        fetchFromAPI(`/api/recommend/similar/${songId}?count=${count}`),

    getCollaborativeRecommendations: (userId: string, count = 5): Promise<{recommendations: Song[]}> =>
        fetchFromAPI(`/api/recommend/collaborative/${userId}?count=${count}`),

    getHybridRecommendations: (userId: string, seedSongId: string, count = 5): Promise<{recommendations: Song[]}> =>
        fetchFromAPI(`/api/recommend/hybrid/${userId}?seed_song_id=${seedSongId}&count=${count}`),

    getMoodBasedRecommendations: (mood: string, count = 5): Promise<{recommendations: Song[]}> =>
        fetchFromAPI(`/api/recommend/mood/${mood}?count=${count}`)
};

// Playlists API
export const playlistsAPI = {
    getAllPlaylists: (): Promise<Playlist[]> =>
        fetchFromAPI('/api/playlists'),

    getPlaylist: (playlistId: string): Promise<Playlist> =>
        fetchFromAPI(`/api/playlists/${playlistId}`),

    createPlaylist: (name: string, userId: string, songIds: string[]): Promise<Playlist> =>
        fetchFromAPI('/api/playlists/create', {
            method: 'POST',
            body: JSON.stringify({ name, user_id: userId, song_ids: songIds })
        }),

    generatePlaylists: (songIds: string[], numClusters: number, userId: string): Promise<{playlists: Playlist[], visualization_url: string}> =>
        fetchFromAPI('/api/playlists/generate', {
            method: 'POST',
            body: JSON.stringify({
                song_ids: songIds,
                num_clusters: numClusters,
                user_id: userId
            })
        })
};

// Music Graph API
export const graphAPI = {
    getMusicMap: (): Promise<{music_map_url: string, stats: any}> =>
        fetchFromAPI('/api/graph/music-map'),

    findPath: (sourceId: string, targetId: string, pathType = 'shortest'): Promise<{path: Song[], path_visualization: string}> =>
        fetchFromAPI(`/api/graph/path?source=${sourceId}&target=${targetId}&type=${pathType}`),

    generateJourney: (seedId: string, length = 7, diversity = 0.5): Promise<{seed_song: Song, journey: Song[]}> =>
        fetchFromAPI(`/api/graph/journey?seed=${seedId}&length=${length}&diversity=${diversity}`)
};

// Lyrics API
export const lyricsAPI = {
    fetchLyrics: (artist: string, title: string): Promise<{lyrics: string}> =>
        fetchFromAPI(`/api/lyrics/fetch?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`),

    analyzeLyrics: (lyrics: string): Promise<{analysis: LyricAnalysis, visualizations: {sentiment: string, emotions: string}}> =>
        fetchFromAPI('/api/lyrics/analyze', {
            method: 'POST',
            body: JSON.stringify({ lyrics })
        })
};

// Mashup API
export const mashupAPI = {
    analyzeCompatibility: (song1Id: string, song2Id: string): Promise<{compatibility: SongCompatibility}> =>
        fetchFromAPI('/api/mashup/analyze', {
            method: 'POST',
            body: JSON.stringify({ song1_id: song1Id, song2_id: song2Id })
        }),

    createMashup: (song1Id: string, song2Id: string, crossfadeDuration = 5): Promise<{mashup: Mashup}> =>
        fetchFromAPI('/api/mashup/create', {
            method: 'POST',
            body: JSON.stringify({
                song1_id: song1Id,
                song2_id: song2Id,
                crossfade_duration: crossfadeDuration
            })
        })
};

// Beats API
export const beatsAPI = {
    analyzeBeats: (songId: string): Promise<{tempo: number, beat_times: number[], num_beats: number}> =>
        fetchFromAPI('/api/beats/analyze', {
            method: 'POST',
            body: JSON.stringify({ song_id: songId })
        }),

    createTransition: (song1Id: string, song2Id: string, transitionDuration = 10): Promise<{transition: {audioUrl: string, duration: number}}> =>
        fetchFromAPI('/api/beats/transition', {
            method: 'POST',
            body: JSON.stringify({
                song1_id: song1Id,
                song2_id: song2Id,
                transition_duration: transitionDuration
            })
        })
};
