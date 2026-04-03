# Configuration GitHub (racine du monorepo)

L’automatisation GitHub Actions est centralisée ici (plus de workflows dans `apps/*/.github`).

## Workflow actif

### [`workflows/ci.yml`](./workflows/ci.yml) — **CI**

**Déclencheurs** : `push` et `pull_request` sur la branche `main`.

**Jobs** :

1. **Lint, format & types** — `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (Turborepo sur `@yorty-tcf/web`, `@yorty-tcf/api`, etc.).
2. **Build & tests** — `pnpm build` puis `pnpm test` (les paquets sans script `test` sont ignorés par Turborepo ; `@yorty-tcf/api` expose un script placeholder pour l’instant).

**Outils** : Node.js **22**, **pnpm 10.33.0** (voir `package.json` → `packageManager`), install avec `--frozen-lockfile`.

**Concurrence** : une seule exécution active par workflow et par ref Git (`cancel-in-progress`).

---

## Workflows volontairement absents

### Sync sandbox LiveKit (historique)

Un workflow manuel pouvait pousser vers une branche sandbox via l’écosystème LiveKit. Il n’est plus pertinent : déploiement cible **Railway** ([README.md](../README.md)).

### `template-check.yml` (template agent LiveKit)

Vérifiait que le lockfile n’était pas versionné — inadapté à ce monorepo où **`pnpm-lock.yaml` est versionné**.

### Assets `.github/assets`

Optionnel pour des visuels dans la documentation GitHub.

---

## Résumé

| Fichier | Quand ça tourne | But |
| --- | --- | --- |
| `ci.yml` | Push / PR sur `main` | Qualité + build + tests |

Hébergement Railway (services **API** + **Web** uniquement, pas de service agent) : [README.md](../README.md), [AGENTS.md](../AGENTS.md), [DOCKER.md](../DOCKER.md).
