import numpy as np
import librosa
import soundfile as sf
import os
import matplotlib.pyplot as plt
import io
import base64

class MashupGenerator:
    """
    Generates mashups between two songs using FFT and audio processing techniques.
    """

    def __init__(self, crossfade_duration=5):
        """
        Initialize the mashup generator.

        Parameters:
        -----------
        crossfade_duration : float, optional
            Duration of crossfade in seconds
        """
        self.crossfade_duration = crossfade_duration

    def analyze_tracks(self, track1_path, track2_path):
        """
        Analyze two tracks for mashup compatibility
        """
        try:
            # Load audio files
            y1, sr1 = librosa.load(track1_path, sr=None)
            y2, sr2 = librosa.load(track2_path, sr=None)

            # Extract features
            tempo1, _ = librosa.beat.beat_track(y=y1, sr=sr1)
            tempo2, _ = librosa.beat.beat_track(y=y2, sr=sr2)

            # Extract key
            key1 = self._extract_key(y1, sr1)
            key2 = self._extract_key(y2, sr2)

            # Calculate key distance (number of semitones)
            key_distance = min((key2 - key1) % 12, (key1 - key2) % 12)

            # Calculate tempo ratio
            tempo_ratio = max(tempo1, tempo2) / min(tempo1, tempo2)

            # Extract energy
            energy1 = librosa.feature.rms(y=y1).mean()
            energy2 = librosa.feature.rms(y=y2).mean()

            # Determine compatibility
            is_compatible = key_distance <= 2 and tempo_ratio < 1.1

            # Convert any NumPy values to Python native types
            tempo1_float = float(tempo1)
            tempo2_float = float(tempo2)
            key1_int = int(key1)
            key2_int = int(key2)
            key_distance_int = int(key_distance)
            tempo_ratio_float = float(tempo_ratio)
            energy1_float = float(energy1)
            energy2_float = float(energy2)

            compatibility_score = self._calculate_compatibility_score(key_distance_int, tempo_ratio_float)

            return {
                'track1': {
                    'tempo': tempo1_float,
                    'key': key1_int,
                    'key_name': self._get_key_name(key1_int),
                    'energy': energy1_float,
                    'duration': float(len(y1) / sr1)
                },
                'track2': {
                    'tempo': tempo2_float,
                    'key': key2_int,
                    'key_name': self._get_key_name(key2_int),
                    'energy': energy2_float,
                    'duration': float(len(y2) / sr2)
                },
                'compatibility': {
                    'key_distance': key_distance_int,
                    'tempo_ratio': tempo_ratio_float,
                    'is_compatible': bool(is_compatible),
                    'compatibility_score': float(compatibility_score)
                },
                'recommendations': {
                    'pitch_shift': int(self._recommend_pitch_shift(key1_int, key2_int)),
                    'tempo_adjustment': float(self._recommend_tempo_adjustment(tempo1_float, tempo2_float))
                }
            }
        except Exception as e:
            print(f"Error in analyze_tracks: {str(e)}")
            import traceback
            traceback.print_exc()
            raise

    def _extract_key(self, y, sr):
        """
        Extract the musical key from audio data
        Returns an integer from 0-11 representing the key (C=0, C#=1, etc.)
        """
        # Use librosa's chroma feature to estimate key
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)

        # Sum chroma features over time
        chroma_sum = np.sum(chroma, axis=1)

        # The index of the maximum value corresponds to the most prominent pitch class
        key = np.argmax(chroma_sum)

        return key

    def _get_key_name(self, key_number):
        """
        Convert a key number (0-11) to a key name
        """
        key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        return key_names[key_number % 12]

    def _calculate_compatibility_score(self, key_distance, tempo_ratio):
        """
        Calculate a compatibility score (0-100) based on key distance and tempo ratio
        """
        # Key distance score (0-50)
        # 0 semitones = 50, 6 semitones = 0
        key_score = max(0, 50 - (key_distance * 8.33))

        # Tempo ratio score (0-50)
        # 1.0 (same tempo) = 50, 1.5 or higher = 0
        tempo_score = max(0, 50 - ((tempo_ratio - 1) * 100))

        # Total score (0-100)
        return key_score + tempo_score

    def _recommend_pitch_shift(self, key1, key2):
        """
        Recommend a pitch shift amount to make key2 match key1
        Returns number of semitones to shift (positive = up, negative = down)
        """
        # Calculate the shortest path between keys
        clockwise = (key1 - key2) % 12
        counterclockwise = (key2 - key1) % 12

        # Return the shift with the smallest absolute value
        if clockwise <= counterclockwise:
            return clockwise
        else:
            return -counterclockwise

    def _recommend_tempo_adjustment(self, tempo1, tempo2):
        """
        Recommend a tempo adjustment percentage to make tempo2 match tempo1
        Returns percentage to adjust (positive = speed up, negative = slow down)
        """
        return ((tempo1 / tempo2) - 1) * 100

    def create_mashup(self, track1_path, track2_path, output_path):
        """
        Create a mashup of two tracks with smooth transition.

        Parameters:
        -----------
        track1_path : str
            Path to the first audio file
        track2_path : str
            Path to the second audio file
        output_path : str
            Path to save the output mashup

        Returns:
        --------
        dict
            Dictionary containing information about the created mashup
        """
        # Load audio files
        y1, sr1 = librosa.load(track1_path, sr=None)
        y2, sr2 = librosa.load(track2_path, sr=None)

        # Ensure same sample rate
        if sr1 != sr2:
            y2 = librosa.resample(y=y2, orig_sr=sr2, target_sr=sr1)
            sr = sr1
        else:
            sr = sr1

        # Calculate crossfade samples
        crossfade_samples = int(self.crossfade_duration * sr)

        # Determine where to start the crossfade
        # For simplicity, we'll use the middle of the first track
        crossfade_start = len(y1) // 2

        # Create the mashup
        # First part of track1 (before crossfade)
        mashup_first = y1[:crossfade_start]

        # Crossfade section
        fade_out = np.linspace(1, 0, crossfade_samples)
        fade_in = np.linspace(0, 1, crossfade_samples)
        crossfade_end = min(crossfade_start + crossfade_samples, len(y1))
        track1_fade = y1[crossfade_start:crossfade_end] * fade_out[:crossfade_end-crossfade_start]

        # Make sure track2 is long enough
        if len(y2) < crossfade_end - crossfade_start:
            # Pad with zeros if needed
            y2 = np.pad(y2, (0, crossfade_end - crossfade_start - len(y2)))
        track2_fade = y2[:crossfade_end-crossfade_start] * fade_in[:crossfade_end-crossfade_start]
        mashup_crossfade = track1_fade + track2_fade

        # Remainder of track2 (after crossfade)
        mashup_last = y2[crossfade_end-crossfade_start:]

        # Combine all parts
        mashup = np.concatenate([mashup_first, mashup_crossfade, mashup_last])

        # Save the mashup
        sf.write(output_path, mashup, sr)

        return {
            'output_path': output_path,
            'duration': len(mashup) / sr,
            'sample_rate': sr
        }

    def pitch_shift_for_compatibility(self, track_path, semitones, output_path=None):
        """
        Shift the pitch of a track by a specified number of semitones.

        Parameters:
        -----------
        track_path : str
            Path to the audio file
        semitones : int
            Number of semitones to shift (positive or negative)
        output_path : str, optional
            Path to save the output audio

        Returns:
        --------
        str or tuple
            Path to the saved audio if output_path is provided,
            or (audio_data, sample_rate) if not
        """
        # Load audio
        y, sr = librosa.load(track_path, sr=None)

        # Shift pitch
        y_shifted = librosa.effects.pitch_shift(y=y, sr=sr, n_steps=semitones)

        # Save if output path is provided
        if output_path:
            sf.write(output_path, y_shifted, sr)
            return output_path
        else:
            return y_shifted, sr

    def tempo_adjust_for_compatibility(self, track_path, tempo_ratio, output_path=None):
        """
        Adjust the tempo of a track by a specified ratio.

        Parameters:
        -----------
        track_path : str
            Path to the audio file
        tempo_ratio : float
            Ratio to adjust tempo (e.g., 1.05 for 5% faster)
        output_path : str, optional
            Path to save the output audio

        Returns:
        --------
        str or tuple
            Path to the saved audio if output_path is provided,
            or (audio_data, sample_rate) if not
        """
        # Load audio
        y, sr = librosa.load(track_path, sr=None)

        # Adjust tempo
        y_adjusted = librosa.effects.time_stretch(y=y, rate=tempo_ratio)

        # Save if output path is provided
        if output_path:
            sf.write(output_path, y_adjusted, sr)
            return output_path
        else:
            return y_adjusted, sr

    def visualize_mashup(self, track1_path, track2_path, crossfade_start=None, save_path=None, figsize=(12, 8)):
        """
        Visualize the mashup process with waveforms.

        Parameters:
        -----------
        track1_path : str
            Path to the first audio file
        track2_path : str
            Path to the second audio file
        crossfade_start : int, optional
            Sample index to start crossfade (if None, use middle of track1)
        save_path : str, optional
            Path to save the visualization image
        figsize : tuple, optional
            Figure size (width, height) in inches

        Returns:
        --------
        str or None
            Path to the saved image if save_path is provided, None otherwise
        """
        # Load audio files
        y1, sr1 = librosa.load(track1_path, sr=None)
        y2, sr2 = librosa.load(track2_path, sr=None)

        # Ensure same sample rate
        if sr1 != sr2:
            y2 = librosa.resample(y=y2, orig_sr=sr2, target_sr=sr1)
            sr = sr1
        else:
            sr = sr1

        # Calculate crossfade samples
        crossfade_samples = int(self.crossfade_duration * sr)

        # Determine where to start the crossfade
        if crossfade_start is None:
            crossfade_start = len(y1) // 2

        # Create plot
        plt.figure(figsize=figsize)

        # Plot track1
        plt.subplot(3, 1, 1)
        plt.plot(np.arange(len(y1)) / sr, y1)
        plt.axvline(x=crossfade_start/sr, color='r', linestyle='--', label='Crossfade Start')
        plt.axvline(x=(crossfade_start+crossfade_samples)/sr, color='g', linestyle='--', label='Crossfade End')
        plt.title('Track 1')
        plt.ylabel('Amplitude')
        plt.legend()

        # Plot track2
        plt.subplot(3, 1, 2)
        plt.plot(np.arange(len(y2)) / sr, y2)
        plt.title('Track 2')
        plt.ylabel('Amplitude')

        # Create the mashup for visualization
        # First part of track1 (before crossfade)
        mashup_first = y1[:crossfade_start]

        # Crossfade section
        fade_out = np.linspace(1, 0, crossfade_samples)
        fade_in = np.linspace(0, 1, crossfade_samples)
        crossfade_end = min(crossfade_start + crossfade_samples, len(y1))
        track1_fade = y1[crossfade_start:crossfade_end] * fade_out[:crossfade_end-crossfade_start]

        # Make sure track2 is long enough
        if len(y2) < crossfade_end - crossfade_start:
            # Pad with zeros if needed
            y2 = np.pad(y2, (0, crossfade_end - crossfade_start - len(y2)))
        track2_fade = y2[:crossfade_end-crossfade_start] * fade_in[:crossfade_end-crossfade_start]
        mashup_crossfade = track1_fade + track2_fade

        # Remainder of track2 (after crossfade)
        mashup_last = y2[crossfade_end-crossfade_start:]

        # Combine all parts
        mashup = np.concatenate([mashup_first, mashup_crossfade, mashup_last])

        # Plot mashup
        plt.subplot(3, 1, 3)
        plt.plot(np.arange(len(mashup)) / sr, mashup)
        plt.axvline(x=crossfade_start/sr, color='r', linestyle='--', label='Crossfade Start')
        plt.axvline(x=crossfade_end/sr, color='g', linestyle='--', label='Crossfade End')
        plt.title('Mashup')
        plt.xlabel('Time (s)')
        plt.ylabel('Amplitude')
        plt.legend()

        plt.tight_layout()

        if save_path:
            plt.savefig(save_path)
            plt.close()
            return save_path
        else:
            plt.show()
            return None

    def get_visualization_as_base64(self, track1_path, track2_path, crossfade_start=None, figsize=(12, 8)):
        """
        Get the mashup visualization as a base64-encoded string for embedding in web pages.

        Parameters:
        -----------
        track1_path : str
            Path to the first audio file
        track2_path : str
            Path to the second audio file
        crossfade_start : int, optional
            Sample index to start crossfade (if None, use middle of track1)
        figsize : tuple, optional
            Figure size (width, height) in inches

        Returns:
        --------
        str
            Base64-encoded image string
        """
        # Create a BytesIO object to save the figure
        buf = io.BytesIO()

        # Save the figure to the BytesIO object
        self.visualize_mashup(track1_path, track2_path, crossfade_start, save_path=buf, figsize=figsize)

        # Encode the figure as base64
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')

        return img_str
