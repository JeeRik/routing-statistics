import type { ProcessDef } from '../types/game';

export interface ProcessSet {
  key: string;
  name: string;
  processes: Record<string, ProcessDef>;
  materials: Record<string, { capacity: number }>;
}

export const MATERIAL_NAME_COLORS: Record<string, string> = {
  blue:   '#37abc8',
  yellow: '#ffcc00',
  green:  '#aad400',
  gray:   '#93a7ac',
  orange: '#d45500',
  pink:   '#d35f8d',
  red:    '#d40000',
  purple: '#aa87de',
  brown:  '#a05a2c',
};

export function processOutputColor(processName: string, processes: Record<string, ProcessDef>): string {
  const proc = processes[processName];
  if (!proc) return '#4a6070';
  const outMat = Object.keys(proc.outputs)[0];
  return outMat ? (MATERIAL_NAME_COLORS[outMat] ?? '#4a6070') : '#4a6070';
}

export function matchesProcessSet(processes: Record<string, unknown>, ps: ProcessSet): boolean {
  const a = Object.keys(processes).sort().join(',');
  const b = Object.keys(ps.processes).sort().join(',');
  return a === b;
}

export function findMatchingSet(processes: Record<string, unknown>, sets: ProcessSet[]): string | null {
  return sets.find((s) => matchesProcessSet(processes, s))?.key ?? null;
}

export function detectProcessSet(processes: Record<string, unknown>): string {
  const keys = Object.keys(processes);
  if (keys.some((k) => ['factory_red', 'factory_purple', 'factory_brown', 'factory_rocket'].includes(k)))
    return 'full';
  if (keys.some((k) => ['factory_gray', 'factory_orange', 'factory_pink'].includes(k)))
    return 'tier1_2';
  return 'tier1';
}
