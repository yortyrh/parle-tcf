# Corrector evaluation results

Rubric `v1` · 6 cases · 5 passes per case · 2026-11-11

| Model           | Cases | Exact | ±1 level | Mean error | Stability | Mean latency | Cost    |
| --------------- | ----- | ----- | -------- | ---------- | --------- | ------------ | ------- |
| gpt-4o-mini     | 6     | 67 %  | 100 %    | 0.33       | 100 %     | 5.1 s        | $0.0150 |
| gpt-6-luna@none | 6     | 100 % | 100 %    | 0.00       | 83 %      | 4.4 s        | $0.0129 |

| Model           | adequation | coherence | vocabulaire | grammaire | aisance |
| --------------- | ---------- | --------- | ----------- | --------- | ------- |
| gpt-4o-mini     | 67 %       | 67 %      | 67 %        | 67 %      | 67 %    |
| gpt-6-luna@none | 100 %      | 83 %      | 100 %       | 83 %      | 50 %    |

> The reference levels of the dataset are **synthetic** (written by the maintainer): they measure the corrector's consistency, not its agreement with a certified examiner.
