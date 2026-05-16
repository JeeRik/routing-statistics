import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { TopologySummary } from '../types/game';

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontWeight: 700,
  fontSize: 10,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#4a6070',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
};

function TopoRow({
  topo,
  onEdit,
  onDelete,
}: {
  topo: TopologySummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setConfirming(false); }}
      style={{
        borderBottom: '1px solid #1e2a38',
        background: hovered ? 'rgba(55,171,200,0.08)' : 'transparent',
        color: hovered ? '#c8dce8' : '#e0eaf0',
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#6a8090' }}>{topo.id}</td>
      <td style={tdStyle}>{topo.name}</td>
      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{topo.station_count}</td>
      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{topo.link_count}</td>
      <td style={{ ...tdStyle, textAlign: 'right', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          onClick={onEdit}
          style={{
            background: 'transparent',
            color: '#37abc8',
            border: '1px solid #2a3a4a',
            borderRadius: 5,
            padding: '4px 12px',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Edit →
        </button>
        {confirming ? (
          <button
            onClick={() => { setConfirming(false); onDelete(); }}
            style={{
              background: '#3a1010',
              color: '#d46060',
              border: '1px solid #5a2020',
              borderRadius: 5,
              padding: '4px 12px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Confirm delete
          </button>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            style={{
              background: 'transparent',
              color: '#6a8090',
              border: '1px solid #2a3a4a',
              borderRadius: 5,
              padding: '4px 12px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        )}
      </td>
    </tr>
  );
}

export function TopologyList() {
  const [topos, setTopos] = useState<TopologySummary[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.getTopologies().then(setTopos).catch(console.error);
  }, []);

  const handleDelete = async (id: number) => {
    try {
      await api.deleteTopology(id);
      setTopos((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 20, marginBottom: 20 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#4a6070',
        }}>
          Topologies
        </div>
        <button
          onClick={() => navigate('/topology/new')}
          style={{
            background: 'rgba(55,171,200,0.15)',
            color: '#37abc8',
            border: '1px solid rgba(55,171,200,0.4)',
            borderRadius: 5,
            padding: '4px 14px',
            fontSize: 12,
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          + New topology
        </button>
      </div>
      {topos.length === 0 ? (
        <div style={{ color: '#3a5060', fontSize: 13, fontFamily: 'monospace' }}>
          No topologies yet. Click "+ New topology" to create one.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #2a3a4a' }}>
              <th style={thStyle}>ID</th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Stations</th>
              <th style={thStyle}>Links</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {topos.map((t) => (
              <TopoRow
                key={t.id}
                topo={t}
                onEdit={() => navigate(`/topology/${t.id}/edit`)}
                onDelete={() => handleDelete(t.id)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
