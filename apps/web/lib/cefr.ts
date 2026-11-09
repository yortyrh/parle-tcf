import type { CefrLevel } from '@parle-tcf/shared';

export const LEVEL_STYLES: Record<CefrLevel, string> = {
  A1: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  A2: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  B1: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200',
  B2: 'bg-lime-100 text-lime-900 dark:bg-lime-950 dark:text-lime-200',
  C1: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-200',
  C2: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
};

export const ERROR_STYLES = {
  grammaire: 'bg-red-200 dark:bg-red-900',
  lexique: 'bg-blue-200 dark:bg-blue-900',
  syntaxe: 'bg-amber-200 dark:bg-amber-900',
  registre: 'bg-purple-200 dark:bg-purple-900',
} as const;

export function formatCost(usd: number | null): string {
  if (usd === null) return '—';
  return `${usd < 0.01 ? '< 0,01' : usd.toFixed(2).replace('.', ',')} $`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return '—';
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`;
}

export const TASK_LABELS: Record<number, string> = {
  1: 'Tâche 1 · Entretien',
  2: 'Tâche 2 · Interaction',
  3: 'Tâche 3 · Point de vue',
};
