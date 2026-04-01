# 🎙️ TCF/TEF LiveKit - Plateforme d'Examen Oral

Cette plateforme monorepo (Turborepo + pnpm) permet de passer des simulations d'examens oraux pour le TCF et le TEF avec un examinateur IA ultra-réaliste utilisant **LiveKit Agents** et **OpenAI Realtime**.

## 🏗️ Structure du Projet

L'application est divisée en trois modules principaux :

- **🤖 Agent (`apps/agent`)** : L'intelligence de l'examinateur (Node.js). Gère les scénarios TCF/TEF, les outils LLM et les rapports pédagogiques.
- **🌐 Web (`apps/web`)** : L'interface candidat (Next.js 15). Gère l'audio temps réel, les transcriptions et l'affichage des exercices.
- **📦 Shared (`packages/shared`)** : Les types et protocoles de communication partagés entre l'agent et le web.

## 🚀 Démarrage Rapide (Local)

Le moyen le plus simple de faire tourner l'application localement est d'utiliser **Docker Compose**.

### 1. Prérequis
- Docker & Docker Compose
- Identifiants LiveKit Cloud (URL, API Key, Secret)
- Clé API OpenAI

### 2. Configuration
Copiez le fichier `.env.example` à la racine et remplissez-le :
```bash
cp .env.example .env
```

### 3. Lancement
```bash
docker-compose up -d
```
L'interface web sera accessible sur `http://localhost:3000`.

---

## ☁️ Déploiement sur Railway

Le projet est pré-configuré pour un déploiement "Scale-to-Zero" sur Railway.

### Configuration du Tableau de Bord (Crucial)
Créez deux services dans Railway à partir du même dépôt GitHub :

| Service | Config File Path |
| --- | --- |
| **Web Service** | `apps/web/railway.json` |
| **Agent Service** | `apps/agent/railway.json` |

**IMPORTANT** : Laissez le **Root Directory** vide (racine) pour les deux services. Ne le réglez PAS sur `apps/web` ou `apps/agent`.

### Variables d'Environnement
Configurez les variables suivantes dans le tableau de bord Railway :

| Variable | Requis pour | Description |
| --- | --- | --- |
| `LIVEKIT_URL` | Web & Agent | Votre URL LiveKit Cloud |
| `LIVEKIT_API_KEY` | Web & Agent | |
| `LIVEKIT_API_SECRET` | Web & Agent | |
| `OPENAI_API_KEY` | Agent | |
| `AGENT_WAKE_URL` | Web | URL interne de l'agent (ex: `http://agent.railway.internal:8080`) |

---

## 🛠️ Développement local (sans Docker)

À la racine du dépôt, après `pnpm install` :

| Commande racine | Rôle |
| --- | --- |
| `pnpm dev` | Lance **tous** les paquets qui exposent `dev` (agent + web via Turborepo). |
| `pnpm build` | Build de tout le monorepo (`turbo run build`). |
| `pnpm lint` | Lint sur tous les paquets concernés. |
| `pnpm typecheck` | Vérification TypeScript partout. |
| `pnpm test` | Tests unitaires là où un script `test` existe (principalement l’agent). |
| `pnpm format` | Formate le code (Prettier) partout. |
| `pnpm format:check` | Vérifie le formatage sans modifier les fichiers. |

Pour cibler **un seul paquet**, utilisez [`pnpm --filter`](https://pnpm.io/filtering) avec le **nom** du paquet (`package.json` → `name`) :

```bash
pnpm --filter @yorty-tcf/agent <script>
pnpm --filter @yorty-tcf/web   <script>
```

Équivalent pratique avec le chemin du dossier :

```bash
pnpm --filter ./apps/agent <script>
pnpm --filter ./apps/web   <script>
```

---

## 📋 Référence des commandes par paquet

### Racine (`yorty-tcf-livekit`)

Ces scripts délèguent à **Turborepo** ; ils s’appliquent à l’ensemble du workspace (selon ce que chaque paquet définit).

| Script | Commande |
| --- | --- |
| Développement parallèle | `pnpm dev` |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Tests | `pnpm test` (équivalent recommandé avec flag explicite : `pnpm test -- --run`) |
| Prettier (écriture) | `pnpm format` |
| Prettier (vérification) | `pnpm format:check` |

---

### Agent — `@yorty-tcf/agent` (`apps/agent`)

Premier usage local typique : générer la base SQLite à partir du CSV, puis télécharger les fichiers modèles LiveKit (VAD, etc.).

| Script | Commande (depuis la racine) | Description |
| --- | --- | --- |
| `generate-db` | `pnpm --filter @yorty-tcf/agent run generate-db` | Recrée `tcf-exercises.db` à partir de `config/tcf-exercises.csv`. |
| `download-files` | `pnpm --filter @yorty-tcf/agent run download-files` | Lance un `build` puis télécharge les modèles/fichiers requis par LiveKit Agents (à faire une première fois, ou après changement de dépendances). |
| `dev` | `pnpm --filter @yorty-tcf/agent run dev` | Agent en mode développement (`tsx src/agent.ts dev`). |
| `build` | `pnpm --filter @yorty-tcf/agent run build` | CSV → SQLite + compilation TypeScript vers `dist/`. |
| `start` | `pnpm --filter @yorty-tcf/agent run start` | Production : `node dist/agent.js start`. |
| `clean` | `pnpm --filter @yorty-tcf/agent run clean` | Supprime le dossier `dist/`. |
| `typecheck` | `pnpm --filter @yorty-tcf/agent run typecheck` | `tsc --noEmit`. |
| `lint` | `pnpm --filter @yorty-tcf/agent run lint` | ESLint. |
| `lint:fix` | `pnpm --filter @yorty-tcf/agent run lint:fix` | ESLint avec correctifs automatiques. |
| `format` | `pnpm --filter @yorty-tcf/agent run format` | Prettier (écriture). |
| `format:check` | `pnpm --filter @yorty-tcf/agent run format:check` | Prettier (vérification). |
| `test` | `pnpm --filter @yorty-tcf/agent run test -- --run` | Tests unitaires (runner Node). **Préférez `-- --run`** pour une exécution non interactive. |
| `test:watch` | `pnpm --filter @yorty-tcf/agent run test:watch` | Tests en mode watch. |
| `extract-tef` | `pnpm --filter @yorty-tcf/agent run extract-tef` | Script TEF (extraction). |
| `generate-tef-images` | `pnpm --filter @yorty-tcf/agent run generate-tef-images` | Génération d’images TEF. |
| `generate-tef-annonces` | `pnpm --filter @yorty-tcf/agent run generate-tef-annonces` | Génère le markdown des annonces TEF dans `apps/web/content/tef-annonces/`. Régénération complète : ajoutez `-- --force` (voir ci-dessous). |
| `clean-tef-dimension-images` | `pnpm --filter @yorty-tcf/agent run clean-tef-dimension-images` | Nettoyage dimensions images TEF. |
| `reset-tef-images` | `pnpm --filter @yorty-tcf/agent run reset-tef-images` | Réinitialisation images TEF. |

Pour passer des arguments à un script npm du paquet agent, placez-les après `--` :

```bash
pnpm --filter @yorty-tcf/agent run generate-tef-annonces -- --force
```

---

### Web — `@yorty-tcf/web` (`apps/web`)

| Script | Commande (depuis la racine) | Description |
| --- | --- | --- |
| `dev` | `pnpm --filter @yorty-tcf/web run dev` | Next.js avec Turbopack (`localhost:3000` par défaut). |
| `build` | `pnpm --filter @yorty-tcf/web run build` | Build de production Next.js. |
| `start` | `pnpm --filter @yorty-tcf/web run start` | Sert le build Next.js. |
| `lint` | `pnpm --filter @yorty-tcf/web run lint` | `next lint`. |
| `typecheck` | `pnpm --filter @yorty-tcf/web run typecheck` | `tsc --noEmit`. |
| `format` | `pnpm --filter @yorty-tcf/web run format` | Prettier sur le dossier web. |
| `format:check` | `pnpm --filter @yorty-tcf/web run format:check` | Vérification Prettier. |

Le paquet web **n’expose pas** de script `test` pour l’instant ; les tests côté UI/API pourront être ajoutés plus tard dans ce même tableau.

---

### Shared — `@yorty-tcf/shared` (`packages/shared`)

Paquet de **types et exports TypeScript** uniquement : pas de scripts npm (`build`, `test`, etc.). Il est consommé en source par les autres paquets via `workspace:*`.

---

## 🔗 Documentation complémentaire

- Architecture, flux LiveKit et données : [AGENTS.md](./AGENTS.md).
- Exercices, YAML et contenu TEF : [EXERCICES.md](./EXERCICES.md).
- Docker local : [DOCKER.md](./DOCKER.md).
- CI GitHub Actions : [`.github/README.md`](./.github/README.md).
