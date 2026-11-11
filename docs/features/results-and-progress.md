# Results, history and progress

## Summary

Pages that turn attempts into feedback and progress: the result of an attempt, the history, progression per task, side-by-side comparison, and a dashboard that recommends what to practise next.

## User flow

| Page            | Route                    | Content                                                                                                                        |
| --------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Tableau de bord | `/tableau-de-bord`       | Level per task, today's minutes, this month's estimated cost, next task to practise, shortcut to the full exam                 |
| Résultat        | `/resultats/<attemptId>` | Global level, per-criterion levels and comments, summary, corrected transcript, cost, recording playback, « Refaire ce sujet » |
| Historique      | `/historique`            | Paginated attempts filtered by task and mode; delete; select two attempts to compare                                           |
| Progression     | `/progression`           | Level over time per task (chart), latest level and trend                                                                       |
| Comparer        | `/comparer`              | Two attempts side by side (evaluation and transcript); only attempts on the same subject are comparable                        |

The corrected transcript shows each candidate line with its errors highlighted by type (grammar, lexicon, syntax, register) next to the corrected version; examiner lines are told apart. Every evaluation carries a notice that the level is indicative.

## How it works

- **Recommendation** (`apps/web/lib/dashboard.ts`): an untried task first, then the weakest level, then the task left aside the longest; only completed attempts count.
- **Progress** (`apps/web/lib/level-series.ts`): graded attempts of a task, oldest first; the trend compares the last point with the mean of the previous three.
- **Comparison** (`apps/web/lib/exam-flow.ts` `canCompare`): same task and same subject.
- **Deletion** removes the attempt, its transcript, its evaluation and its recording.
- Every read goes through `user_id`-filtered queries: another user's attempt answers `NOT_FOUND`.

## API

`/attempts/list`, `/attempts/get`, `/attempts/delete`, `/runs/get`, `/usage/get`, `/audio/download-url`.

## Code map

`apps/web/app/(app)/{tableau-de-bord,resultats,historique,progression,comparer}/`, `apps/web/lib/{dashboard,level-series,exam-flow,cefr}.ts`, `apps/api/src/attempts/`.

## Tests

View tests next to each page (`*.test.tsx`), `apps/web/lib/*.test.ts`, `attempts.service.spec.ts` (cross-user cases), `apps/e2e/tests/history.spec.ts`.
