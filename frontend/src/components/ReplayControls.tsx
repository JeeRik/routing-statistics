import { useEffect, useRef, useState } from 'react';

interface Props {
  durationMs: number;
  timeMs: number;
  onTimeChange: (t: number) => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const s = (totalSec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function ReplayControls({ durationMs, timeMs, onTimeChange }: Props) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(10);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeMsRef = useRef(timeMs);
  timeMsRef.current = timeMs;

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const next = timeMsRef.current + speed * 1000;
      if (next >= durationMs) {
        setPlaying(false);
        onTimeChange(durationMs);
      } else {
        onTimeChange(next);
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, durationMs, onTimeChange]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: '#1e2530',
        borderTop: '1px solid #2a3a4a',
        flexShrink: 0,
      }}
    >
      <button
        onClick={() => setPlaying((p) => !p)}
        style={{
          background: playing ? '#d45500' : '#2a7a4a',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '6px 16px',
          fontSize: 14,
          cursor: 'pointer',
          fontWeight: 700,
          minWidth: 72,
        }}
      >
        {playing ? 'Pause' : 'Play'}
      </button>

      <span style={{ color: '#e0eaf0', fontFamily: 'monospace', fontSize: 16, minWidth: 52 }}>
        {formatTime(timeMs)}
      </span>

      <input
        type="range"
        min={0}
        max={durationMs}
        step={1000}
        value={timeMs}
        onChange={(e) => {
          setPlaying(false);
          onTimeChange(Number(e.target.value));
        }}
        style={{ flex: 1, cursor: 'pointer', accentColor: '#37abc8' }}
      />

      <span style={{ color: '#8a9aaa', fontFamily: 'monospace', fontSize: 14 }}>
        {formatTime(durationMs)}
      </span>

      <label style={{ color: '#8a9aaa', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        Speed
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          style={{ background: '#111820', color: '#e0eaf0', border: '1px solid #3a4a5a', borderRadius: 4, padding: '2px 6px' }}
        >
          <option value={1}>1×</option>
          <option value={5}>5×</option>
          <option value={10}>10×</option>
          <option value={30}>30×</option>
          <option value={60}>60×</option>
        </select>
      </label>
    </div>
  );
}
