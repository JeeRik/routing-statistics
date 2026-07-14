import { Routes, Route, Navigate } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { RoundsList } from './pages/RoundsList';
import { Visualizer } from './pages/Visualizer';
import { TopologyList } from './pages/TopologyList';
import { TopologyEditor } from './pages/TopologyEditor';
import { FactorySetEditor } from './pages/FactorySetEditor';

export default function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#111820', color: '#e0eaf0' }}>
      <AppHeader />
      <Routes>
        <Route path="/" element={<Navigate to="/rounds" replace />} />
        <Route path="/rounds" element={<RoundsList />} />
        <Route path="/visualize/:roundId" element={<Visualizer />} />
        <Route path="/topologies" element={<TopologyList />} />
        <Route path="/topology/new" element={<TopologyEditor />} />
        <Route path="/topology/:topoId/edit" element={<TopologyEditor />} />
        <Route path="/factory-sets" element={<FactorySetEditor />} />
      </Routes>
    </div>
  );
}
