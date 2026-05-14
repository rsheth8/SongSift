/**
 * Storage service for TuneSift
 * Handles local storage operations for persisting app state
 */

// Generic storage operations
const storage = {
    // Get item from storage
    get: <T>(key: string, defaultValue: T): T => {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.error(`Error retrieving ${key} from localStorage:`, error);
            return defaultValue;
        }
    },

    // Set item in storage
    set: <T>(key: string, value: T): void => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`Error storing ${key} in localStorage:`, error);
        }
    },

    // Remove item from storage
    remove: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(`Error removing ${key} from localStorage:`, error);
        }
    },

    // Clear all storage
    clear: (): void => {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('Error clearing localStorage:', error);
        }
    }
};

// Application-specific storage
export const userPreferences = {
    getTheme: (): 'light' | 'dark' | 'system' => {
        return storage.get<'light' | 'dark' | 'system'>('theme', 'system');
    },

    setTheme: (theme: 'light' | 'dark' | 'system'): void => {
        storage.set('theme', theme);
    },

    getAutoPlay: (): boolean => {
        return storage.get<boolean>('autoPlay', false);
    },

    setAutoPlay: (autoPlay: boolean): void => {
        storage.set('autoPlay', autoPlay);
    }
};

export const recentActivity = {
    getRecentSongs: (): string[] => {
        return storage.get<string[]>('recentSongs', []);
    },

    addRecentSong: (songId: string): void => {
        const recentSongs = storage.get<string[]>('recentSongs', []);

        // Remove the song if it already exists
        const filteredSongs = recentSongs.filter(id => id !== songId);

        // Add the song to the beginning
        filteredSongs.unshift(songId);

        // Keep only the 10 most recent songs
        const trimmedSongs = filteredSongs.slice(0, 10);

        storage.set('recentSongs', trimmedSongs);
    },

    getRecentPlaylists: (): string[] => {
        return storage.get<string[]>('recentPlaylists', []);
    },

    addRecentPlaylist: (playlistId: string): void => {
        const recentPlaylists = storage.get<string[]>('recentPlaylists', []);

        // Remove the playlist if it already exists
        const filteredPlaylists = recentPlaylists.filter(id => id !== playlistId);

        // Add the playlist to the beginning
        filteredPlaylists.unshift(playlistId);

        // Keep only the 5 most recent playlists
        const trimmedPlaylists = filteredPlaylists.slice(0, 5);

        storage.set('recentPlaylists', trimmedPlaylists);
    }
};

export const userSession = {
    getUserId: (): string | null => {
        return storage.get<string | null>('userId', null);
    },

    setUserId: (userId: string): void => {
        storage.set('userId', userId);
    },

    clearSession: (): void => {
        storage.remove('userId');
    }
};

export default {
    storage,
    userPreferences,
    recentActivity,
    userSession
};
