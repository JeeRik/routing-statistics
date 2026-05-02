import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { LayoutData, RoundDefinition, RoundSummary } from '../types/game';

interface RoundRow extends RoundSummary {
  customName: string | null;
  topology: string | null;
}

function formatDuration(s: number): string {
  if (s <= 0) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
}

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

function NameCell({ row, onNameChange }: { row: RoundRow; onNameChange: (name: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startEdit = () => {
    setDraft(row.customName ?? row.round_name);
    setEditing(true);
  };

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    setEditing(false);
    onNameChange(draft.trim());
  };

  const cancel = () => {
    setEditing(false);
  };

  if (row.customName === null) {
    return <span style={{ color: '#3a5060' }}>…</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  commit();
          if (e.key === 'Escape') cancel();
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', background: '#111820', color: '#e0eaf0',
          border: '1px solid #37abc8', borderRadius: 5,
          padding: '3px 6px', fontSize: 13, outline: 'none',
        }}
      />
    );
  }

  return (
    <span
      onClick={startEdit}
      title="Click to rename"
      style={{ cursor: 'text', display: 'block' }}
    >
      {row.customName || row.round_name}
    </span>
  );
}

function RoundRow({ row, onOpen, onNameChange }: {
  row: RoundRow;
  onOpen: () => void;
  onNameChange: (name: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderBottom: '1px solid #1e2a38',
        background: hovered ? 'rgba(55,171,200,0.08)' : 'transparent',
        color: hovered ? '#c8dce8' : '#e0eaf0',
        transition: 'background 0.1s, color 0.1s',
      }}
    >
      <td style={{ ...tdStyle, fontFamily: 'monospace', color: '#6a8090' }}>{row.round_id}</td>
      <td style={tdStyle}>
        <NameCell row={row} onNameChange={onNameChange} />
      </td>
      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{row.event_count.toLocaleString()}</td>
      <td style={{ ...tdStyle, fontFamily: 'monospace', color: row.topology === null ? '#3a5060' : undefined }}>
        {row.topology ?? '…'}
      </td>
      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{formatDuration(row.duration_s)}</td>
      <td style={{ ...tdStyle, textAlign: 'right' }}>
        <button
          onClick={onOpen}
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
          Open →
        </button>
      </td>
    </tr>
  );
}

export function RoundsList() {
  const [rows, setRows] = useState<RoundRow[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rounds = await api.getRounds();
      if (cancelled) return;
      setRows(rounds.map((r) => ({ ...r, customName: null, topology: null })));

      const [layouts, definitions] = await Promise.all([
        Promise.allSettled(rounds.map((r) => api.getLayout(r.round_id))),
        Promise.allSettled(rounds.map((r) => api.getDefinition(r.round_id))),
      ]);
      if (cancelled) return;
      setRows(
        rounds.map((r, i) => ({
          ...r,
          customName:
            layouts[i].status === 'fulfilled'
              ? ((layouts[i] as PromiseFulfilledResult<LayoutData>).value.custom_name ?? '')
              : '',
          topology:
            definitions[i].status === 'fulfilled'
              ? (() => {
                  const def = (definitions[i] as PromiseFulfilledResult<RoundDefinition>).value;
                  return `${Object.keys(def.routers).length} / ${def.links.length}`;
                })()
              : '—',
        })),
      );
    })();
    return () => { cancelled = true; };
  }, []);

  const handleNameChange = (roundId: number, name: string) => {
    setRows((prev) =>
      prev.map((r) => r.round_id === roundId ? { ...r, customName: name } : r),
    );
    api.saveLayout(roundId, { custom_name: name || undefined }).catch(console.error);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
      <div style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
        textTransform: 'uppercase', color: '#4a6070', marginBottom: 20,
      }}>
        Rounds
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #2a3a4a' }}>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Events</th>
            <th style={thStyle}>Topology</th>
            <th style={thStyle}>Duration</th>
            <th style={thStyle} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RoundRow
              key={row.round_id}
              row={row}
              onOpen={() => navigate(`/visualize/${row.round_id}`)}
              onNameChange={(name) => handleNameChange(row.round_id, name)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
