# TCF LiveKit - Test de Connaissance du Français

Application complète pour l'examen oral du TCF (Test de Connaissance du Français) utilisant LiveKit Agents.

## Structure du projet

Le projet est composé de deux parties principales :

### 1. `yorty-tcf-livekit-agent` - Agent LiveKit (Backend)

Agent Node.js qui gère les examens oraux du TCF avec trois types de tâches :
- **Tâche 1** : Expression Orale - Conversation sur des sujets quotidiens (2 minutes)
- **Tâche 2** : Interaction - Jeu de rôle et situations pratiques (3-4 minutes)
- **Tâche 3** : Expression d'Opinion - Analyse et argumentation (4-5 minutes)

**Technologies :**
- Node.js avec TypeScript
- LiveKit Agents SDK
- OpenAI Realtime API
- Configuration YAML pour les instructions des examinateurs

### 2. `yorty-tcf-livekit-web` - Application Web (Frontend)

Interface React/Next.js pour les candidats qui passent l'examen.

**Technologies :**
- Next.js
- React
- LiveKit React Components
- TypeScript

## Configuration

### Variables d'environnement

#### Agent (`yorty-tcf-livekit-agent/.env.local`)
```env
OPENAI_API_KEY=your_openai_api_key
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

#### Application Web (`yorty-tcf-livekit-web/.env.local`)
```env
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

## Installation

### Agent
```bash
cd yorty-tcf-livekit-agent
pnpm install
```

### Application Web
```bash
cd yorty-tcf-livekit-web
pnpm install
```

## Développement

### Option 1 : Docker Compose (Recommandé)

La façon la plus simple de démarrer le projet complet :

```bash
# Copier et configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos identifiants LiveKit et OpenAI

# Démarrer tous les services
docker-compose up -d

# Voir les logs
docker-compose logs -f

# Accéder à l'application
# Ouvrir http://localhost:3000
```

Pour plus de détails, consultez [DOCKER.md](./DOCKER.md).

### Option 2 : Développement local

#### Agent
```bash
cd yorty-tcf-livekit-agent
pnpm install
pnpm dev
```

#### Application Web
```bash
cd yorty-tcf-livekit-web
pnpm install
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
- `yorty-tcf-livekit-agent/config/agents/tache1.yml`
- `yorty-tcf-livekit-agent/config/agents/tache2.yml`
- `yorty-tcf-livekit-agent/config/agents/tache3.yml`

Les exercices pour les tâches 2 et 3 sont stockés dans :
- `yorty-tcf-livekit-agent/config/tcf-exercises.csv`

## Licence

[À définir]




