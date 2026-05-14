import librosa
import numpy as np
from scipy import stats
from sklearn.preprocessing import StandardScaler

def extract_audio_features(filepath):
    try:
        # Load the audio file
        y, sr = librosa.load(filepath, sr=None)
        print(f"Audio loaded: {filepath}, sample rate: {sr}")

        # Extract tempo
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        print(f"Tempo: {tempo}")

        # Estimate key (using chroma feature)
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        key_index = chroma.mean(axis=1).argmax()
        keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key = keys[key_index]
        print(f"Key: {key}")

        # Compute energy (RMS)
        rms = librosa.feature.rms(y=y).mean()
        energy = float(rms)
        print(f"Energy: {energy}")

        # Extract additional Spotify-like features

        # 1. DANCEABILITY - based on rhythm regularity and beat strength
        danceability = calculate_danceability(y, sr, beat_frames)
        print(f"Danceability: {danceability}")

        # 2. VALENCE - musical positivity/mood based on harmonic and timbral features
        valence = calculate_valence(y, sr)
        print(f"Valence: {valence}")

        # 3. ACOUSTICNESS - likelihood of being acoustic
        acousticness = calculate_acousticness(y, sr)
        print(f"Acousticness: {acousticness}")

        # 4. INSTRUMENTALNESS - likelihood of having no vocals
        instrumentalness = calculate_instrumentalness(y, sr)
        print(f"Instrumentalness: {instrumentalness}")

        # 5. SPEECHINESS - presence of spoken words
        speechiness = calculate_speechiness(y, sr)
        print(f"Speechiness: {speechiness}")

        # 6. LIVENESS - presence of audience/live recording
        liveness = calculate_liveness(y, sr)
        print(f"Liveness: {liveness}")

        # 7. LOUDNESS - overall loudness in dB
        loudness = calculate_loudness(y)
        print(f"Loudness: {loudness}")

        return {
            'tempo': float(tempo),
            'key': key,
            'energy': float(energy),
            'danceability': float(danceability),
            'valence': float(valence),
            'acousticness': float(acousticness),
            'instrumentalness': float(instrumentalness),
            'speechiness': float(speechiness),
            'liveness': float(liveness),
            'loudness': float(loudness)
        }

    except Exception as e:
        print(f"Failed to extract features: {e}")
        raise RuntimeError(f"Failed to extract features: {e}")


def calculate_danceability(y, sr, beat_frames):
    """
    Calculate danceability based on rhythm regularity and beat strength
    """
    try:
        # Beat consistency - how regular the beats are
        if len(beat_frames) < 2:
            return 0.0

        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        beat_intervals = np.diff(beat_times)

        # Coefficient of variation of beat intervals (lower = more regular)
        if len(beat_intervals) > 0 and np.mean(beat_intervals) > 0:
            beat_regularity = 1 - min(1.0, np.std(beat_intervals) / np.mean(beat_intervals))
        else:
            beat_regularity = 0.0

        # Beat strength
        onset_strength = librosa.onset.onset_strength(y=y, sr=sr)
        beat_strength = np.mean(onset_strength)

        # Normalize beat strength (rough normalization)
        beat_strength = min(1.0, beat_strength / 10.0)

        # Combine factors
        danceability = (beat_regularity * 0.6 + beat_strength * 0.4)
        return max(0.0, min(1.0, danceability))

    except Exception as e:
        print(f"Error calculating danceability: {e}")
        return 0.5  # Default value


def calculate_valence(y, sr):
    """
    Calculate valence (musical positivity) based on harmonic and timbral features
    """
    try:
        # Spectral features that correlate with mood
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]

        # Higher spectral centroid often correlates with brighter, happier sound
        brightness = np.mean(spectral_centroids) / (sr / 2)  # Normalize by Nyquist frequency

        # Harmonic content
        harmonic, percussive = librosa.effects.hpss(y)
        harmonic_ratio = np.mean(np.abs(harmonic)) / (np.mean(np.abs(y)) + 1e-10)

        # Major vs minor tendency (simplified)
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        # Major chord templates (simplified)
        major_template = np.array([1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1])
        minor_template = np.array([1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0])

        chroma_mean = np.mean(chroma, axis=1)
        major_correlation = np.corrcoef(chroma_mean, major_template)[0, 1]
        minor_correlation = np.corrcoef(chroma_mean, minor_template)[0, 1]

        # Handle NaN correlations
        if np.isnan(major_correlation):
            major_correlation = 0
        if np.isnan(minor_correlation):
            minor_correlation = 0

        mode_positivity = (major_correlation - minor_correlation + 1) / 2

        # Combine factors
        valence = (brightness * 0.4 + harmonic_ratio * 0.3 + mode_positivity * 0.3)
        return max(0.0, min(1.0, valence))

    except Exception as e:
        print(f"Error calculating valence: {e}")
        return 0.5  # Default value


def calculate_acousticness(y, sr):
    """
    Calculate acousticness based on spectral characteristics
    """
    try:
        # Spectral features that indicate acoustic vs electronic
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]

        # Zero crossing rate (acoustic instruments tend to have more natural variations)
        zcr = librosa.feature.zero_crossing_rate(y)[0]

        # MFCCs (acoustic instruments have different timbral characteristics)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_var = np.var(mfccs, axis=1)

        # Lower spectral centroid and more timbral variation often indicate acoustic
        acoustic_score = 0.0

        # Lower spectral centroid suggests acoustic
        centroid_score = 1 - (np.mean(spectral_centroids) / (sr / 2))
        acoustic_score += centroid_score * 0.3

        # More variation in MFCCs suggests acoustic instruments
        mfcc_variation = np.mean(mfcc_var) / 1000  # Rough normalization
        acoustic_score += min(1.0, mfcc_variation) * 0.4

        # More natural zero crossing rate patterns
        zcr_variation = np.std(zcr)
        acoustic_score += min(1.0, zcr_variation * 10) * 0.3

        return max(0.0, min(1.0, acoustic_score))

    except Exception as e:
        print(f"Error calculating acousticness: {e}")
        return 0.5


def calculate_instrumentalness(y, sr):
    """
    Calculate instrumentalness based on vocal detection
    """
    try:
        # Use a more robust approach with multiple features

        # 1. Spectral features that indicate vocal presence
        spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)

        # 2. MFCC features (vocals have distinct MFCC patterns)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_variance = np.var(mfccs, axis=1)

        # 3. Harmonic-percussive separation
        harmonic, percussive = librosa.effects.hpss(y)
        harmonic_energy = np.mean(librosa.feature.rms(y=harmonic))
        percussive_energy = np.mean(librosa.feature.rms(y=percussive))
        total_energy = harmonic_energy + percussive_energy

        if total_energy > 0:
            harmonic_ratio = harmonic_energy / total_energy
        else:
            harmonic_ratio = 0.5

        # 4. Zero crossing rate (vocals tend to have more varied ZCR)
        zcr = np.mean(librosa.feature.zero_crossing_rate(y))

        # 5. Spectral contrast (vocals create distinct spectral patterns)
        spectral_contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
        contrast_variance = np.var(spectral_contrast)

        # 6. Chroma features (vocals often follow harmonic patterns)
        chroma = librosa.feature.chroma_stft(y=y, sr=sr)
        chroma_variance = np.var(chroma)

        # Normalize features
        centroid_norm = np.mean(spectral_centroid) / (sr/2)  # Normalize by Nyquist frequency
        rolloff_norm = np.mean(spectral_rolloff) / (sr/2)
        bandwidth_norm = np.mean(spectral_bandwidth) / (sr/2)
        zcr_norm = min(zcr * 10, 1.0)  # Scale ZCR

        # Vocal indicators (higher values suggest vocals present)
        vocal_indicators = []

        # High spectral centroid often indicates vocals
        if centroid_norm > 0.1:
            vocal_indicators.append(centroid_norm * 0.8)

        # MFCC variance patterns
        mfcc_vocal_score = np.mean(mfcc_variance[1:5]) / (np.mean(mfcc_variance) + 1e-10)
        vocal_indicators.append(min(mfcc_vocal_score * 0.3, 0.3))

        # Zero crossing rate patterns
        if zcr_norm > 0.05:
            vocal_indicators.append(zcr_norm * 0.4)

        # Spectral contrast variance (vocals create more contrast)
        if contrast_variance > 0.5:
            vocal_indicators.append(min(contrast_variance * 0.2, 0.3))

        # Chroma variance (vocals follow harmonic patterns)
        if chroma_variance > 0.1:
            vocal_indicators.append(min(chroma_variance * 0.3, 0.4))

        # Calculate vocal presence score
        vocal_presence = sum(vocal_indicators) if vocal_indicators else 0.0
        vocal_presence = min(vocal_presence, 1.0)

        # Instrumental score is inverse of vocal presence
        # Apply some smoothing to avoid extreme values
        instrumentalness = 1.0 - vocal_presence

        # Add harmonic ratio influence (more harmonic = potentially more instrumental)
        if harmonic_ratio > 0.6:
            instrumentalness += (harmonic_ratio - 0.6) * 0.3

        # Ensure reasonable range - most songs have some vocal elements
        # Pure instrumental should be rare
        instrumentalness = max(0.1, min(0.95, instrumentalness))

        # Apply final scaling to match typical Spotify values
        # Most songs with vocals should be 0.1-0.3, instrumental 0.7-0.9
        if instrumentalness < 0.5:
            instrumentalness = instrumentalness * 0.6  # Scale down vocal songs
        else:
            instrumentalness = 0.3 + (instrumentalness - 0.5) * 1.2  # Scale up instrumental

        return max(0.0, min(1.0, instrumentalness))

    except Exception as e:
        print(f"Error calculating instrumentalness: {e}")
        return 0.3  # Return a more reasonable default


def calculate_speechiness(y, sr):
    """
    Calculate speechiness based on spectral characteristics of speech
    """
    try:
        # Speech-like characteristics
        # 1. Zero crossing rate (speech has more rapid changes)
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        zcr_mean = np.mean(zcr)

        # 2. Spectral centroid (speech has characteristic frequency distribution)
        spectral_centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))

        # 3. Spectral rolloff
        spectral_rolloff = np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))

        # 4. MFCCs (speech has distinctive patterns)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = np.mean(mfccs, axis=1)

        # Speech typically has higher ZCR
        zcr_score = min(1.0, zcr_mean * 20)  # Rough normalization

        # Speech frequency characteristics
        speech_freq_score = 0.0
        if 500 <= spectral_centroid <= 2000:  # Typical speech range
            speech_freq_score = 1.0
        elif spectral_centroid < 500:
            speech_freq_score = spectral_centroid / 500
        else:
            speech_freq_score = max(0.0, 1.0 - (spectral_centroid - 2000) / 2000)

        # Combine factors
        speechiness = (zcr_score * 0.5 + speech_freq_score * 0.5)

        return max(0.0, min(1.0, speechiness))

    except Exception as e:
        print(f"Error calculating speechiness: {e}")
        return 0.1  # Default low value


def calculate_liveness(y, sr):
    """
    Calculate liveness based on reverb and ambient characteristics
    """
    try:
        # Spectral features that indicate live recording
        # 1. Spectral flatness (live recordings often have more varied frequency content)
        spectral_flatness = librosa.feature.spectral_flatness(y=y)[0]
        flatness_score = np.mean(spectral_flatness)

        # 2. Spectral bandwidth (live recordings often have wider bandwidth)
        spectral_bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr)[0]
        bandwidth_score = min(1.0, np.mean(spectral_bandwidth) / (sr / 4))

        # 3. RMS energy variation (live recordings have more dynamic variation)
        rms = librosa.feature.rms(y=y)[0]
        rms_variation = np.std(rms) / (np.mean(rms) + 1e-10)
        variation_score = min(1.0, rms_variation * 2)

        # 4. High frequency content (audience noise, room acoustics)
        stft = librosa.stft(y)
        magnitude = np.abs(stft)
        freqs = librosa.fft_frequencies(sr=sr)
        high_freq_mask = freqs > sr / 4  # Upper quarter of frequency range

        high_freq_energy = np.mean(magnitude[high_freq_mask, :])
        total_energy = np.mean(magnitude)

        if total_energy > 0:
            high_freq_ratio = high_freq_energy / total_energy
        else:
            high_freq_ratio = 0

        # Combine factors
        liveness = (flatness_score * 0.3 + bandwidth_score * 0.2 +
                    variation_score * 0.3 + high_freq_ratio * 0.2)

        return max(0.0, min(1.0, liveness))

    except Exception as e:
        print(f"Error calculating liveness: {e}")
        return 0.2  # Default low value


def calculate_loudness(y):
    """
    Calculate loudness in dB
    """
    try:
        # RMS to dB conversion
        rms = np.sqrt(np.mean(y**2))
        if rms > 0:
            loudness_db = 20 * np.log10(rms)
        else:
            loudness_db = -60  # Very quiet

        # Normalize to typical range (-60 to 0 dB)
        loudness_normalized = max(-60, min(0, loudness_db))

        return float(loudness_normalized)

    except Exception as e:
        print(f"Error calculating loudness: {e}")
        return -20.0  # Default moderate loudness
