# Examiner prompts

## Summary

The examiner is a speech-to-speech model (OpenAI Realtime or Gemini Live) driven by one system prompt per task. Prompts are in French because the model speaks them to the candidate. They live in YAML files that the API loads per session; the browser adds the greeting and starts the conversation. Grading is done afterwards by a separate text model with its own prompt (see [evaluation](./features/evaluation.md)).

## How a session prompt is assembled

1. `apps/api/config/agents/tache{1,2,3}.yml` provides `baseInstructions` (role, objective, language) and `instructions` (tone, turn length, flow, forbidden behaviours, silences and unclear audio, tools, closing).
2. `ExamSessionService.buildFullInstructions` (`apps/api/src/session/exam-session.service.ts`) joins them and appends the task content under a label:
   - Tâche 1: the reference question bank `apps/api/config/info/questions-tache1-entretien.md`, under « BANQUE DE QUESTIONS DE RÉFÉRENCE (à puiser, à varier, à ne JAMAIS lire ni énumérer au candidat) ».
   - Tâches 2 and 3: the subject from the exercise bank, under « EXERCICE À UTILISER ».
3. The browser (`apps/web/providers/realtime-exam-provider.tsx`) appends the YAML `greeting` under « Consigne d'accueil initiale », opens the session, then sends a user message « Le candidat est prêt… » so that the examiner speaks first.
4. When the countdown ends, the browser sends a time-up message asking for the fixed closing line and the `finSession` call.

Client-side tools (descriptions in `apps/web/lib/exam-tools.ts`, identical for both providers):

| Tool              | Effect                                                              | When the model may call it                             |
| ----------------- | ------------------------------------------------------------------- | ------------------------------------------------------ |
| `finSession`      | Saves the transcript and closes the task after a short grace period | Once, right after « Merci, l'épreuve est terminée. »   |
| `recommencerTest` | Restarts the task from the beginning                                | Only when the candidate explicitly asks to start again |

## Prompt structure

Each `instructions` block uses short labelled sections, in this order (sections that do not apply are left out):

| Section                         | Content                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `# Rôle et objectif`            | Who the model is and the single goal (make the candidate speak; never grade)            |
| `# Langue`                      | French only, pinned with Google's recommended wording; never infer language from accent |
| `# Personnalité et ton`         | Register, formality, pace                                                               |
| `# Contexte`                    | Where the subject is in the prompt; the candidate already sees it on screen             |
| `# Longueur des répliques`      | Per-turn length (one question; one or two sentences)                                    |
| `# Déroulement`                 | Ordered phases, each with an exit condition (Tâche 3 has three phases)                  |
| `# Interdits …`                 | Forbidden coaching behaviours, with concrete examples                                   |
| `# Exemples`                    | Correct and incorrect lines, marked as models to vary                                   |
| `# Silences et audio peu clair` | What to do on hesitations, silence and unintelligible audio                             |
| `# Outils`                      | When to call each tool and when not to                                                  |
| `# Clôture`                     | Exit condition (time-up message or explicit stop), fixed closing line, `finSession`     |

## Provider best practices applied

From the OpenAI realtime/voice prompting guide and the Gemini Live API best practices:

- **Labelled sections and literal rules** instead of long prose; no contradictory rules (the examiner never grades, so the old « score sur 699 points » line was removed).
- **Language pinning:** « RÉPONDS EN FRANÇAIS. TU DOIS RÉPONDRE SANS AUCUNE AMBIGUÏTÉ EN FRANÇAIS. » (Gemini's recommended `RESPOND IN … YOU MUST RESPOND UNMISTAKABLY IN …`), plus « ne déduis jamais la langue de l'accent » (OpenAI).
- **Length per turn type**, not a vague "be concise".
- **Sample phrases as inspiration:** the model is told to vary them and never repeat the same sentence twice in a row; only the closing line is fixed.
- **Unclear audio:** ask once for a repetition, never guess, never ask twice in a row; an accent or mistakes are not unclear audio (important for language learners).
- **Rules the model can follow:** the model cannot measure seconds of silence or start a timer, so prompts refer to events it does receive (a silent turn, hesitations, the time-up message).
- **Tool rules** both in the prompt and in each tool description, with "when to call" and "when not to call".
- **The model speaks first** because the client sends an explicit start message (Gemini waits for input otherwise).
- **Session settings** that suit learners: French transcription hint and low semantic VAD eagerness (OpenAI), low end-of-speech sensitivity (Gemini), so pauses to find words do not end the turn.

## Editing the prompts

- Keep the YAML keys (`name`, `description`, `settings`, `baseInstructions`, `instructions`, `greeting`); `ExamConfigService` validates them.
- Keep the labels the API appends (« BANQUE DE QUESTIONS DE RÉFÉRENCE », « EXERCICE À UTILISER ») and the tool names in sync with the code.
- Restart the API after an edit: configs are cached in memory.
- Test with both providers and with a hesitant speaker; there is no automated eval for the examiner yet (the corrector has one: `pnpm --filter @parle-tcf/api evals`).

## Sources

- OpenAI, [Voice prompting guide](https://developers.openai.com/api/docs/guides/voice-prompting) and [Realtime VAD](https://developers.openai.com/api/docs/guides/realtime-vad).
- Google, [Live API best practices](https://ai.google.dev/gemini-api/docs/live-api/best-practices).
