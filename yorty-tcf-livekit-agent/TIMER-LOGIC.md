# Logique du Système de Timer TCF

Documentation de la logique de gestion des timers de préparation et d'examen.

## 📋 Vue d'ensemble

Le système de timer gère automatiquement deux phases :
1. **Phase de préparation** : L'étudiant prépare sa réponse (optionnel, selon la tâche)
2. **Phase d'examen** : L'étudiant répond à l'exercice

## 🔄 Flux de Fonctionnement

### 1. Initialisation

```
agent.initializeExamTimer(ctx) → définit le contexte et les écouteurs
           ↓
   session.start() → démarre la session
           ↓
   agent.onEnter() → envoie le greeting + exercice
```

### 2. Phase de Préparation (si `durations.preparation > 0`)

```
onEnter() termine le greeting
           ↓
startPreparationTimer() → envoie start_preparation_timer
           ↓
     État: 'preparation'
           ↓
   [DEUX POSSIBILITÉS]
           ↓
    ┌──────┴──────┐
    │             │
Timeout         Entrée utilisateur
écoulé          détectée
    │             │
    ↓             ↓
end_prep       end_prep + start_exam
    │             │
    └──────┬──────┘
           ↓
   État: 'idle' ou 'exam'
```

### 3. Phase d'Examen

```
startExamTimer() → envoie start_exam_timer
           ↓
     État: 'exam'
           ↓
   Timeout écoulé
           ↓
    end_exam_timer
           ↓
   État: 'finished'
```

## 🎯 Comportement selon la Tâche

### Tâche 1 (Pas de préparation)
```
Greeting → Attente entrée utilisateur → Timer examen (2 min)
```

**Durées :**
- Préparation : 0 secondes
- Examen : 120 secondes (2 min)

### Tâche 2 (Avec préparation)
```
Greeting → Timer préparation (2 min) → [Timeout OU Entrée utilisateur] → Timer examen (3.5 min)
```

**Durées :**
- Préparation : 120 secondes (2 min)
- Examen : 210 secondes (3.5 min)

**Comportements :**
- Si l'utilisateur **attend** 2 minutes : Le timer de préparation se termine, puis le timer d'examen démarre lors de la première entrée utilisateur
- Si l'utilisateur **parle pendant** la préparation : Le timer de préparation s'arrête immédiatement et le timer d'examen démarre

### Tâche 3 (Pas de préparation)
```
Greeting → Attente entrée utilisateur → Timer examen (4.5 min)
```

**Durées :**
- Préparation : 0 secondes
- Examen : 270 secondes (4.5 min)

## 🔍 États du Timer

Le système utilise une machine à états pour gérer les transitions :

| État | Description | Transitions possibles |
|------|-------------|---------------------|
| `idle` | État initial, en attente | → `preparation` (si durée > 0)<br>→ `exam` (si pas de préparation) |
| `preparation` | Timer de préparation actif | → `exam` (entrée utilisateur)<br>→ `idle` (timeout) |
| `exam` | Timer d'examen actif | → `finished` (timeout) |
| `finished` | Session terminée | Aucune |

## 📡 Messages Envoyés

### Démarrage de la préparation
```json
{
  "type": "start_preparation_timer",
  "duration": 120,
  "timestamp": 1704067200000
}
```

### Fin de la préparation
```json
{
  "type": "end_preparation_timer"
}
```

### Démarrage de l'examen
```json
{
  "type": "start_exam_timer",
  "duration": 210,
  "timestamp": 1704067320000
}
```

### Fin de l'examen
```json
{
  "type": "end_exam_timer"
}
```

## 🎪 Événements Écoutés

### `UserInputTranscribed`
Déclenché quand l'utilisateur parle et que sa parole est transcrite.

**Actions selon l'état :**
- **État `preparation`** : Arrête la préparation et démarre l'examen
- **État `idle`** : Démarre l'examen (pour tâches sans préparation)
- **État `exam`** ou `finished`** : Aucune action

## 🧹 Nettoyage

La méthode `cleanup()` est appelée lors de l'arrêt de la session pour :
- Annuler les timeouts en cours
- Libérer les ressources

```typescript
ctx.addShutdownCallback(() => {
  agent.cleanup();
});
```

## 🐛 Logs de Débogage

Le système affiche des logs détaillés :

```
[Timer] Greeting terminé, démarrage de la préparation
[Timer] Démarrage du timer de préparation (120s)
[Timer] Préparation interrompue par entrée utilisateur
[Timer] Démarrage du timer d'examen (210s)
[Timer] Temps d'examen écoulé
```

## ⚠️ Remarques Importantes

1. **Ordre d'initialisation** : `initializeExamTimer(ctx)` doit être appelé **avant** `session.start()` pour que le contexte soit disponible dans `onEnter()`.

2. **Entrée utilisateur pendant la préparation** : Si l'utilisateur commence à parler pendant la préparation, le timer de préparation s'arrête **immédiatement** et le timer d'examen démarre, sans perte de temps.

3. **Pas de double démarrage** : Les vérifications d'état (`this.timerState`) empêchent les démarrages multiples de timers.

4. **Gestion des timeouts** : Les `setTimeout` sont stockés et nettoyés proprement pour éviter les fuites mémoire.

5. **Messages fiables** : Tous les messages sont envoyés avec `reliable: true` pour garantir la livraison même en cas de latence réseau.

## 🔗 Fichiers Concernés

- **TCFAgent.ts** : Logique principale des timers
- **agent.ts** : Initialisation et nettoyage
- **TimerController.ts** : Utilitaire alternatif (non utilisé ici, mais disponible)
- **tache1.yml, tache2.yml, tache3.yml** : Configuration des durées

## 📊 Diagramme de Séquence (Tâche 2 avec interruption)

```
User          Agent          Timer System          Web Client
 |              |                  |                    |
 |  [Rejoint]   |                  |                    |
 |------------->|                  |                    |
 |              |   Greeting       |                    |
 |<-------------|                  |                    |
 |              |                  |                    |
 |              | start_prep(120s) |                    |
 |              |----------------->|                    |
 |              |                  | start_preparation  |
 |              |                  |------------------->|
 |              |                  |      [Timer: 2:00] |
 |  [Parle]     |                  |                    |
 |------------->|                  |                    |
 |              | [UserInputTrans] |                    |
 |              | end_prep         |                    |
 |              |----------------->|                    |
 |              |                  | end_preparation    |
 |              |                  |------------------->|
 |              | start_exam(210s) |                    |
 |              |----------------->|                    |
 |              |                  | start_exam         |
 |              |                  |------------------->|
 |              |                  |      [Timer: 3:30] |
 |    ...       |       ...        |        ...         |
 |              | end_exam         |                    |
 |              |----------------->|                    |
 |              |                  | end_exam           |
 |              |                  |------------------->|
```

---

**Dernière mise à jour** : 29 décembre 2024  
**Version** : 1.0.0

