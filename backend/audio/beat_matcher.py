# audio/beat_matcher.py

import numpy as np
import librosa
import soundfile as sf
import matplotlib.pyplot as plt
from scipy.signal import find_peaks
import io
import base64

class BeatMatcher:
    """
    Matches beats between two songs for smooth transitions using dynamic programming.
    """

    def __init__(self):
        """Initialize the beat matcher."""
        pass

    def extract_beats(self, audio_path):
        """
        Extract beat positions from an audio file.

        Parameters:
        -----------
        audio_path : str
            Path to the audio file

        Returns:
        --------
        tuple
            (audio_data, sample_rate, beat_frames, beat_times, tempo)
        """
        # Load audio
        y, sr = librosa.load(audio_path, sr=None)

        # Extract tempo and beat frames
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, trim=False)

        # Convert frames to time
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)

        return y, sr, beat_frames, beat_times, tempo

    def align_beats(self, source_beats, target_beats, max_shift=4):
        """
        Align beats between source and target using dynamic programming.

        Parameters:
        -----------
        source_beats : numpy.ndarray
            Beat times of the source track
        target_beats : numpy.ndarray
            Beat times of the target track
        max_shift : int, optional
            Maximum number of beats to shift

        Returns:
        --------
        list
            List of (source_beat_idx, target_beat_idx) pairs
        """
        # Create cost matrix
        n_source = len(source_beats)
        n_target = len(target_beats)

        # Initialize cost matrix with infinity
        cost_matrix = np.full((n_source, n_target), np.inf)

        # Fill the cost matrix
        for i in range(n_source):
            for j in range(max(0, i-max_shift), min(n_target, i+max_shift+1)):
                # Cost is the absolute difference between beat times
                cost_matrix[i, j] = abs(source_beats[i] - target_beats[j])

        # Initialize traceback matrix
        traceback = np.zeros((n_source, n_target), dtype=int)

        # Initialize first row and column
        for i in range(1, n_source):
            for j in range(1, n_target):
                if cost_matrix[i, j] != np.inf:
                    # Find the minimum cost path
                    candidates = [
                        (cost_matrix[i-1, j-1], 0),  # Diagonal
                        (cost_matrix[i-1, j], 1),    # Vertical
                        (cost_matrix[i, j-1], 2)     # Horizontal
                    ]

                    min_cost, min_idx = min(candidates)

                    # Update cost and traceback
                    cost_matrix[i, j] += min_cost
                    traceback[i, j] = min_idx

        # Traceback to find the optimal path
        i, j = n_source-1, n_target-1
        alignment = [(i, j)]

        while i > 0 and j > 0:
            if traceback[i, j] == 0:  # Diagonal
                i -= 1
                j -= 1
            elif traceback[i, j] == 1:  # Vertical
                i -= 1
            else:  # Horizontal
                j -= 1
            alignment.append((i, j))

        # Reverse the alignment
        alignment.reverse()
        return alignment

    def create_transition(self, source_path, target_path, output_path, transition_duration=10):
        """
        Create a beat-matched transition between two tracks.

        Parameters:
        -----------
        source_path : str
            Path to the source audio file
        target_path : str
            Path to the target audio file
        output_path : str
            Path to save the output transition
        transition_duration : float, optional
            Duration of transition in seconds

        Returns:
        --------
        dict
            Dictionary containing information about the created transition
        """
        try:
            # Extract beats
            y1, sr1, beat_frames1, beat_times1, tempo1 = self.extract_beats(source_path)
            y2, sr2, beat_frames2, beat_times2, tempo2 = self.extract_beats(target_path)

            # Ensure same sample rate
            if sr1 != sr2:
                y2 = librosa.resample(y=y2, orig_sr=sr2, target_sr=sr1)
                sr2 = sr1

                # Recalculate beat frames and times for y2
                tempo2, beat_frames2 = librosa.beat.beat_track(y=y2, sr=sr2, trim=False)
                beat_times2 = librosa.frames_to_time(beat_frames2, sr=sr2)

            # Calculate number of beats in transition
            beats_in_transition = int(transition_duration * tempo1 / 60)

            # Find end point in source track (a few beats before the end)
            source_end_beat = len(beat_times1) - beats_in_transition
            if source_end_beat < 0:
                source_end_beat = len(beat_times1) // 2  # Fallback to middle of track

            # Find start point in target track (a few beats from the start)
            target_start_beat = beats_in_transition
            if target_start_beat >= len(beat_times2):
                target_start_beat = 0  # Fallback to start of track

            # Get beat times for transition
            source_transition_beats = beat_times1[source_end_beat-beats_in_transition:source_end_beat]
            target_transition_beats = beat_times2[target_start_beat:target_start_beat+beats_in_transition]

            # Align beats
            alignment = self.align_beats(source_transition_beats, target_transition_beats)

            # Create transition
            # Convert beat times to samples
            source_end_sample = int(beat_times1[source_end_beat] * sr1)
            target_start_sample = int(beat_times2[target_start_beat] * sr2)

            # Extract parts to be mixed
            source_part = y1[:source_end_sample]
            target_part = y2[target_start_sample:]

            # Calculate crossfade length
            crossfade_length = int(transition_duration * sr1)

            # Ensure source part is long enough
            if len(source_part) < crossfade_length:
                source_part = np.pad(source_part, (0, crossfade_length - len(source_part)))

            # Create crossfade
            fade_out = np.linspace(1, 0, crossfade_length)
            fade_in = np.linspace(0, 1, crossfade_length)

            # Apply crossfade
            source_fade = source_part[-crossfade_length:] * fade_out
            target_fade = target_part[:crossfade_length] * fade_in

            # Combine
            transition = np.concatenate([
                source_part[:-crossfade_length],
                source_fade + target_fade,
                target_part[crossfade_length:]
            ])

            # Save the transition
            sf.write(output_path, transition, sr1)

            return {
                'output_path': output_path,
                'duration': len(transition) / sr1,
                'tempo1': float(tempo1),
                'tempo2': float(tempo2),
                'beats_aligned': len(alignment)
            }
        except Exception as e:
            print(f"Error in create_transition: {str(e)}")
            raise

    def visualize_beat_alignment(self, source_path, target_path, save_path=None, figsize=(12, 8)):
        """
        Visualize beat alignment between two tracks.

        Parameters:
        -----------
        source_path : str
            Path to the source audio file
        target_path : str
            Path to the target audio file
        save_path : str, optional
            Path to save the visualization image
        figsize : tuple, optional
            Figure size (width, height) in inches

        Returns:
        --------
        str or None
            Path to the saved image if save_path is provided, None otherwise
        """
        try:
            # Extract beats
            y1, sr1, beat_frames1, beat_times1, tempo1 = self.extract_beats(source_path)
            y2, sr2, beat_frames2, beat_times2, tempo2 = self.extract_beats(target_path)

            # Convert numpy arrays to Python floats for string formatting
            tempo1_float = float(tempo1)
            tempo2_float = float(tempo2)

            # Create plot
            plt.figure(figsize=figsize)

            # Plot source waveform and beats
            plt.subplot(2, 1, 1)
            plt.plot(np.arange(len(y1)) / sr1, y1, alpha=0.5)
            plt.vlines(beat_times1, -1, 1, color='r', alpha=0.7, label=f'Beats (Tempo: {tempo1_float:.1f} BPM)')
            plt.title('Source Track')
            plt.ylabel('Amplitude')
            plt.legend()

            # Plot target waveform and beats
            plt.subplot(2, 1, 2)
            plt.plot(np.arange(len(y2)) / sr2, y2, alpha=0.5)
            plt.vlines(beat_times2, -1, 1, color='g', alpha=0.7, label=f'Beats (Tempo: {tempo2_float:.1f} BPM)')
            plt.title('Target Track')
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
        except Exception as e:
            print(f"Error in visualize_beat_alignment: {str(e)}")
            raise

    def get_visualization_as_base64(self, source_path, target_path, figsize=(12, 8)):
        """
        Get the beat alignment visualization as a base64-encoded string for embedding in web pages.

        Parameters:
        -----------
        source_path : str
            Path to the source audio file
        target_path : str
            Path to the target audio file
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
        self.visualize_beat_alignment(source_path, target_path, save_path=buf, figsize=figsize)

        # Encode the figure as base64
        buf.seek(0)
        img_str = base64.b64encode(buf.read()).decode('utf-8')

        return img_str

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
