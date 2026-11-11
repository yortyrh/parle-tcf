# Changelog - Project simplification (historical)

Early history of the web app, from when it was a LiveKit voice starter (translated from French). Most files named here no longer exist; current changes are in the root [`CHANGELOG.md`](../../CHANGELOG.md).

## Summary

This update simplified and cleaned up the yorty-tcf-livekit-web project by removing unused features and reducing code complexity.

## Main changes

### 1. Simplified configuration

#### `app-config.ts`

- Removed LiveKit Cloud sandbox support
- Customised for the TCF (titles and descriptions in French)
- Video and screen sharing disabled by default
- Smaller, more focused interface

#### `lib/utils.ts`

- Removed sandbox-related functions
- Removed the remote configuration logic
- Simplified `getAppConfig()` (returns the defaults directly)
- About 100 fewer lines

### 2. Simplified components

#### `components/app/view-controller.tsx`

- Removed the `motion/react` library
- Removed complex animations
- Transition logic simplified to a plain if/else
- More readable and maintainable code

#### `components/app/welcome-view.tsx`

- Text translated into French
- Removed the link to the external documentation
- Cleaner interface
- Simpler React props

#### `components/app/session-view.tsx`

- Removed Framer Motion animations
- Simplified the `Fade` component
- Fixed the CSS gradient (`bg-gradient-to-*` instead of `bg-linear-to-*`)
- Simpler, faster code

#### `components/app/app.tsx`

- Removed the conditional token source logic
- Simplified to a single endpoint
- Translated into French ("Démarrer l'audio")

### 3. Optimised hooks

#### `hooks/useDebug.ts`

- The room is no longer exposed on the global `window`
- Simpler log level handling
- About 15 fewer lines

#### `hooks/useAgentErrors.tsx`

- Error messages translated into French
- Removed the link to the external documentation
- Simpler user interface

### 4. Pages and layouts

#### `app/(app)/page.tsx`

- Removed needless async/await
- Removed header handling
- Standard function component

#### `app/layout.tsx`

- Removed needless async/await
- Language changed from "en" to "fr"
- Loads only 2 font variants instead of 4

### 5. Deleted files

- `.eslintrc.json` (duplicate of `eslint.config.mjs`)
- `fonts/CommitMono-700-Regular.otf` (unused)
- `fonts/CommitMono-700-Italic.otf` (unused)

### 6. Cleaned-up dependencies

#### Removed from `package.json`

- `motion`: unused animation library (~200 KB)
- `buffer-image-size`: unused
- `mime`: unused
- `jose`: unused
- `tw-animate-css`: unused

#### Package name

- Renamed from `agent-starter-react` to `yorty-tcf-livekit-web`

### 7. Documentation

- README rewritten in French
- Documentation adapted to the TCF project

## Impact

- **Bundle size:** an estimated 300–400 KB less (motion, unused fonts, etc.).
- **Maintainability:** about 500 fewer lines of code and 6 fewer dependencies.
- **Performance:** less JavaScript to download and parse, no costly animations.

## Notes

- All core features (voice, chat, transcription) were kept.
- No functional regression was introduced.
