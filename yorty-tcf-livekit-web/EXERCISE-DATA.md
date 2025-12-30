# Système de Transmission des Données d'Exercice

Documentation du système de transmission dynamique des informations d'exercice depuis l'agent vers l'interface web.

## 📋 Vue d'ensemble

Au lieu de passer les informations de tâche statiquement en props, le système utilise le data channel LiveKit pour transmettre dynamiquement les données de l'exercice depuis l'agent backend vers le client web.

## 🎯 Avantages

- ✅ **Dynamique** : Les informations sont envoyées en temps réel par l'agent
- ✅ **Cohérent** : Utilise la même infrastructure que les messages de timer
- ✅ **Flexible** : Permet de personnaliser le titre et la description selon l'exercice
- ✅ **Fiable** : Messages envoyés avec `reliable: true`

## 📡 Format des Messages

### Message d'Exercice

```json
{
  "type": "exercise_data",
  "data": {
    "title": "Tâche 2 - Exercice en interaction",
    "description": "Je suis un(e) ami(e) canadien(ne)...",
    "content": "Je suis un(e) ami(e) canadien(ne)..."
  }
}
```

**Champs :**

- `type` : `"exercise_data"` (identifiant du type de message)
- `data.title` : Titre de la tâche affiché en haut
- `data.description` : Description de l'exercice affichée sous le titre
- `data.content` : Contenu complet de l'exercice (optionnel, pour usage interne)

## 🔄 Flux de Communication

```
Agent Backend (TCFAgent)
    ↓ onEnter()
sendExerciseData()
    ↓ sendDataMessage()
LiveKit Data Channel (reliable)
    ↓ dataReceived event
Web Client (useExerciseData hook)
    ↓ Parse & setState
SessionView Component
    ↓ Display
UI (Titre et Description)
```

## 💻 Utilisation Côté Agent (Backend)

### Envoi Automatique

L'envoi des données d'exercice est **automatique** dans la méthode `onEnter()` de `TCFAgent` :

```typescript
override async onEnter(): Promise<void> {
  // Envoyer les données de l'exercice au client web
  if (this.context) {
    await this.sendExerciseData();
  }

  // Ensuite envoyer le greeting...
  // ...
}
```

### Méthode `sendExerciseData()`

Cette méthode privée construit et envoie les données d'exercice :

```typescript
private async sendExerciseData(): Promise<void> {
  if (!this.context) return;

  let title: string;
  let description: string;

  if (this.taskType === 'tache1') {
    title = 'Tâche 1 - Entretien dirigé';
    description = 'Présentation de soi, puis un entretien dirigé...';
  } else if (this.taskType === 'tache2') {
    title = 'Tâche 2 - Exercice en interaction';
    description = this.exercise?.content || 'Jeux de rôles...';
  } else if (this.taskType === 'tache3') {
    title = 'Tâche 3 - Expression d\'un point de vue';
    description = this.exercise?.content || 'Présentation d\'un sujet...';
  }

  await this.sendDataMessage(this.context, {
    type: 'exercise_data',
    data: { title, description, content: this.exercise?.content || '' }
  });
}
```

### Logique par Tâche

#### Tâche 1 (Pas d'exercice spécifique)

```typescript
title = 'Tâche 1 - Entretien dirigé';
description =
  'Présentation de soi, puis un entretien dirigé, exercice de conversation sur des sujets quotidiens';
```

#### Tâche 2 (Exercice chargé depuis CSV)

```typescript
title = 'Tâche 2 - Exercice en interaction';
description = exercise.content; // Ex: "Je suis un(e) ami(e) canadien(ne)..."
```

#### Tâche 3 (Question chargée depuis CSV)

```typescript
title = "Tâche 3 - Expression d'un point de vue";
description = exercise.content; // Ex: "Selon vous, les livres ont-ils perdu leur utilité..."
```

## 🌐 Utilisation Côté Web (Frontend)

### Hook `useExerciseData`

Le hook écoute les messages d'exercice et retourne les données :

```typescript
import { useExerciseData } from '@/hooks';

export function SessionView({ appConfig, selectedTask }: SessionViewProps) {
  const exerciseData = useExerciseData();

  return (
    <div>
      <h4>{exerciseData?.title || selectedTask?.title || 'Tâche'}</h4>
      <p>{exerciseData?.description || selectedTask?.description || 'Description'}</p>
    </div>
  );
}
```

### Fallback avec `selectedTask`

Le système garde un fallback sur `selectedTask` pour :

- Afficher quelque chose pendant que les données arrivent
- Assurer la compatibilité si l'agent n'envoie pas de données

```typescript
{
  exerciseData?.title || selectedTask?.title || 'Tâche';
}
{
  exerciseData?.description || selectedTask?.description || 'Description de la tâche';
}
```

## 🎨 Affichage dans l'Interface

### Emplacement

Les informations sont affichées dans le header de `SessionView` :

```
┌────────────────────────────────────────┐
│ [🎤 Audio]  Tâche 2 - Exercice...     │
│             Je suis un(e) ami(e)...   │ ← Exercice data
├────────────────────────────────────────┤
│                                        │
│  Chat Transcript                       │
│                                        │
└────────────────────────────────────────┘
```

### Styles

- **Titre** : Tronqué avec ellipsis, taille adaptative (mobile/desktop)
- **Description** : Limité à 2 lignes avec `line-clamp-2`

## 🔧 Architecture Technique

### Fichiers Concernés

#### Backend

- **TCFAgent.ts** : Méthode `sendExerciseData()` et appel dans `onEnter()`
- **exerciseLoader.ts** : Chargement des exercices depuis CSV

#### Frontend

- **hooks/useExerciseData.ts** : Hook pour écouter les messages
- **hooks/index.ts** : Export du hook
- **components/app/session-view.tsx** : Affichage des données

### Interface TypeScript

```typescript
// Frontend
export interface ExerciseData {
  title: string;
  description: string;
  content?: string;
}

export interface ExerciseMessage {
  type: 'exercise_data';
  data: ExerciseData;
}
```

## 📊 Exemple de Session Complète

```
1. User rejoint la session avec taskType: 'tache2'
2. Agent créé : TCFTache2
3. Agent.onEnter() appelé
   ↓
4. sendExerciseData() envoie:
   {
     type: 'exercise_data',
     data: {
       title: 'Tâche 2 - Exercice en interaction',
       description: 'Je suis un(e) ami(e) canadien(ne)...',
       content: 'Je suis un(e) ami(e) canadien(ne)...'
     }
   }
   ↓
5. useExerciseData() reçoit le message
   ↓
6. SessionView met à jour l'affichage
   ↓
7. User voit le titre et la description dans l'interface
```

## 🐛 Débogage

### Logs Backend

```
[Exercise] Envoi des données: {
  title: 'Tâche 2 - Exercice en interaction',
  description: 'Je suis un(e) ami(e) canadien(ne)...'
}
```

### Logs Frontend

```
[Exercise] Données reçues: {
  title: 'Tâche 2 - Exercice en interaction',
  description: 'Je suis un(e) ami(e) canadien(ne)...'
}
```

### Console du Navigateur

Ouvrez la console et cherchez les logs préfixés par `[Exercise]`.

## ⚠️ Remarques Importantes

1. **Ordre d'envoi** : Les données d'exercice sont envoyées **avant** le greeting pour que l'interface soit prête

2. **Fallback** : Le système garde `selectedTask` en fallback pour afficher quelque chose pendant le chargement

3. **Messages fiables** : Tous les messages utilisent `reliable: true` pour garantir la livraison

4. **Pas de duplication** : Les données ne sont envoyées qu'une seule fois au début de la session

## 🔗 Voir Aussi

- [TIMER-SYSTEM.md](./TIMER-SYSTEM.md) - Système de timer (utilise la même infrastructure)
- [TCFAgent.ts](../yorty-tcf-livekit-agent/src/agents/TCFAgent.ts) - Implémentation backend
- [useExerciseData.ts](./hooks/useExerciseData.ts) - Hook frontend

---

**Dernière mise à jour** : 29 décembre 2024  
**Version** : 1.0.0
