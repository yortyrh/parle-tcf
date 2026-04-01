# Configuration GitHub (racine du monorepo)

Toute l’automatisation GitHub Actions vit ici. Elle remplace les anciens dossiers `apps/agent/.github` et `apps/web/.github`, supprimés pour ne garder qu’une seule source de vérité au niveau du dépôt.

## Workflow actif

### [`workflows/ci.yml`](./workflows/ci.yml) — **CI**

| Ancienne origine | Rôle repris |
| --- | --- |
| `apps/agent/.github/workflows/tests.yml` | Build monorepo, tests unitaires, lint, format, typecheck |
| `apps/web/.github/workflows/build-and-test.yaml` | ESLint, Prettier, build Next.js (via `turbo run build`) |

**Déclencheurs** : `push` et `pull_request` sur la branche `main`.

**Jobs** :

1. **Lint, format & types** — `pnpm lint`, `pnpm format:check`, `pnpm typecheck` (Turborepo sur `apps/agent`, `apps/web`, etc.).
2. **Build & tests** — `pnpm build` puis `pnpm test`. Les tests unitaires définis aujourd’hui sont surtout dans `apps/agent` ; `apps/web` n’expose pas encore de script `test`, Turborepo n’exécute que les packages qui en ont un.

**Outils** : Node.js **22**, **pnpm 10.33.0** (aligné sur `package.json` → champ `packageManager`), install avec `--frozen-lockfile`.

**Concurrence** : une seule exécution active par workflow et par ref Git (`cancel-in-progress`).

---

## Workflows volontairement absents

### Sync sandbox LiveKit (supprimé)

Un workflow manuel existait auparavant (`sync-to-production` côté web) pour pousser `main` vers une branche `sandbox-production` via [livekit-examples/sandbox-deploy-action](https://github.com/livekit-examples/sandbox-deploy-action). Il a été retiré : le déploiement cible de ce dépôt est **Railway** (voir [README.md](../README.md)). Si vous réactivez un sandbox LiveKit plus tard, vous pourrez recréer un fichier sous `.github/workflows/` sur ce modèle.

### `template-check.yml` (jamais migré depuis le template agent)

Ce job vérifiait que `pnpm-lock.yaml` et `livekit.toml` **n’étaient pas** versionnés — logique du **template** LiveKit pour un dépôt vierge.

Dans ce monorepo, **`pnpm-lock.yaml` est versionné** (recommandé pour des builds reproductibles). Réactiver ce job ferait échouer la CI.

### Assets `.github/assets` (captures, logos README)

Les images sous les anciens `apps/*/.github/assets` servaient surtout aux README des templates. Elles ne sont pas nécessaires au CI. Vous pouvez les réintroduire à la racine sous `.github/assets/` si vous voulez des visuels dans la documentation GitHub.

---

## Résumé

| Fichier | Quand ça tourne | But |
| --- | --- | --- |
| `ci.yml` | Chaque push/PR sur `main` | Qualité + build + tests (principalement l’agent) |

Pour l’hébergement applicatif (Railway, variables, scale-to-zero), voir [README.md](../README.md) et [AGENTS.md](../AGENTS.md) à la racine du dépôt.
