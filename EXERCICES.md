# 📝 Guide des Exercices & Configuration

Ce document explique comment gérer le contenu des examens (exercices, prompts, images) et la configuration des agents.

## 🤖 Configuration des Agents (Prompts)

Les instructions des examinateurs IA sont définies dans des fichiers YAML situés dans `apps/agent/config/agents/`.

### Structure d'un fichier YAML
- `name` / `description` : Métadonnées de la tâche.
- `settings` : Paramètres techniques (voix, interruptions).
- `baseInstructions` : Instructions communes (ex: "Tu es un examinateur officiel...").
- `instructions` : Instructions spécifiques à la tâche (ex: "Pose des questions sur le thème X...").
- `greeting` : La première phrase prononcée par l'agent.

### Tâches supportées
- `tache1.yml`, `tache2.yml`, `tache3.yml` (TCF)
- `tef-section-a.yml`, `tef-section-b.yml` (TEF)

---

## 📚 Base de Données des Exercices

### TCF (Tâche 2 et 3)
Les exercices TCF sont gérés via un fichier CSV : `apps/agent/config/tcf-exercises.csv`.
- Pour ajouter un exercice, ajoutez une ligne au CSV.
- **Important** : Après modification, vous devez régénérer la base SQLite utilisée par l'agent :
  ```bash
  cd apps/agent
  pnpm generate-db
  ```

### TEF (Section A et B)
Les exercices TEF utilisent des images et des fichiers markdown.
- **Images** : Situées dans `apps/web/public/tef-exercices/`.
- **Annonces (Markdown)** : Situées dans `apps/web/content/tef-annonces/`. Ces fichiers contiennent le texte qui s'affiche à côté de l'image de l'exercice.

---

## 🛠️ Outils de Génération

Le module `apps/agent` contient plusieurs scripts pour automatiser la gestion du contenu :

- `pnpm generate-db` : Synchronise le CSV TCF vers SQLite.
- `pnpm run download-files` : Télécharge les modèles nécessaires au fonctionnement de l'agent.

---

## 💡 Conseils pour les Prompts
- **Langue** : Les instructions (`instructions`) peuvent être en français ou en anglais, mais l'agent répondra dans la langue configurée.
- **Contraintes** : Soyez explicite sur les durées (ex: "L'entretien doit durer exactement 2 minutes").
- **Personnalité** : Vous pouvez ajuster le ton de l'examinateur (bienveillant, strict, etc.) directement dans le champ `instructions`.
