import React, { useState, useEffect } from 'react';
import '../styling/aiinsights.css';

interface AudioFeatures {
    tempo: number;
    key: string;
    energy: number;
    danceability?: number;
    acousticness?: number;
    instrumentalness?: number;
    valence?: number;
    loudness?: number;
    speechiness?: number;
    liveness?: number;
}

interface AIInsightsProps {
    song: {
        title: string;
        artist: string;
        id: string;
    };
    features: AudioFeatures;
}

const AIInsights: React.FC<AIInsightsProps> = ({ song, features }) => {
    const [insights, setInsights] = useState<string[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [currentInsight, setCurrentInsight] = useState(0);

    useEffect(() => {
        generateInsights();
    }, [features]);

    const generateInsights = () => {
        setIsGenerating(true);

        // Simulate AI processing delay
        setTimeout(() => {
            const generatedInsights = analyzeFeatures(features, song);
            setInsights(generatedInsights);
            setIsGenerating(false);
        }, 1500);
    };

    const analyzeFeatures = (features: AudioFeatures, song: any): string[] => {
        const insights: string[] = [];

        // Energy Analysis
        if (features.energy !== undefined) {
            if (features.energy > 0.8) {
                insights.push(`🔥 "${song.title}" is a high-energy powerhouse! With an energy level of ${(features.energy * 100).toFixed(0)}%, this track is perfect for workouts, parties, or when you need an instant mood boost.`);
            } else if (features.energy > 0.6) {
                insights.push(`⚡ This track has a solid energy level (${(features.energy * 100).toFixed(0)}%), making it great for focused activities or moderate exercise. It strikes a nice balance between excitement and control.`);
            } else if (features.energy > 0.3) {
                insights.push(`🌊 With moderate energy (${(features.energy * 100).toFixed(0)}%), "${song.title}" creates a relaxed yet engaging atmosphere. Perfect for background music or casual listening.`);
            } else {
                insights.push(`🌙 This is a low-energy, contemplative piece (${(features.energy * 100).toFixed(0)}% energy). Ideal for meditation, studying, or winding down after a long day.`);
            }
        }

        // Valence (Mood) Analysis
        if (features.valence !== undefined) {
            if (features.valence > 0.7) {
                insights.push(`😊 The mood of this song is overwhelmingly positive! With a happiness score of ${(features.valence * 100).toFixed(0)}%, it's likely to lift your spirits and spread good vibes.`);
            } else if (features.valence > 0.5) {
                insights.push(`🙂 This track has a generally upbeat feel (${(features.valence * 100).toFixed(0)}% positivity), with enough emotional complexity to keep things interesting.`);
            } else if (features.valence > 0.3) {
                insights.push(`😐 The emotional tone is fairly neutral (${(features.valence * 100).toFixed(0)}% positivity), creating a balanced emotional landscape that could fit many moods.`);
            } else {
                insights.push(`😔 This song carries a more melancholic or introspective mood (${(features.valence * 100).toFixed(0)}% positivity). It might resonate during reflective moments or when processing deeper emotions.`);
            }
        }

        // Danceability Analysis
        if (features.danceability !== undefined) {
            if (features.danceability > 0.8) {
                insights.push(`💃 Get ready to move! This track scores ${(features.danceability * 100).toFixed(0)}% on danceability. The rhythm, beat strength, and overall groove make it irresistible for dancing.`);
            } else if (features.danceability > 0.6) {
                insights.push(`🕺 With a danceability score of ${(features.danceability * 100).toFixed(0)}%, this song has a solid groove that'll get your head nodding and feet tapping.`);
            } else if (features.danceability > 0.4) {
                insights.push(`🎵 Moderately danceable (${(features.danceability * 100).toFixed(0)}%), this track has rhythmic elements but might be better suited for casual movement than intense dancing.`);
            } else {
                insights.push(`🎼 This is more of a listening experience than a dancing one (${(features.danceability * 100).toFixed(0)}% danceability). The focus is on musical complexity rather than rhythmic drive.`);
            }
        }

        // Acousticness Analysis
        if (features.acousticness !== undefined) {
            if (features.acousticness > 0.8) {
                insights.push(`🎸 This is predominantly acoustic music (${(features.acousticness * 100).toFixed(0)}% acoustic). You'll hear natural instruments and organic sounds that create an intimate, authentic feel.`);
            } else if (features.acousticness > 0.5) {
                insights.push(`🎻 There's a nice blend of acoustic and electronic elements (${(features.acousticness * 100).toFixed(0)}% acoustic), creating a rich textural landscape.`);
            } else if (features.acousticness > 0.2) {
                insights.push(`🎹 While primarily electronic/produced, there are some acoustic elements (${(features.acousticness * 100).toFixed(0)}% acoustic) that add organic warmth to the sound.`);
            } else {
                insights.push(`🎛️ This is heavily produced electronic music (${(features.acousticness * 100).toFixed(0)}% acoustic). Expect synthesizers, digital effects, and modern production techniques.`);
            }
        }

        // Tempo Analysis
        if (features.tempo) {
            if (features.tempo > 140) {
                insights.push(`🏃‍♂️ At ${features.tempo.toFixed(0)} BPM, this is a fast-paced track! Perfect for high-intensity activities, running, or when you need energizing music.`);
            } else if (features.tempo > 120) {
                insights.push(`🚶‍♂️ With a tempo of ${features.tempo.toFixed(0)} BPM, this song has a comfortable, walking-pace rhythm that's versatile for many activities.`);
            } else if (features.tempo > 90) {
                insights.push(`🧘‍♀️ The relaxed tempo of ${features.tempo.toFixed(0)} BPM creates a laid-back atmosphere, perfect for chill sessions or background music.`);
            } else {
                insights.push(`🐌 This slow-tempo piece (${features.tempo.toFixed(0)} BPM) encourages deep listening and contemplation. Great for relaxation or emotional reflection.`);
            }
        }

        // Instrumentalness Analysis
        if (features.instrumentalness !== undefined) {
            if (features.instrumentalness > 0.8) {
                insights.push(`🎼 This is primarily instrumental music (${(features.instrumentalness * 100).toFixed(0)}% instrumental). The focus is on musical storytelling without words, letting the instruments speak.`);
            } else if (features.instrumentalness > 0.5) {
                insights.push(`🎤 There's a balance between vocals and instrumental sections (${(features.instrumentalness * 100).toFixed(0)}% instrumental), creating dynamic contrast throughout the piece.`);
            } else {
                insights.push(`🎙️ Vocals play a prominent role in this track (${(features.instrumentalness * 100).toFixed(0)}% instrumental), with lyrics likely being a key component of the musical experience.`);
            }
        }

        // Combination Insights
        if (features.energy !== undefined && features.valence !== undefined) {
            if (features.energy > 0.7 && features.valence > 0.7) {
                insights.push(`🎉 This is a feel-good anthem! The combination of high energy and positive mood makes it perfect for celebrations, parties, or whenever you need an instant pick-me-up.`);
            } else if (features.energy < 0.3 && features.valence < 0.3) {
                insights.push(`🌧️ This track creates a contemplative, perhaps melancholic atmosphere. The low energy and subdued mood make it ideal for introspective moments or emotional processing.`);
            } else if (features.energy > 0.7 && features.valence < 0.4) {
                insights.push(`⚡😤 Interesting contrast here - high energy but lower positivity. This could be an intense, perhaps aggressive or emotionally charged piece that packs a punch.`);
            }
        }

        // Genre Prediction Based on Features
        const genrePrediction = predictGenre(features);
        if (genrePrediction) {
            insights.push(`🎭 Based on the audio characteristics, this song likely falls into the ${genrePrediction} category, though music always transcends simple categorization!`);
        }

        return insights;
    };

    const predictGenre = (features: AudioFeatures): string | null => {
        if (features.danceability && features.danceability > 0.8 && features.energy && features.energy > 0.8) {
            return "Electronic Dance Music (EDM) or Pop";
        }
        if (features.acousticness && features.acousticness > 0.8 && features.energy && features.energy < 0.5) {
            return "Folk or Acoustic";
        }
        if (features.energy && features.energy > 0.8 && features.loudness && features.loudness > -5) {
            return "Rock or Metal";
        }
        if (features.speechiness && features.speechiness > 0.6) {
            return "Hip-Hop or Rap";
        }
        if (features.instrumentalness && features.instrumentalness > 0.8) {
            return "Classical or Ambient";
        }
        if (features.valence && features.valence < 0.3 && features.acousticness && features.acousticness > 0.5) {
            return "Blues or Indie";
        }
        return null;
    };

    return (
        <div className="ai-insights-container">
            <div className="insights-header">
                <h3>
                    <span className="ai-icon">🤖</span>
                    AI-Powered Insights
                </h3>
                <button
                    className="regenerate-btn"
                    onClick={generateInsights}
                    disabled={isGenerating}
                >
                    {isGenerating ? '🔄' : '✨'}
                    {isGenerating ? 'Analyzing...' : 'Regenerate'}
                </button>
            </div>

            {isGenerating ? (
                <div className="generating-insights">
                    <div className="ai-thinking">
                        <div className="thinking-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                        <p>AI is analyzing the musical characteristics...</p>
                    </div>
                </div>
            ) : (
                <div className="insights-content">
                    {insights.length > 0 && (
                        <>
                            <div className="insight-navigation">
                                <button
                                    className="nav-btn"
                                    onClick={() => setCurrentInsight(Math.max(0, currentInsight - 1))}
                                    disabled={currentInsight === 0}
                                >
                                    ← Previous
                                </button>
                                <span className="insight-counter">
                                    {currentInsight + 1} of {insights.length}
                                </span>
                                <button
                                    className="nav-btn"
                                    onClick={() => setCurrentInsight(Math.min(insights.length - 1, currentInsight + 1))}
                                    disabled={currentInsight === insights.length - 1}
                                >
                                    Next →
                                </button>
                            </div>

                            <div className="current-insight">
                                <div className="insight-text">
                                    {insights[currentInsight]}
                                </div>
                            </div>

                            <div className="insights-overview">
                                <h4>All Insights</h4>
                                <div className="insights-grid">
                                    {insights.map((insight, index) => (
                                        <div
                                            key={index}
                                            className={`insight-card ${index === currentInsight ? 'active' : ''}`}
                                            onClick={() => setCurrentInsight(index)}
                                        >
                                            <div className="insight-preview">
                                                {insight.split(' ').slice(0, 8).join(' ')}...
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default AIInsights;
