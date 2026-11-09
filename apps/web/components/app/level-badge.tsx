import type { CefrLevel } from '@parle-tcf/shared';
import { LEVEL_STYLES } from '@/lib/cefr';

export function LevelBadge({ level }: { level: CefrLevel | null }) {
  if (!level) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-sm font-bold ${LEVEL_STYLES[level]}`}
      aria-label={`Niveau ${level}`}
    >
      {level}
    </span>
  );
}
