# TCF LiveKit - Test de Connaissance du Français

Application complète pour l'examen oral du TCF (Test de Connaissance du Français) utilisant LiveKit Agents.

## Structure du projet

Le projet est composé de deux parties principales :

### 1. `tcf-tache-1` - Agent LiveKit (Backend)

Agent Node.js qui gère les examens oraux du TCF avec trois types de tâches :
- **Tâche 1** : Expression Orale - Conversation sur des sujets quotidiens (2 minutes)
- **Tâche 2** : Interaction - Jeu de rôle et situations pratiques (3-4 minutes)
- **Tâche 3** : Expression d'Opinion - Analyse et argumentation (4-5 minutes)

**Technologies :**
- Node.js avec TypeScript
- LiveKit Agents SDK
- OpenAI Realtime API
- Configuration YAML pour les instructions des examinateurs

### 2. `tcf-tache-1-react` - Application Web (Frontend)

Interface React/Next.js pour les candidats qui passent l'examen.

**Technologies :**
- Next.js
- React
- LiveKit React Components
- TypeScript

## Configuration

### Variables d'environnement

#### Agent (`tcf-tache-1/.env.local`)
```env
OPENAI_API_KEY=your_openai_api_key
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

#### Application Web (`tcf-tache-1-react/.env.local`)
```env
NEXT_PUBLIC_LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

## Installation

### Agent
```bash
cd tcf-tache-1
pnpm install
```

### Application Web
```bash
cd tcf-tache-1-react
pnpm install
```

## Développement

### Agent
```bash
cd tcf-tache-1
pnpm dev
```

### Application Web
```bash
cd tcf-tache-1-react
pnpm dev
```

## Fonctionnalités

- ✅ Trois types de tâches TCF configurables
- ✅ Sélection aléatoire d'exercices depuis un fichier CSV pour les tâches 2 et 3
- ✅ Chronomètre automatique qui démarre quand l'étudiant commence à parler
- ✅ Microphone automatiquement muté jusqu'à ce que l'examinateur termine son introduction
- ✅ Messages de fin d'examen automatiques
- ✅ Configuration externalisée via fichiers YAML
- ✅ Support de l'audio en temps réel avec OpenAI Realtime API

## Structure des fichiers de configuration

Les instructions des examinateurs sont définies dans :
- `tcf-tache-1/config/agents/tache1.yml`
- `tcf-tache-1/config/agents/tache2.yml`
- `tcf-tache-1/config/agents/tache3.yml`

Les exercices pour les tâches 2 et 3 sont stockés dans :
- `tcf-tache-1/config/tcf-exercises.csv`

## Licence

[À définir]




