/**
 * Audio processing service for TuneSift
 * Handles audio playback, analysis, and manipulation
 */

// Create and manage audio context
let audioContext: AudioContext | null = null;

export function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
}

// Audio playback controls
export const audioPlayback = {
    // Play audio with fade-in
    playWithFadeIn: async (audioElement: HTMLAudioElement, fadeDuration = 0.5): Promise<void> => {
        const context = getAudioContext();
        const source = context.createMediaElementSource(audioElement);
        const gainNode = context.createGain();

        // Start with zero volume
        gainNode.gain.value = 0;

        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(context.destination);

        // Start playback
        await audioElement.play();

        // Fade in
        gainNode.gain.linearRampToValueAtTime(1, context.currentTime + fadeDuration);

        return new Promise(resolve => {
            setTimeout(() => resolve(), fadeDuration * 1000);
        });
    },

    // Fade out and pause
    fadeOutAndPause: (audioElement: HTMLAudioElement, fadeDuration = 0.5): Promise<void> => {
        const context = getAudioContext();
        const gainNode = context.createGain();

        // Connect nodes (if not already connected)
        try {
            const source = context.createMediaElementSource(audioElement);
            source.connect(gainNode);
            gainNode.connect(context.destination);
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (e) {
            // Element already connected, continue
        }

        // Fade out
        gainNode.gain.linearRampToValueAtTime(0, context.currentTime + fadeDuration);

        return new Promise(resolve => {
            setTimeout(() => {
                audioElement.pause();
                resolve();
            }, fadeDuration * 1000);
        });
    },

    // Crossfade between two audio elements
    crossFade: (fromAudio: HTMLAudioElement, toAudio: HTMLAudioElement, duration = 2): Promise<void> => {
        const context = getAudioContext();

        // Create gain nodes
        const fromGain = context.createGain();
        const toGain = context.createGain();

        // Connect nodes
        try {
            const fromSource = context.createMediaElementSource(fromAudio);
            fromSource.connect(fromGain);
            fromGain.connect(context.destination);
        } catch (e) {
            // Element already connected, continue
        }

        try {
            const toSource = context.createMediaElementSource(toAudio);
            toSource.connect(toGain);
            toGain.connect(context.destination);
        } catch (e) {
            // Element already connected, continue
        }

        // Start with from=1, to=0
        fromGain.gain.value = 1;
        toGain.gain.value = 0;

        // Start playing the second audio
        toAudio.play();

        // Perform crossfade
        fromGain.gain.linearRampToValueAtTime(0, context.currentTime + duration);
        toGain.gain.linearRampToValueAtTime(1, context.currentTime + duration);

        return new Promise(resolve => {
            setTimeout(() => {
                fromAudio.pause();
                resolve();
            }, duration * 1000);
        });
    }
};

// Audio analysis
export const audioAnalysis = {
    // Get audio buffer from URL
    getAudioBuffer: async (url: string): Promise<AudioBuffer> => {
        const context = getAudioContext();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return await context.decodeAudioData(arrayBuffer);
    },

    // Get waveform data from audio buffer
    getWaveformData: (buffer: AudioBuffer, numPoints = 100): number[] => {
        const channelData = buffer.getChannelData(0);
        const blockSize = Math.floor(channelData.length / numPoints);
        const waveform = [];

        for (let i = 0; i < numPoints; i++) {
            const start = blockSize * i;
            let sum = 0;

            for (let j = 0; j < blockSize; j++) {
                sum += Math.abs(channelData[start + j]);
            }

            waveform.push(sum / blockSize);
        }

        return waveform;
    },

    // Get frequency data from audio buffer
    getFrequencyData: (buffer: AudioBuffer, fftSize = 2048): Float32Array => {
        const context = getAudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = fftSize;

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(analyser);

        const frequencyData = new Float32Array(analyser.frequencyBinCount);
        analyser.getFloatFrequencyData(frequencyData);

        return frequencyData;
    }
};

// Audio effects
export const audioEffects = {
    // Apply pitch shift
    applyPitchShift: (audioElement: HTMLAudioElement, semitones: number): void => {
        // const context = getAudioContext();

        // This is a simplified version - actual pitch shifting requires more complex processing
        // In a real implementation, you would use a library like Tone.js or a custom DSP algorithm

        // For demonstration purposes, we'll just adjust playback rate
        // (this changes both pitch and tempo, not ideal for real applications)
        const rate = Math.pow(2, semitones / 12);
        audioElement.playbackRate = rate;
    },

    // Apply tempo change without affecting pitch
    applyTempoChange: ( tempoRatio: number): void => {
        // This is a placeholder - real time stretching without pitch change
        // requires more complex processing that can't be done with the basic Web Audio API
        // In a real implementation, you would use a library like Tone.js or a custom DSP algorithm

        console.warn('Real-time tempo adjustment without pitch change is not implemented');
        // For demonstration, we'll just log the request
        console.log(`Requested tempo change by factor of ${tempoRatio}`);
    }
};
