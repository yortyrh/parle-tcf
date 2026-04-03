# 🐳 Docker & Railway

Guide pour Docker Compose (local) et Railway (production).

## 📋 Prérequis

- Docker 20.10+, Docker Compose v2+
- Clé **OpenAI** (`OPENAI_API_KEY`)

## 🚀 Local — Docker Compose

### 1. Variables

```bash
cp .env.example .env
# Renseigner OPENAI_API_KEY
```

### 2. Démarrer

```bash
docker-compose up -d --build
```

- **API** : `http://localhost:3001` — santé : `GET /health`
- **Web** : `http://localhost` (map 80 → 3000)

Le fichier `docker-compose.yml` passe un **build arg** `NEXT_PUBLIC_EXAM_API_URL=http://localhost:3001` pour que le bundle Next.js appelle l’API depuis le navigateur sur la machine hôte.

### 3. Logs & cycle de vie

| Tâche | Commande |
| --- | --- |
| Logs suivis | `docker-compose logs -f` |
| Logs API | `docker-compose logs -f api` |
| Arrêt | `docker-compose stop` |
| Suppression | `docker-compose down` |
| Rebuild | `docker-compose up -d --build` |

---

## ☁️ Railway

Deux services, **root directory vide** :

- **Web** : `apps/web/railway.json` (Dockerfile Next standalone)
- **API** : `apps/api/railway.json` (Dockerfile Nest + `better-sqlite3`)

### Variables

**API**

- `OPENAI_API_KEY` (requis)
- `CORS_ORIGINS` — origines du front (ex. `https://votre-front.up.railway.app`)
- `PORT` — optionnel (Railway injecte souvent `PORT`)

**Web (build)**

- `NEXT_PUBLIC_EXAM_API_URL` — URL **publique** HTTPS de l’API (le client navigateur l’utilise)

---

## 🏗️ Images

- `apps/api/Dockerfile` — `turbo prune @yorty-tcf/api`, build Nest, `CMD node apps/api/dist/main.js`
- `apps/web/Dockerfile` — `turbo prune @yorty-tcf/web`, build Next standalone, `ARG NEXT_PUBLIC_EXAM_API_URL`

Architecture fonctionnelle : [AGENTS.md](./AGENTS.md).
