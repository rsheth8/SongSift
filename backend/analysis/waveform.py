import matplotlib
import os
import librosa
from matplotlib.figure import Figure

# Use a non-interactive backend for Matplotlib
matplotlib.use('Agg')

def create_wave_form(filepath, song_folder):
    try:
        y, sr = librosa.load(filepath, sr=None)
        print(f"Audio loaded: {filepath}, sample rate: {sr}")

        fig = Figure(figsize=(10, 4))
        ax = fig.add_subplot(1, 1, 1)
        ax.plot(y)
        ax.set_title("Waveform")
        ax.set_xlabel("Time (seconds)")
        ax.set_ylabel("Amplitude")

        plot_filename = "waveform.png"
        plot_path = os.path.join(song_folder, plot_filename)
        fig.savefig(plot_path)
        print(f"Waveform plot saved as: {plot_path}")
        return plot_path

    except Exception as e:
        print(f"Error creating waveform plot: {e}")
        raise RuntimeError(f"Error creating waveform plot: {e}")
