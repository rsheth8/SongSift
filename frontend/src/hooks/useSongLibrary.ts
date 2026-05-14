import { useState, useEffect } from 'react';
import { songsAPI } from '../services/api';
import { Song } from '../types/song';

export function useSongLibrary() {
    const [songs, setSongs] = useState<Song[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchSongs = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await songsAPI.getAllSongs();
            setSongs(data);
        } catch (err) {
            setError(`Failed to fetch songs: ${err instanceof Error ? err.message : 'Unknown error'}`);
            console.error('Error fetching songs:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSongs();
    }, []);

    const addSongs = (newSongs: Song[]) => {
        setSongs(prevSongs => {
            // Filter out duplicates based on song ID
            const uniqueSongs = newSongs.filter(
                newSong => !prevSongs.some(song => song.id === newSong.id)
            );
            return [...prevSongs, ...uniqueSongs];
        });
    };

    return { songs, isLoading, error, fetchSongs, addSongs };
}
