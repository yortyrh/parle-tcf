<a href="https://livekit.io/">
  <img src="./.github/assets/livekit-mark.png" alt="LiveKit logo" width="100" height="100">
</a>

# TCF LiveKit Agent

Agent LiveKit pour les examens oraux du TCF (Test de Connaissance du Français) utilisant [LiveKit Agents for Node.js](https://github.com/livekit/agents-js) et [LiveKit Cloud](https://cloud.livekit.io/).

## Fonctionnalités

- **Trois types de tâches TCF configurables** :
  - Tâche 1 : Expression Orale - Conversation sur des sujets quotidiens (2 minutes)
  - Tâche 2 : Interaction - Jeu de rôle et situations pratiques (3-4 minutes)
  - Tâche 3 : Expression d'Opinion - Analyse et argumentation (4-5 minutes)
- Sélection aléatoire d'exercices depuis un fichier CSV
- Chronomètre automatique qui démarre quand l'étudiant commence à parler
- Microphone automatiquement muté jusqu'à ce que l'examinateur termine son introduction
- Messages de fin d'examen automatiques
- Configuration externalisée via fichiers YAML
- Support de l'audio en temps réel avec OpenAI Realtime API
- [Background voice cancellation](https://docs.livekit.io/home/cloud/noise-cancellation/)
- Integrated [metrics and logging](https://docs.livekit.io/agents/build/metrics/)
- A Dockerfile ready for [production deployment](https://docs.livekit.io/agents/ops/deployment/)

## Coding agents and MCP

This project is designed to work with coding agents like [Cursor](https://www.cursor.com/) and [Claude Code](https://www.anthropic.com/claude-code).

To get the most out of these tools, install the [LiveKit Docs MCP server](https://docs.livekit.io/mcp).

For Cursor, use this link:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-light.svg)](https://cursor.com/en-US/install-mcp?name=livekit-docs&config=eyJ1cmwiOiJodHRwczovL2RvY3MubGl2ZWtpdC5pby9tY3AifQ%3D%3D)

For Claude Code, run this command:

```
claude mcp add --transport http livekit-docs https://docs.livekit.io/mcp
```

For Codex CLI, use this command to install the server:

```
codex mcp add --url https://docs.livekit.io/mcp livekit-docs
```

For Gemini CLI, use this command to install the server:

```
gemini mcp add --transport http livekit-docs https://docs.livekit.io/mcp
```

The project includes a complete [AGENTS.md](AGENTS.md) file for these assistants. You can modify this file to suit your needs. To learn more about this file, see [https://agents.md](https://agents.md).

## Dev Setup

This project uses [pnpm](https://pnpm.io/) as the package manager.

Clone the repository and install dependencies:

```console
cd yorty-tcf-livekit-agent
pnpm install
```

Sign up for [LiveKit Cloud](https://cloud.livekit.io/) then set up the environment by copying `.env.example` to `.env.local` and filling in the required keys:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

You can load the LiveKit environment automatically using the [LiveKit CLI](https://docs.livekit.io/home/cli/cli-setup):

```bash
lk cloud auth
lk app env -w -d .env.local
```

## Run the agent

Before your first run, you must download certain models such as [Silero VAD](https://docs.livekit.io/agents/build/turns/vad/) and the [LiveKit turn detector](https://docs.livekit.io/agents/build/turns/turn-detector/):

```console
pnpm run download-files
```

To run the agent during development, use the `dev` command:

```console
pnpm run dev
```

In production, use the `start` command:

```console
pnpm run start
```

## Frontend

Ce projet est conçu pour fonctionner avec l'application web `yorty-tcf-livekit-web` qui se trouve dans le dossier parent.

Pour démarrer l'ensemble du projet avec Docker Compose, consultez le [README.md](../README.md) du projet principal.

## Configuration

Les instructions des examinateurs sont définies dans les fichiers YAML :
- `config/agents/tache1.yml` - Configuration pour la tâche 1 (Expression Orale)
- `config/agents/tache2.yml` - Configuration pour la tâche 2 (Interaction)
- `config/agents/tache3.yml` - Configuration pour la tâche 3 (Expression d'Opinion)

Les exercices pour les tâches 2 et 3 sont stockés dans :
- `config/tcf-exercises.csv`

Pour plus de détails sur la configuration, consultez [docs/YAML_CONFIG.md](docs/YAML_CONFIG.md).

## Deploying to production

This project is production-ready and includes a working `Dockerfile`. To deploy it to LiveKit Cloud or another environment, see the [deploying to production](https://docs.livekit.io/agents/ops/deployment/) guide.

## Self-hosted LiveKit

You can also self-host LiveKit instead of using LiveKit Cloud. See the [self-hosting](https://docs.livekit.io/home/self-hosting/) guide for more information. If you choose to self-host, you'll need to also use [model plugins](https://docs.livekit.io/agents/models/#plugins) instead of LiveKit Inference and will need to remove the [LiveKit Cloud noise cancellation](https://docs.livekit.io/home/cloud/noise-cancellation/) plugin.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
