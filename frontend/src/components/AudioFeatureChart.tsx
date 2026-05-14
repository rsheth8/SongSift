import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts';
import '../styling/audiofeaturechart.css';

interface AudioFeatures {
    tempo?: number;
    key?: string;
    energy?: number;
    danceability?: number;
    acousticness?: number;
    instrumentalness?: number;
    valence?: number;
    loudness?: number;
    speechiness?: number;
    liveness?: number;
    [key: string]: any; // Allow for additional properties
}

interface AudioFeatureChartProps {
    features: AudioFeatures;
    comparisonFeatures?: AudioFeatures;
    chartType: 'radar' | 'bar' | 'line';
    title?: string;
}

const AudioFeatureChart: React.FC<AudioFeatureChartProps> = ({
                                                                 features,
                                                                 comparisonFeatures,
                                                                 chartType,
                                                                 title
                                                             }) => {
    console.log('AudioFeatureChart received features:', features);

    // Enhanced normalize function with better data extraction
    const normalizeFeatures = (feat: AudioFeatures) => {
        // Helper function to safely get numeric values
        const getValue = (value: any): number => {
            if (typeof value === 'number') return Math.max(0, Math.min(1, value));
            if (typeof value === 'string') {
                const parsed = parseFloat(value);
                return isNaN(parsed) ? 0 : Math.max(0, Math.min(1, parsed));
            }
            return 0;
        };

        // Try to extract values from different possible property names
        const extractValue = (primaryKey: string, alternativeKeys: string[] = []): number => {
            // First try the primary key
            if (feat[primaryKey] !== undefined) {
                return getValue(feat[primaryKey]);
            }

            // Try alternative keys
            for (const altKey of alternativeKeys) {
                if (feat[altKey] !== undefined) {
                    return getValue(feat[altKey]);
                }
            }

            return 0;
        };

        const normalizedData = [
            {
                feature: 'Energy',
                value: extractValue('energy', ['Energy']),
                fullMark: 1,
                rawValue: feat.energy || feat.Energy || 0
            },
            {
                feature: 'Danceability',
                value: extractValue('danceability', ['Danceability', 'dance']),
                fullMark: 1,
                rawValue: feat.danceability || feat.Danceability || 0
            },
            {
                feature: 'Valence',
                value: extractValue('valence', ['Valence', 'mood', 'positivity']),
                fullMark: 1,
                rawValue: feat.valence || feat.Valence || 0
            },
            {
                feature: 'Acousticness',
                value: extractValue('acousticness', ['Acousticness', 'acoustic']),
                fullMark: 1,
                rawValue: feat.acousticness || feat.Acousticness || 0
            },
            {
                feature: 'Instrumentalness',
                value: extractValue('instrumentalness', ['Instrumentalness', 'instrumental']),
                fullMark: 1,
                rawValue: feat.instrumentalness || feat.Instrumentalness || 0
            },
            {
                feature: 'Speechiness',
                value: extractValue('speechiness', ['Speechiness', 'speech']),
                fullMark: 1,
                rawValue: feat.speechiness || feat.Speechiness || 0
            },
            {
                feature: 'Liveness',
                value: extractValue('liveness', ['Liveness', 'live']),
                fullMark: 1,
                rawValue: feat.liveness || feat.Liveness || 0
            }
        ];

        console.log('Normalized data:', normalizedData);
        return normalizedData;
    };

    const primaryData = normalizeFeatures(features);
    const comparisonData = comparisonFeatures ? normalizeFeatures(comparisonFeatures) : null;

    // Combine data for comparison charts
    const combinedData = primaryData.map((item, index) => ({
        ...item,
        comparison: comparisonData ? comparisonData[index].value : 0
    }));

    // Enhanced tooltip to show raw values
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="custom-tooltip" style={{
                    backgroundColor: '#2d2d2d',
                    border: '1px solid #6200ea',
                    borderRadius: '8px',
                    padding: '10px',
                    color: '#fff'
                }}>
                    <p className="tooltip-label">{`${label}`}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} style={{ color: entry.color }}>
                            {`${entry.name}: ${(entry.value * 100).toFixed(1)}%`}
                            {entry.payload.rawValue !== undefined && (
                                <span style={{ fontSize: '0.8em', opacity: 0.7 }}>
                                    {` (raw: ${entry.payload.rawValue})`}
                                </span>
                            )}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    const renderRadarChart = () => {
        // Combine data for radar chart when we have comparison
        const radarData = primaryData.map((item, index) => ({
            ...item,
            comparison: comparisonData ? comparisonData[index].value : undefined
        }));

        return (
            <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                    <PolarGrid stroke="rgba(255, 255, 255, 0.2)" />
                    <PolarAngleAxis
                        dataKey="feature"
                        tick={{ fill: '#fff', fontSize: 12 }}
                    />
                    <PolarRadiusAxis
                        angle={90}
                        domain={[0, 1]}
                        tick={{ fill: '#fff', fontSize: 10 }}
                    />
                    <Radar
                        name="Primary Song"
                        dataKey="value"
                        stroke="#6200ea"
                        fill="#6200ea"
                        fillOpacity={0.3}
                        strokeWidth={3}
                        dot={{ fill: '#6200ea', strokeWidth: 2, r: 4 }}
                    />
                    {comparisonData && (
                        <Radar
                            name="Comparison Song"
                            dataKey="comparison"
                            stroke="#03dac6"
                            fill="#03dac6"
                            fillOpacity={0.2}
                            strokeWidth={3}
                            dot={{ fill: '#03dac6', strokeWidth: 2, r: 4 }}
                        />
                    )}
                    <Tooltip content={<CustomTooltip />} />
                    {/* Add Legend */}
                    <Legend
                        wrapperStyle={{
                            paddingTop: '20px',
                            color: '#fff'
                        }}
                    />
                </RadarChart>
            </ResponsiveContainer>
        );
    };

    const renderBarChart = () => (
        <ResponsiveContainer width="100%" height={400}>
            <BarChart data={combinedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis
                    dataKey="feature"
                    tick={{ fill: '#fff', fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                />
                <YAxis tick={{ fill: '#fff', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#6200ea" name="Current Song" />
                {comparisonFeatures && (
                    <Bar dataKey="comparison" fill="#03dac6" name="Comparison" />
                )}
            </BarChart>
        </ResponsiveContainer>
    );

    const renderLineChart = () => (
        <ResponsiveContainer width="100%" height={400}>
            <LineChart data={combinedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                <XAxis
                    dataKey="feature"
                    tick={{ fill: '#fff', fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                />
                <YAxis tick={{ fill: '#fff', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#6200ea"
                    strokeWidth={3}
                    dot={{ fill: '#6200ea', strokeWidth: 2, r: 6 }}
                    name="Current Song"
                />
                {comparisonFeatures && (
                    <Line
                        type="monotone"
                        dataKey="comparison"
                        stroke="#03dac6"
                        strokeWidth={3}
                        dot={{ fill: '#03dac6', strokeWidth: 2, r: 6 }}
                        name="Comparison"
                    />
                )}
            </LineChart>
        </ResponsiveContainer>
    );

    // Show data summary for debugging
    const hasData = primaryData.some(item => item.value > 0);

    return (
        <div className="audio-feature-chart">
            {title && <h3 className="chart-title">{title}</h3>}

            {!hasData && (
                <div className="no-data-warning" style={{
                    background: 'rgba(255, 193, 7, 0.1)',
                    border: '1px solid rgba(255, 193, 7, 0.3)',
                    borderRadius: '8px',
                    padding: '16px',
                    margin: '16px 0',
                    color: '#ffc107'
                }}>
                    <strong>⚠️ Limited Data Available</strong>
                    <p>Only basic audio features are available for this song. Some advanced features may require re-analysis.</p>
                </div>
            )}

            <div className="chart-container">
                {chartType === 'radar' && renderRadarChart()}
                {chartType === 'bar' && renderBarChart()}
                {chartType === 'line' && renderLineChart()}
            </div>

            {comparisonFeatures && (
                <div className="chart-legend">
                    <div className="legend-item">
                        <div className="legend-color" style={{ backgroundColor: '#6200ea' }}></div>
                        <span>Current Song</span>
                    </div>
                    <div className="legend-item">
                        <div className="legend-color" style={{ backgroundColor: '#03dac6' }}></div>
                        <span>Comparison</span>
                    </div>
                </div>
            )}

            {/* Data summary for debugging */}
            <div className="data-summary" style={{
                fontSize: '0.8rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginTop: '16px',
                padding: '8px',
                background: 'rgba(255, 255, 255, 0.05)',
                borderRadius: '4px'
            }}>
                <strong>Data Summary:</strong> {primaryData.filter(item => item.value > 0).length} of {primaryData.length} features have values
            </div>
        </div>
    );
};

export default AudioFeatureChart;
