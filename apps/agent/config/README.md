# Configuration des Agents TCF

Ce dossier contient les fichiers de configuration YAML pour les agents TCF (Test de Connaissance du Français).

## Structure

```
config/
└── agents/
    ├── tache1.yml    # TCF Tâche 1 - Expression Orale
    ├── tache2.yml    # TCF Tâche 2 - Interaction
    └── tache3.yml    # TCF Tâche 3 - Expression d'Opinion
```

## Format des fichiers de configuration

Chaque fichier YAML contient :

### 1. Informations générales

```yaml
name: 'Nom de la tâche'
description: 'Description courte'
```

### 2. Paramètres

```yaml
settings:
  allowInterruptions: true
  voice: 'alloy'
```

### 3. Instructions de base

```yaml
baseInstructions: |
  Instructions communes à tous les modes...
```

### 4. Configuration du mode examen

```yaml
examMode:
  instructions: |
    Instructions spécifiques au mode examen...

  greeting: |
    Message d'accueil pour le mode examen...
```

### 5. Configuration du mode préparation

```yaml
preparationMode:
  instructions: |
    Instructions spécifiques au mode préparation (professeur)...

  greeting: |
    Message d'accueil pour le mode préparation...

  feedbackTechniques:
    - 'Technique 1'
    - 'Technique 2'
```

### 6. Données spécifiques à chaque tâche

**Pour Tâche 1 (Expression Orale)** :

```yaml
sampleQuestions:
  theme1:
    - 'Question 1'
    - 'Question 2'
  theme2:
    - 'Question 3'
```

**Pour Tâche 2 (Interaction)** :

```yaml
scenarios:
  scenario_name:
    title: 'Titre du scénario'
    role: "Rôle de l'agent"
    situation: 'Description de la situation'
    phrases_utiles:
      - 'Phrase utile 1'
      - 'Phrase utile 2'

usefulPhrases:
  categorie1:
    - 'Expression 1'
    - 'Expression 2'
```

**Pour Tâche 3 (Expression d'Opinion)** :

```yaml
topics:
  categorie1:
    - 'Sujet 1'
    - 'Sujet 2'

argumentStructure:
  introduction:
    - 'Étape 1'
    - 'Étape 2'

argumentationVocabulary:
  type1:
    - 'Expression 1'
    - 'Expression 2'
```

## Utilisation dans le code

Les configurations sont chargées automatiquement par la classe `TCFAgent` :

```typescript
import { TCFTache1 } from '@/agents';

// Crée un agent Tâche 1 en mode préparation
const agent = new TCFTache1('preparation');

// Crée un agent Tâche 1 en mode examen
const agentExam = new TCFTache1('exam');
```

## Modification des configurations

1. Éditez le fichier YAML correspondant à la tâche
2. Sauvegardez le fichier
3. Redémarrez l'agent pour que les changements prennent effet

**Note** : Les configurations sont mises en cache au premier chargement. Pour recharger une configuration en cours d'exécution (utile pour le développement) :

```typescript
import { reloadAgentConfig } from '@/config';

// Recharge la configuration de tache1
const config = reloadAgentConfig('tache1');
```

## Validation

Les fichiers YAML sont validés automatiquement au chargement. Les champs requis sont :

- `name`
- `description`
- `settings`
- `baseInstructions`
- `examMode` (avec `instructions` et `greeting`)
- `preparationMode` (avec `instructions` et `greeting`)

Si un champ requis manque, une erreur sera levée au démarrage de l'agent.

## Bonnes pratiques

1. **Instructions claires** : Écrivez des instructions précises et détaillées
2. **Séparation des modes** : Distinguez clairement les comportements exam/préparation
3. **Exemples concrets** : Incluez des exemples de questions, phrases, et situations
4. **Vocabulaire riche** : Pour la préparation, fournissez un vocabulaire varié
5. **Format YAML** : Respectez l'indentation (2 espaces) et utilisez `|` pour les textes multi-lignes

## Dépannage

### Erreur "Failed to load configuration"

- Vérifiez que le fichier YAML existe dans `config/agents/`
- Vérifiez la syntaxe YAML (indentation, guillemets)

### Erreur "Missing required field"

- Assurez-vous que tous les champs requis sont présents
- Consultez les exemples de fichiers existants

### L'agent ne parle pas correctement

- Vérifiez les instructions dans `baseInstructions` et `examMode/preparationMode`
- Assurez-vous que les instructions sont en anglais (pour le LLM) et mentionnent de parler en français
