# 🎙️ TCF/TEF — Plateforme d’examen oral

Monorepo (Turborepo + pnpm) pour des simulations d’examens oraux TCF/TEF avec un examinateur IA : **OpenAI Realtime en WebRTC direct dans le navigateur** (`@openai/agents`), **API NestJS** pour les secrets et les données (exercices SQLite, YAML), **Socket.io** optionnel pour le multi-onglet.

## 🏗️ Structure du projet

| Paquet | Rôle |
| --- | --- |
| **`apps/web`** | Next.js 15 — UI candidat, session Realtime, micro, transcriptions, rapport. |
| **`apps/api`** | NestJS — `client_secrets` OpenAI, chargement config/exercices, gateway Socket.io. |
| **`packages/shared`** | Types, schémas Zod (session), événements socket — build `tsc` → `dist/`. |

## 🚀 Démarrage rapide (Docker Compose)

### Prérequis

- Docker & Docker Compose
- Clé **OpenAI** (`OPENAI_API_KEY`)

### Configuration

```bash
cp .env.example .env
# Éditez OPENAI_API_KEY
```

### Lancement

```bash
docker-compose up -d --build
```

- Front : **http://localhost** (port 80 → 3000 dans le conteneur).
- API : **http://localhost:3001** (health : `/health`).

Le build du front embarque `NEXT_PUBLIC_EXAM_API_URL` (voir `docker-compose.yml` → build args). Pour un accès depuis votre machine, la valeur par défaut est `http://localhost:3001`.

---

## ☁️ Railway

### Architecture cible

Il faut **deux** services Railway (même dépôt Git) : **API** (NestJS) et **Web** (Next.js). **Aucun troisième service « agent »** n’est nécessaire : après le découplage LiveKit, la voix et l’agent OpenAI Realtime tournent **dans le navigateur** via WebRTC ; l’API ne sert qu’aux secrets, aux données d’exercice et à Socket.io.

Pour chaque service, dans les paramètres Railway : **Root Directory** = vide (racine du monorepo), puis indiquer le fichier de config ci-dessous (ou équivalent « Dockerfile path » / config Railway) :

| Service | Rôle | Fichier de config |
| --- | --- | --- |
| **API** | `client_secrets`, SQLite, YAML, CORS, Socket.io | `apps/api/railway.json` |
| **Web** | UI, micro, session Realtime côté client | `apps/web/railway.json` |

### Ordre recommandé

1. Créer et déployer le service **API**, récupérer son URL publique HTTPS (ex. `https://xxx.up.railway.app`).
2. Créer le service **Web** avec `NEXT_PUBLIC_EXAM_API_URL` = cette URL API (voir ci-dessous).
3. Sur l’**API**, définir `CORS_ORIGINS` avec l’URL publique du **Web** (une ou plusieurs origines, séparées par des virgules). Sans cela, le navigateur bloque les appels `fetch` depuis le front.
4. Redéployer le **Web** si vous changez l’URL de l’API après le premier build (la variable est figée au **build** Next).

### Variables par service

**Service API** (`apps/api/.env.example`)

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | Oui | Appels `POST /v1/realtime/client_secrets` |
| `CORS_ORIGINS` | Fortement recommandé en prod | Origines du front, ex. `https://votre-web.up.railway.app` (virgule si plusieurs) |
| `PORT` | Non | Railway injecte souvent `PORT` ; en local, défaut 3001 |

**Service Web** — variables **au moment du build** Docker / Railway

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_EXAM_API_URL` | Oui | URL **HTTPS publique** de l’API, telle que le **navigateur** l’atteint (pas d’URL interne Railway-only si le client est sur Internet) |

Le Dockerfile web accepte `NEXT_PUBLIC_EXAM_API_URL` en `ARG` au build ; sur Railway, définissez-la dans les variables du service **Web** (Railway la passera au build).

---

## 🛠️ Développement local (sans Docker)

À la racine, après `pnpm install` :

| Commande | Rôle |
| --- | --- |
| `pnpm dev` | Lance les paquets qui exposent `dev` (web + api via Turborepo). |
| `pnpm build` | Build monorepo (`^build` pour `@yorty-tcf/shared` puis apps). |
| `pnpm lint` / `pnpm typecheck` / `pnpm test` | Qualité (voir scripts de chaque paquet). |
| `pnpm format` / `pnpm format:check` | Prettier. |

Dans deux terminaux typiques :

```bash
pnpm --filter @yorty-tcf/api run dev    # http://localhost:3001
pnpm --filter @yorty-tcf/web run dev    # http://localhost:3000
```

Copier `apps/api/.env.example` → `apps/api/.env` et `apps/web/.env.example` → `apps/web/.env.local` selon besoin.

Cibler un paquet :

```bash
pnpm --filter @yorty-tcf/api <script>
pnpm --filter @yorty-tcf/web <script>
pnpm --filter @yorty-tcf/shared <script>
```

---

## 📋 Scripts par paquet

### API — `@yorty-tcf/api` (`apps/api`)

| Script | Description |
| --- | --- |
| `dev` / `build` / `start` | NestJS |
| `generate-db` | CSV TCF → SQLite (`config/tcf-exercises.db`) |
| `rename-tef`, `generate-tef-instructions`, `sync-tef` | Pipeline contenu TEF (`config/tef-exercices/` → instructions `.md` + images dans `apps/web/public/`) |
| `lint`, `typecheck`, `format` | Qualité |

Exemple :

```bash
pnpm --filter @yorty-tcf/api run generate-db
pnpm --filter @yorty-tcf/api run sync-tef
```

### Web — `@yorty-tcf/web` (`apps/web`)

| Script | Description |
| --- | --- |
| `dev`, `build`, `start` | Next.js |
| `lint`, `typecheck`, `format` | Qualité |

### Shared — `@yorty-tcf/shared`

| Script | Description |
| --- | --- |
| `build` | `tsc` → `dist/` |
| `typecheck` | `tsc --noEmit` |

---

## 🔗 Documentation

- Architecture détaillée : [AGENTS.md](./AGENTS.md)
- Exercices & YAML : [EXERCICES.md](./EXERCICES.md)
- Docker : [DOCKER.md](./DOCKER.md)
- CI : [`.github/README.md`](./.github/README.md)
