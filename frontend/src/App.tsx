// App.tsx
import { Routes, Route } from 'react-router-dom';
import FileUpload from './components/fileupload';
import InDepthAnalysis from './components/indepthanalysis';
import RecommendationView from './components/RecommendationView';
import PlaylistGenerator from './components/PlaylistGenerator';
import MusicMapExplorer from './components/MusicMapExplorer';
import LyricAnalyzer from './components/LyricAnalyzer';
import MashupCreator from './components/MashupCreator';

function App() {
    return (
        <div className="app">
            <Routes>
                <Route path="/" element={<FileUpload />} />
                <Route path="/in-depth-analysis" element={<InDepthAnalysis />} />
                <Route path="/recommendations" element={<RecommendationView />} />
                <Route path="/playlists/generate" element={<PlaylistGenerator />} />
                <Route path="/music-map" element={<MusicMapExplorer />} />
                <Route path="/lyrics" element={<LyricAnalyzer />} />
                <Route path="/mashup" element={<MashupCreator />} />
            </Routes>
        </div>
    );
}

export default App;
