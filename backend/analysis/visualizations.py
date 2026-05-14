import matplotlib.pyplot as plt
import librosa
import librosa.display
import numpy as np

def create_spectrum(audio_path, output_path):
    """Create a spectrum visualization of an audio file"""
    plt.figure(figsize=(10, 4))
    y, sr = librosa.load(audio_path)
    D = librosa.amplitude_to_db(np.abs(librosa.stft(y)), ref=np.max)
    librosa.display.specshow(D, y_axis='log', x_axis='time')
    plt.colorbar(format='%+2.0f dB')
    plt.title('Power spectrogram')
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    return output_path

def create_chromagram(audio_path, output_path):
    """Create a chromagram visualization of an audio file"""
    plt.figure(figsize=(10, 4))
    y, sr = librosa.load(audio_path)
    y = librosa.effects.harmonic(y)
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    librosa.display.specshow(chroma, y_axis='chroma', x_axis='time')
    plt.colorbar()
    plt.title('Chromagram')
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    return output_path

def create_tempo_visualization(audio_path, output_path):
    """Create a tempo visualization of an audio file"""
    plt.figure(figsize=(10, 4))
    y, sr = librosa.load(audio_path)
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)

    # Fix: Check if tempo is an array and handle it appropriately
    if isinstance(tempo, np.ndarray):
        tempo_val = float(tempo[0])  # Convert first element to float
    else:
        tempo_val = float(tempo)  # Convert scalar to float

    times = librosa.times_like(onset_env, sr=sr)
    plt.plot(times, librosa.util.normalize(onset_env), label='Onset strength')
    plt.vlines(times[beats], 0, 1, alpha=0.5, color='r', linestyle='--', label='Beats')
    plt.legend()
    plt.title(f'Tempo: {tempo_val:.2f} BPM')
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    return output_path

def create_pitch_visualization(audio_path, output_path):
    """Create a pitch visualization of an audio file"""
    plt.figure(figsize=(10, 4))
    y, sr = librosa.load(audio_path)
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    plt.subplot(2, 1, 1)
    librosa.display.specshow(pitches, x_axis='time', y_axis='linear')
    plt.colorbar()
    plt.title('Pitch')

    plt.subplot(2, 1, 2)
    librosa.display.specshow(magnitudes, x_axis='time', y_axis='linear')
    plt.colorbar()
    plt.title('Magnitudes')
    plt.tight_layout()
    plt.savefig(output_path)
    plt.close()
    return output_path
