import { NavLink, useLocation } from 'react-router-dom';
import { getCookie } from '../utils/cookies';

export function AppHeader() {
  const { pathname } = useLocation();

  const lastRoundId  = getCookie('last_round_id');
  const lastTopoId   = getCookie('last_topo_id');

  const roundsActive = pathname.startsWith('/rounds') || pathname.startsWith('/visualize/');
  const topoActive   = pathname.startsWith('/topologies') || pathname.startsWith('/topology/');

  const roundsTo     = roundsActive || !lastRoundId ? '/rounds'               : `/visualize/${lastRoundId}`;
  const topologiesTo = topoActive   || !lastTopoId  ? '/topologies'           : `/topology/${lastTopoId}/edit`;

  const linkStyle = (active: boolean): React.CSSProperties => ({
    fontSize: 13,
    color: active ? '#37abc8' : '#6a8090',
    textDecoration: 'none',
    transition: 'color 0.1s',
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 16px', height: 42,
      background: '#1a2230', borderBottom: '1px solid #2a3a4a',
      flexShrink: 0,
    }}>
      <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 1, color: '#c8dce8' }}>
        routing-statistics
      </span>
      <NavLink to={roundsTo} style={() => linkStyle(roundsActive)}>
        Rounds
      </NavLink>
      <NavLink to={topologiesTo} style={() => linkStyle(topoActive)}>
        Topologies
      </NavLink>
    </div>
  );
}
