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

Créez **deux** services à partir du même dépôt, **root directory vide** :

| Service | Config File Path |
| --- | --- |
| Web | `apps/web/railway.json` |
| API | `apps/api/railway.json` |

Variables importantes :

| Variable | Où | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | API | Appel `client_secrets` |
| `CORS_ORIGINS` | API | Origines du front (séparées par des virgules) |
| `NEXT_PUBLIC_EXAM_API_URL` | Web (**build**) | URL publique de l’API vue par le navigateur |
| `PORT` | API | Optionnel (défaut 3001 en local) |

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
| `extract-tef`, `generate-tef-images`, `generate-tef-annonces`, `clean-tef-dimension-images`, `reset-tef-images` | Pipeline contenu TEF (voir commentaires dans `apps/api/scripts/`) |
| `lint`, `typecheck`, `format` | Qualité |

Exemple :

```bash
pnpm --filter @yorty-tcf/api run generate-db
pnpm --filter @yorty-tcf/api run generate-tef-annonces -- --force
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
