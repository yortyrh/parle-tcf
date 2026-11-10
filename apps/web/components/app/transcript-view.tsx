import type { AttemptDetail } from '@parle-tcf/shared';
import { ERROR_STYLES } from '@/lib/cefr';

type Line = AttemptDetail['transcript'][number];

function HighlightedText({ line }: { line: Line }) {
  const errors = [...(line.errors ?? [])].sort((a, b) => a.start - b.start);
  if (errors.length === 0) return <>{line.text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  errors.forEach((e, i) => {
    if (e.start < cursor) return; // overlapping: keep the first
    if (e.start > cursor) parts.push(line.text.slice(cursor, e.start));
    parts.push(
      <mark
        key={i}
        className={`${ERROR_STYLES[e.type]} rounded px-0.5 text-inherit`}
        title={`${e.type} : ${e.explanation}`}
      >
        {line.text.slice(e.start, e.end)}
        <span className="sr-only"> (erreur de {e.type})</span>
      </mark>
    );
    cursor = e.end;
  });
  parts.push(line.text.slice(cursor));
  return <>{parts}</>;
}

export function TranscriptView({ lines, corrected }: { lines: Line[]; corrected: boolean }) {
  return (
    <ol className="space-y-3">
      {lines.map((line) => {
        const isCandidate = line.speaker === 'candidate';
        return (
          <li
            key={line.seq}
            className={`rounded-xl border p-4 text-sm ${isCandidate ? 'bg-card' : 'bg-muted/40'}`}
          >
            <p className="text-muted-foreground mb-1 text-xs font-semibold uppercase">
              {isCandidate ? 'Candidat' : 'Examinateur'}
            </p>
            {isCandidate && corrected ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground mb-1 text-[11px] font-medium">
                      Ce que vous avez dit
                    </p>
                    <p>
                      <HighlightedText line={line} />
                    </p>
                  </div>
                  <div className="sm:border-l sm:pl-3">
                    <p className="text-muted-foreground mb-1 text-[11px] font-medium">
                      Version corrigée
                    </p>
                    <p className="text-success">{line.correctedText ?? line.text}</p>
                  </div>
                </div>
                {line.errors && line.errors.length > 0 && (
                  <ul className="text-muted-foreground mt-3 space-y-1 border-t pt-2 text-xs">
                    {line.errors.map((e, i) => (
                      <li key={i}>
                        <span className="text-foreground font-semibold capitalize">{e.type}</span> «{' '}
                        {line.text.slice(e.start, e.end)} » : {e.explanation}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p>{line.text}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function ErrorLegend() {
  return (
    <ul className="mb-3 flex flex-wrap gap-3 text-xs" aria-label="Légende des erreurs">
      {(Object.keys(ERROR_STYLES) as (keyof typeof ERROR_STYLES)[]).map((k) => (
        <li key={k} className="flex items-center gap-1">
          <span className={`inline-block h-3 w-3 rounded ${ERROR_STYLES[k]}`} aria-hidden />
          {k}
        </li>
      ))}
    </ul>
  );
}
