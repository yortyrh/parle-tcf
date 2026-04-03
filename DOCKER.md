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

**Deux services** depuis la racine du dépôt (**root directory vide**). Pas de service **agent** séparé : l’agent Realtime est exécuté côté **navigateur** ; l’**API** remplace l’ancien worker / backend qui tenait les secrets et les données.

| Service | `railway.json` | Image |
| --- | --- | --- |
| **API** | `apps/api/railway.json` | Nest + `better-sqlite3` |
| **Web** | `apps/web/railway.json` | Next.js standalone |

### Enchaînement typique

1. Déployer l’**API**, noter l’URL publique.
2. Configurer le **Web** avec `NEXT_PUBLIC_EXAM_API_URL` pointant vers cette URL (build).
3. Mettre à jour l’**API** : `CORS_ORIGINS` = URL du **Web**, puis redéployer l’API si besoin.

### Variables

**API**

- `OPENAI_API_KEY` — requis
- `CORS_ORIGINS` — origines autorisées pour le front (ex. `https://votre-web.up.railway.app`)
- `PORT` — optionnel (Railway fournit souvent `PORT`)

**Web** (injectée au **build**)

- `NEXT_PUBLIC_EXAM_API_URL` — URL HTTPS **vue par le navigateur** pour joindre l’API

---

## 🏗️ Images

- `apps/api/Dockerfile` — `turbo prune @yorty-tcf/api`, build Nest, `CMD node apps/api/dist/main.js`
- `apps/web/Dockerfile` — `turbo prune @yorty-tcf/web`, build Next standalone, `ARG NEXT_PUBLIC_EXAM_API_URL`

Architecture fonctionnelle : [AGENTS.md](./AGENTS.md).
