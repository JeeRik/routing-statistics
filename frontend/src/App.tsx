import { Routes, Route, Navigate } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { RoundsList } from './pages/RoundsList';
import { Visualizer } from './pages/Visualizer';

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111820', color: '#e0eaf0' }}>
      <AppHeader />
      <Routes>
        <Route path="/" element={<Navigate to="/rounds" replace />} />
        <Route path="/rounds" element={<RoundsList />} />
        <Route path="/visualize/:roundId" element={<Visualizer />} />
      </Routes>
    </div>
  );
}
