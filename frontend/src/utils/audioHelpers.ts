/**
 * Get the average audio level from an audio buffer
 */
export function getAverageAudioLevel(audioBuffer: AudioBuffer): number {
    const channelData = audioBuffer.getChannelData(0); // Get data from first channel
    let sum = 0;

    // Sum the absolute values of all samples
    for (let i = 0; i < channelData.length; i++) {
        sum += Math.abs(channelData[i]);
    }

    // Return the average
    return sum / channelData.length;
}

/**
 * Convert BPM to milliseconds per beat
 */
export function bpmToMilliseconds(bpm: number): number {
    return 60000 / bpm;
}

/**
 * Detect if two songs are in compatible keys
 * Returns true if keys are identical or within 1 semitone
 */
export function areKeysCompatible(key1: number, key2: number): boolean {
    const distance = Math.min(
        Math.abs(key1 - key2),
        12 - Math.abs(key1 - key2)
    );

    return distance <= 1;
}

/**
 * Detect if two songs have compatible tempos
 * Returns true if tempos are within 5% of each other
 */
export function areTemposCompatible(tempo1: number, tempo2: number): boolean {
    const ratio = Math.max(tempo1, tempo2) / Math.min(tempo1, tempo2);
    return ratio < 1.05;
}
