/**
 * Short looping illustration of a session (no media file): the examiner's
 * question, the candidate answering with live voice bars, then the corrected
 * sentence. Pure CSS; reduced-motion users see the final state.
 */
export function DemoLoop() {
  return (
    <figure
      className="bg-card shadow-raised relative mx-auto w-full max-w-md overflow-hidden rounded-2xl border p-5"
      aria-label="Exemple de session : l’examinateur pose une question, le candidat répond, puis la correction s’affiche."
    >
      <div className="mb-4 flex items-center justify-between text-xs">
        <span className="bg-primary/10 text-primary rounded-full px-2.5 py-1 font-semibold">
          Tâche 3 · Point de vue
        </span>
        <span className="text-muted-foreground font-mono tabular-nums">03:12</span>
      </div>
      <div className="flex flex-col gap-3 text-sm" aria-hidden>
        <p className="demo-step bg-muted max-w-[85%] rounded-2xl rounded-tl-sm px-4 py-3 [animation-delay:0s]">
          Selon vous, le télétravail améliore-t-il la qualité de vie ?
        </p>
        <div className="demo-step bg-primary text-primary-foreground ml-auto flex max-w-[85%] flex-col gap-2 rounded-2xl rounded-tr-sm px-4 py-3 [animation-delay:1.2s]">
          <span>Je pense que oui, parce que on gagne du temps…</span>
          <span className="flex h-4 items-end gap-0.5">
            {[0.5, 0.9, 0.4, 1, 0.7, 0.3, 0.8, 0.6, 1, 0.4].map((s, i) => (
              <span
                key={i}
                className="demo-bar w-1 rounded-full bg-current opacity-70"
                style={{ ['--bar-scale' as string]: s, animationDelay: `${i * 90}ms` }}
              />
            ))}
          </span>
        </div>
        <p className="demo-step bg-highlight-soft rounded-xl px-4 py-3 text-xs [animation-delay:2.6s]">
          <span className="font-semibold">Correction :</span> « parce{' '}
          <mark className="rounded bg-red-200 px-0.5 text-inherit dark:bg-red-900">qu’on</mark>{' '}
          gagne du temps » · élision devant voyelle.
        </p>
      </div>
      <style>{`
        .demo-step { animation: demo-in 6s ease-in-out infinite both; }
        .demo-bar { height: 100%; transform-origin: bottom; animation: voice-bar 0.9s ease-in-out infinite; }
        @keyframes demo-in {
          0% { opacity: 0; transform: translateY(6px); }
          8%, 85% { opacity: 1; transform: none; }
          100% { opacity: 0; transform: translateY(-4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .demo-step, .demo-bar { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </figure>
  );
}
