# 3. Evaluate in the API process, not in a queue

Status: accepted

## Context

After each task a corrector LLM grades the saved transcript. Typical latency is a few seconds.

## Decision

Run the evaluation in the API process, fire-and-forget after `attempts.complete`. Status lives in `exam_attempts.evaluation_status`; on boot, `running` rows older than 5 minutes are marked `failed`; users can re-run with `attempts.reevaluate`.

## Consequences

- No queue or worker to operate.
- A crash loses the in-flight evaluation, which is recoverable by the retry button.
- If volume grows, the service boundary (`EvaluationService.evaluate`) can move behind a queue unchanged.
