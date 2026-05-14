export interface User {
    id: string;
    username: string;
    email?: string;
    created_at?: string;
    preferences?: UserPreferences;
}

export interface UserPreferences {
    theme?: 'light' | 'dark' | 'system';
    autoPlay?: boolean;
    defaultVisualization?: string;
    favoriteGenres?: string[];
}

export interface UserRating {
    user_id: string;
    song_id: string;
    rating: number;
    timestamp: string;
}

export interface AuthState {
    isAuthenticated: boolean;
    user: User | null;
    loading: boolean;
    error: string | null;
}
