# 📝 Guide des exercices & configuration

Gestion du contenu des examens (prompts YAML, exercices TCF/TEF, images).

## 🤖 Configuration des examinateurs (prompts)

Fichiers YAML dans **`apps/api/config/agents/`** (chargés par l’API pour construire la session Realtime).

### Structure d’un fichier YAML

- `name` / `description` : métadonnées de la tâche.
- `settings` : paramètres (voix, interruptions).
- `baseInstructions` : instructions communes.
- `instructions` : consignes spécifiques à la tâche.
- `greeting` : accueil oral initial.

### Tâches supportées

- `tache1.yml`, `tache2.yml`, `tache3.yml` (TCF)
- `tef-section-a.yml`, `tef-section-b.yml` (TEF)

La voix / le modèle côté Realtime sont aussi dérivés de `apps/api/config/service.yml` selon l’implémentation actuelle de `ExamSessionService`.

---

## 📚 Base de données des exercices

### TCF (tâches 2 et 3)

- CSV : **`apps/api/config/tcf-exercises.csv`**
- SQLite utilisée à l’exécution : **`apps/api/config/tcf-exercises.db`**

Après modification du CSV :

```bash
pnpm --filter @yorty-tcf/api run generate-db
```

### TEF (sections A et B)

- **Source** : `apps/api/config/tef-exercices/TEF-A/` et `TEF-B/` — pour chaque exercice, une paire `TEF-A-01.png` + `TEF-A-01.md` (instructions spécifiques Realtime, éditables).
- **Images servies au navigateur** : copie dans `apps/web/public/tef-exercices/` via `sync-tef`.

---

## 🛠️ Scripts de génération (dans `apps/api`)

Exécution depuis la racine du monorepo avec le filtre `@yorty-tcf/api` :

| Script | Rôle |
| --- | --- |
| `generate-db` | CSV TCF → SQLite |
| `rename-tef` | Renomme les scans PNG en `TEF-{A\|B}-NN.png` (dry-run ; `--apply` pour exécuter) |
| `generate-tef-instructions` | Vision (GPT-4o) → un `.md` par image ; `--stub` pour des brouillons sans clé API |
| `sync-tef` | Copie les PNG vers `apps/web/public/tef-exercices/` |

Exemple :

```bash
pnpm --filter @yorty-tcf/api run generate-tef-instructions -- --force
pnpm --filter @yorty-tcf/api run sync-tef
```

---

## 💡 Conseils pour les prompts

- **Langue** : les `instructions` peuvent être FR ou EN ; le comportement oral suit le modèle Realtime.
- **Contraintes** : durées, nombre de questions, etc., dans `instructions`.
- **Personnalité** : ajuster le ton dans `instructions` / `greeting`.
