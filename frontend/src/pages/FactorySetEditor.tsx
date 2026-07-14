import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type { FactorySetSummary } from '../types/game';

function SetListItem({
  item,
  selected,
  onSelect,
  onRename,
  onDelete,
}: {
  item: FactorySetSummary;
  selected: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(item.name);
    setEditing(true);
  };

  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commitRename = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== item.name) onRename(trimmed);
  };

  const cancelRename = () => setEditing(false);

  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 12px',
        cursor: 'pointer',
        background: selected ? 'rgba(55,171,200,0.15)' : 'transparent',
        borderLeft: selected ? '2px solid #37abc8' : '2px solid transparent',
        borderBottom: '1px solid #1e2a38',
        color: selected ? '#c8dce8' : '#8a9aaa',
        transition: 'background 0.1s, color 0.1s',
        minHeight: 36,
      }}
    >
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') cancelRename();
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1, background: '#111820', color: '#e0eaf0',
            border: '1px solid #37abc8', borderRadius: 4,
            padding: '2px 6px', fontSize: 12, outline: 'none',
          }}
        />
      ) : (
        <span
          style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={item.name}
        >
          {item.name}
        </span>
      )}

      {!editing && (
        <button
          onClick={startRename}
          title="Rename"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#4a6070', fontSize: 11, padding: '1px 4px', lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ✎
        </button>
      )}

      {confirming ? (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(false); onDelete(); }}
          style={{
            background: '#3a1010', color: '#d46060', border: '1px solid #5a2020',
            borderRadius: 3, padding: '1px 6px', fontSize: 10, cursor: 'pointer', flexShrink: 0,
          }}
        >
          ✕ confirm
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(true); }}
          onBlur={() => setConfirming(false)}
          title="Delete"
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#4a6070', fontSize: 11, padding: '1px 4px', lineHeight: 1,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}

export function FactorySetEditor() {
  const [sets, setSets] = useState<FactorySetSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    api.getFactorySets().then(setSets).catch(console.error);
  }, []);

  const handleSelect = async (id: number) => {
    setSelectedId(id);
    setSaveStatus('idle');
    setParseError(null);
    try {
      const data = await api.getFactorySet(id);
      setJsonText(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(e);
    }
  };

  const handleNew = async () => {
    try {
      const summary = await api.createFactorySet();
      setSets((prev) => [...prev, summary]);
      handleSelect(summary.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRename = async (id: number, name: string) => {
    setSets((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));
    try {
      await api.renameFactorySet(id, name);
      if (selectedId === id) {
        // Sync name into JSON editor
        try {
          const parsed = JSON.parse(jsonText);
          parsed.name = name;
          setJsonText(JSON.stringify(parsed, null, 2));
        } catch {
          // leave JSON as-is if unparseable
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteFactorySet(id);
      setSets((prev) => prev.filter((s) => s.id !== id));
      if (selectedId === id) {
        setSelectedId(null);
        setJsonText('');
        setSaveStatus('idle');
        setParseError(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (selectedId === null) return;
    setParseError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      setParseError((e as Error).message);
      return;
    }

    setSaveStatus('saving');
    try {
      await api.saveFactorySet(selectedId, parsed);
      setSaveStatus('saved');
      // Update list name if changed in JSON
      const name = (parsed as Record<string, unknown>)?.name;
      if (typeof name === 'string') {
        setSets((prev) => prev.map((s) => s.id === selectedId ? { ...s, name } : s));
      }
      setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 2000);
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left panel */}
      <div style={{
        width: 240, flexShrink: 0,
        borderRight: '1px solid #2a3a4a',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 12px',
          borderBottom: '1px solid #2a3a4a',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', color: '#4a6070',
          }}>
            Factory Sets
          </span>
          <button
            onClick={handleNew}
            style={{
              background: 'rgba(55,171,200,0.15)',
              color: '#37abc8',
              border: '1px solid rgba(55,171,200,0.4)',
              borderRadius: 4,
              padding: '3px 10px',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            + New
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {sets.length === 0 ? (
            <div style={{ padding: '16px 12px', color: '#3a5060', fontSize: 12, fontFamily: 'monospace' }}>
              No factory sets yet.
            </div>
          ) : (
            sets.map((s) => (
              <SetListItem
                key={s.id}
                item={s}
                selected={selectedId === s.id}
                onSelect={() => handleSelect(s.id)}
                onRename={(name) => handleRename(s.id, name)}
                onDelete={() => handleDelete(s.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedId === null ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#3a5060', fontSize: 13, fontFamily: 'monospace',
          }}>
            Select a factory set from the left panel
          </div>
        ) : (
          <>
            <textarea
              value={jsonText}
              onChange={(e) => { setJsonText(e.target.value); setSaveStatus('idle'); setParseError(null); }}
              spellCheck={false}
              style={{
                flex: 1,
                resize: 'none',
                background: '#0d1520',
                color: '#c8dce8',
                border: 'none',
                borderBottom: '1px solid #2a3a4a',
                padding: '16px 20px',
                fontFamily: 'monospace',
                fontSize: 12,
                lineHeight: 1.6,
                outline: 'none',
              }}
            />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 16px',
              background: '#1a2230',
              flexShrink: 0,
            }}>
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                style={{
                  background: saveStatus === 'error' ? '#3a1010' : 'rgba(55,171,200,0.2)',
                  color: saveStatus === 'error' ? '#d46060' : '#37abc8',
                  border: `1px solid ${saveStatus === 'error' ? '#5a2020' : 'rgba(55,171,200,0.5)'}`,
                  borderRadius: 5,
                  padding: '5px 18px',
                  fontSize: 12,
                  cursor: saveStatus === 'saving' ? 'default' : 'pointer',
                  opacity: saveStatus === 'saving' ? 0.6 : 1,
                }}
              >
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved ✓' : 'Save'}
              </button>

              {parseError && (
                <span style={{ fontSize: 11, color: '#d46060', fontFamily: 'monospace' }}>
                  JSON error: {parseError}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
