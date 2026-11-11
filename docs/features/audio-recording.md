# Audio recording

## Summary

Optional recording of the candidate's microphone for each attempt, so they can listen to themselves on the result page. Off by default, enabled only with explicit consent, and available only when the deployment configures S3-compatible storage.

## User flow

1. In **Paramètres**, the user turns recording on (consent stored with a timestamp).
2. During a session the browser records the microphone (`MediaRecorder`) and uploads it when the task ends.
3. The result page offers « Réécouter l'enregistrement ».
4. Withdrawing consent deletes every stored recording. Deleting an attempt or the account deletes its recordings too.

## How it works

- The browser asks `/audio/upload-url` for a **presigned POST** capped in size, uploads directly to the bucket, then calls `/audio/confirm`. The API links the recording to the attempt only after checking the object exists and its size.
- Playback uses a short-lived signed GET URL (`/audio/download-url`).
- Every call checks consent and attempt ownership.

## Configuration

`S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`. Unset means recording is unavailable. The bucket CORS must allow POST and GET from the web origin; locally `pnpm infra:up` creates the bucket and its CORS on RustFS.

## Data

`user_preferences.audio_consent_at`, `exam_attempts.audio_key`.

## Code map

`apps/api/src/audio/` (`audio.service.ts`, `s3-audio-storage.ts`), `apps/web/lib/audio-recorder.ts`.

## Tests

`audio.service.spec.ts`, `s3-audio-storage.spec.ts`, `audio.controller.spec.ts`, `apps/web/lib/audio-recorder.test.ts`.
