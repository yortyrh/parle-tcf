# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **TCF (Test de Connaissance du Français) oral examination platform** built with LiveKit Agents. The project consists of two main components working together to deliver real-time voice-based French language testing:

- **yorty-tcf-livekit-agent**: LiveKit agent (Node.js/TypeScript) that acts as the examiner
- **yorty-tcf-livekit-web**: Next.js web application for candidates

The system supports three TCF oral task types:
- **Tâche 1**: Expression Orale (2 minutes) - Conversation on daily topics
- **Tâche 2**: Interaction (3-4 minutes) - Role-play scenarios
- **Tâche 3**: Expression d'Opinion (4-5 minutes) - Argumentation on topics

## Development Commands

### Agent (yorty-tcf-livekit-agent/)

```bash
# Install dependencies
pnpm install

# Download required models (Silero VAD, LiveKit turn detector) - REQUIRED before first run
pnpm run download-files

# Development mode
pnpm dev

# Build
pnpm build

# Production
pnpm start

# Testing
pnpm test
pnpm test:watch

# Code quality
pnpm lint
pnpm lint:fix
pnpm format
pnpm format:check
pnpm typecheck
```

### Web (yorty-tcf-livekit-web/)

```bash
# Install dependencies
pnpm install

# Development (uses Turbopack)
pnpm dev

# Build
pnpm build

# Production
pnpm start

# Code quality
pnpm lint
pnpm format
pnpm format:check
```

### Docker Compose

```bash
# Copy and edit environment variables first
cp .env.example .env

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose up -d --build

# Stop and cleanup
docker-compose down -v
```

The web app will be available at http://localhost:3000

## Architecture

### Agent Architecture (yorty-tcf-livekit-agent/)

**Entry Point**: `src/agent.ts` - Defines the main LiveKit agent with `defineAgent()` and starts the CLI server.

**Agent Flow**:
1. Agent connects to LiveKit room
2. Waits for participant to join and reads their metadata to determine `taskType` (tache1/tache2/tache3)
3. Instantiates the appropriate agent class (TCFTache1/TCFTache2/TCFTache3)
4. Starts the voice session with OpenAI Realtime API
5. Initializes exam timer and voice pipeline

**Key Classes**:
- `TCFAgent` (`src/agents/TCFAgent.ts`): Base class for all task agents. Loads YAML configuration, manages exam/preparation timers, handles greeting, and provides the `envoiRapport` tool for sending markdown reports to the web client.
- `TCFTache1/2/3` (`src/agents/TCFTache*.ts`): Task-specific agents that extend TCFAgent. Load random exercises from CSV for tache2/3.
- `TimerController` (`src/agents/TimerController.ts`): Manages preparation and exam timers, sends timer updates to web client via data messages.

**Configuration System**:
- Agent behavior is externalized in YAML files: `config/agents/tache1.yml`, `tache2.yml`, `tache3.yml`
- Each YAML defines: instructions, greeting, durations, LLM settings
- Exercises for tache2/3 are loaded from `config/tcf-exercises.csv`
- Service-level config in `config/service.yml` (LLM voice, noise cancellation, etc.)
- Configuration is loaded by `src/config/index.ts` using Zod schemas for validation

**Communication with Web**:
- Agent sends data messages to web client using `this.sendDataMessage({ type: '...', ... })`
- Message types: `timerUpdate`, `timerStart`, `report`, `exerciseData`

### Web Architecture (yorty-tcf-livekit-web/)

**Framework**: Next.js 15 with App Router, React 19, TypeScript

**Key Pages/Routes**:
- `app/(app)/page.tsx`: Main application entry point
- `app/api/connection-details/route.ts`: API endpoint that generates LiveKit tokens with participant metadata (taskType)

**Key Components** (`components/app/`):
- `app.tsx`: Root component that manages LiveKit room connection
- `view-controller.tsx`: State machine for app views (welcome → pre-connect → session → report)
- `session-view.tsx`: Main exam session UI with voice assistant, transcript, and timer
- `timer-display.tsx`: Visual countdown timer
- `chat-transcript.tsx`: Real-time transcript of conversation
- `report-viewer.tsx`: Displays markdown report at end of session
- `welcome-view.tsx`: Task selection and exam start screen

**State Flow**:
1. User selects task type (tache1/2/3) on welcome screen
2. Frontend calls `/api/connection-details` with taskType to get LiveKit token
3. Connects to LiveKit room with metadata containing taskType
4. Agent reads metadata and instantiates appropriate agent
5. Session begins, timer starts when user speaks
6. At end, agent sends markdown report which is displayed in report viewer

**LiveKit Integration**:
- Uses `@livekit/components-react` for voice UI components
- Room connection managed in `app.tsx`
- Data messages from agent are received via `useDataChannel()` hook

## Important Notes

### Agent Development

- **Always use pnpm** for package management in both agent and web
- The agent uses LiveKit Agents Node.js SDK (not Python SDK). Check documentation for feature availability.
- Agent entrypoint (`src/agent.ts`) must be maintained as the entry file (referenced in Dockerfile)
- When modifying agent instructions, edit the YAML files in `config/agents/`, not the TypeScript code
- The project uses structured YAML configs and CSV data for flexibility. Don't hardcode exam content in code.
- For complex agent workflows, use LiveKit's handoffs feature to minimize context and latency
- Background voice cancellation is enabled via `@livekit/noise-cancellation-node`

### Web Development

- Uses Next.js App Router with server/client component split
- LiveKit components require `'use client'` directive
- Task type selection happens client-side and is passed to agent via participant metadata

### Environment Variables

Both agent and web require LiveKit credentials:
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

Agent also requires:
- `OPENAI_API_KEY`

Use `.env.local` for local development. In production, use Docker Compose with `.env` file.

### LiveKit Docs MCP Server

For up-to-date LiveKit documentation, install the LiveKit Docs MCP server:

```bash
claude mcp add --transport http livekit-docs https://docs.livekit.io/mcp
```

This provides access to latest LiveKit Agents documentation within Claude Code.

### Deployment

The project is production-ready with:
- Dockerfiles for both agent and web
- `docker-compose.yml` for local/development
- `docker-compose.prod.yml` for production deployment
- See `DOCKER.md` for detailed deployment instructions

### Node.js Version

The project uses Node.js v24.14.0 (specified in `.nvmrc`). Use `nvm install` to switch to the correct version.

### CSV Exercise Format

Exercises in `config/tcf-exercises.csv` are loaded by task agents. CSV has columns for task type and exercise content. Random exercises are selected for tache2 and tache3.

### Timer Behavior

- Timer starts when candidate begins speaking (not when exam starts)
- Microphone is auto-muted until examiner finishes introduction
- Preparation timer (if > 0) runs before exam timer
- All timer logic is in `TimerController.ts`
