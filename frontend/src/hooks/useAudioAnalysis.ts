import { useState, useEffect } from 'react';
import { songsAPI } from '../services/api';

export function useAudioAnalysis(songId: string | null) {
    const [features, setFeatures] = useState<any>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!songId) return;

        const fetchAudioFeatures = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const data = await songsAPI.analyzeSong(songId);
                setFeatures(data.analysis);
            } catch (err) {
                setError(`Failed to fetch audio features: ${err instanceof Error ? err.message : 'Unknown error'}`);
                console.error('Error fetching audio features:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAudioFeatures();
    }, [songId]);

    return { features, isLoading, error };
}
