import { NavLink } from 'react-router-dom';

export function AppHeader() {
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
      <NavLink
        to="/rounds"
        style={({ isActive }) => ({
          fontSize: 13,
          color: isActive ? '#37abc8' : '#6a8090',
          textDecoration: 'none',
          transition: 'color 0.1s',
        })}
      >
        Rounds
      </NavLink>
    </div>
  );
}
