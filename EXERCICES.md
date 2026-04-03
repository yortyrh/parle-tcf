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

- Données structurées : `apps/api/config/tef-exercises.json`
- **Images** : `apps/web/public/tef-exercices/`
- **Annonces (markdown)** : `apps/web/content/tef-annonces/`

---

## 🛠️ Scripts de génération (dans `apps/api`)

Exécution depuis la racine du monorepo avec le filtre `@yorty-tcf/api` :

| Script | Rôle |
| --- | --- |
| `generate-db` | CSV TCF → SQLite |
| `extract-tef` | Images TEF → enrichissement `tef-exercises.json` (voir script, clé OpenAI) |
| `generate-tef-images` | Génération d’images dans `apps/web/public/tef-exercices/generated/` |
| `generate-tef-annonces` | Markdown dans `apps/web/content/tef-annonces/` |
| `clean-tef-dimension-images` | Nettoie les variantes dimensionnées |
| `reset-tef-images` | Réinitialise les images générées |

Exemple :

```bash
pnpm --filter @yorty-tcf/api run generate-tef-annonces -- --force
```

---

## 💡 Conseils pour les prompts

- **Langue** : les `instructions` peuvent être FR ou EN ; le comportement oral suit le modèle Realtime.
- **Contraintes** : durées, nombre de questions, etc., dans `instructions`.
- **Personnalité** : ajuster le ton dans `instructions` / `greeting`.
