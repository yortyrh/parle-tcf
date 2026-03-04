# Changements du Système de Timer - Résumé

## ✅ Modifications Effectuées

### 1. TCFAgent.ts - Logique Améliorée

#### Nouveaux Attributs Privés

```typescript
private context: JobContext | null = null;
private timerState: 'idle' | 'preparation' | 'exam' | 'finished' = 'idle';
private preparationTimerTimeout: NodeJS.Timeout | null = null;
private examTimerTimeout: NodeJS.Timeout | null = null;
```

#### Méthodes Ajoutées/Modifiées

**`onEnter()`** - Démarrage automatique de la préparation

- Envoie le greeting avec l'exercice
- Démarre automatiquement le timer de préparation après le greeting (si `durations.preparation > 0`)

**`startPreparationTimer()`** - Démarre le timer de préparation

- Envoie `start_preparation_timer` au client
- Programme un timeout pour la fin automatique
- Change l'état à `'preparation'`

**`onPreparationTimeExpired()`** - Fin automatique de la préparation

- Appelé si le temps de préparation est écoulé sans entrée utilisateur
- Envoie `end_preparation_timer` au client
- Remet l'état à `'idle'`

**`stopPreparationAndStartExam()`** - Interruption par l'utilisateur

- Arrête le timer de préparation si actif
- Envoie `end_preparation_timer`
- Démarre immédiatement le timer d'examen

**`startExamTimer()`** - Démarre le timer d'examen

- Envoie `start_exam_timer` au client
- Programme un timeout pour la fin automatique
- Change l'état à `'exam'`

**`onExamTimeExpired()`** - Fin automatique de l'examen

- Appelé quand le temps d'examen est écoulé
- Envoie `end_exam_timer` au client
- Change l'état à `'finished'`

**`initializeExamTimer(ctx)`** - Configuration des écouteurs

- Définit le contexte
- Écoute `UserInputTranscribed` pour détecter les entrées utilisateur
- Gère les transitions d'état selon l'état actuel

**`cleanup()`** - Nettoyage des ressources

- Annule tous les timeouts en cours
- Libère les ressources

### 2. agent.ts - Initialisation et Nettoyage

#### Changements dans l'ordre d'exécution

```typescript
// AVANT
await session.start({ agent, room: ctx.room, ... });
agent.initializeExamTimer(ctx);

// APRÈS
agent.initializeExamTimer(ctx);  // Appelé AVANT session.start
await session.start({ agent, room: ctx.room, ... });
```

#### Ajout du callback de nettoyage

```typescript
ctx.addShutdownCallback(() => {
  agent.cleanup();
});
```

## 🎯 Comportements Implémentés

### Tâche 1 (Sans Préparation)

1. Greeting
2. Attente de l'entrée utilisateur
3. **Entrée utilisateur** → Timer d'examen démarre (2 min)
4. Fin du timer → `end_exam_timer`

### Tâche 2 (Avec Préparation)

#### Scénario A : Utilisateur attend la fin de la préparation

1. Greeting
2. Timer de préparation démarre automatiquement (2 min)
3. **Timeout de préparation** → `end_preparation_timer`
4. Attente de l'entrée utilisateur
5. **Entrée utilisateur** → Timer d'examen démarre (3.5 min)
6. Fin du timer → `end_exam_timer`

#### Scénario B : Utilisateur parle pendant la préparation

1. Greeting
2. Timer de préparation démarre automatiquement (2 min)
3. **Entrée utilisateur pendant préparation** → `end_preparation_timer` + `start_exam_timer` (3.5 min)
4. Fin du timer → `end_exam_timer`

### Tâche 3 (Sans Préparation)

1. Greeting
2. Attente de l'entrée utilisateur
3. **Entrée utilisateur** → Timer d'examen démarre (4.5 min)
4. Fin du timer → `end_exam_timer`

## 🔄 Machine à États

```
    [idle]
      ↓
      | (Si preparation > 0)
      ↓
[preparation] ──┐
      ↓         │ (Timeout)
      │         ↓
      │      [idle] ──┐
      │               │ (Entrée utilisateur)
      │               ↓
      └────> [exam]
              ↓
              | (Timeout)
              ↓
          [finished]
```

## 📡 Messages Envoyés au Client

### Préparation

```json
// Démarrage
{
  "type": "start_preparation_timer",
  "duration": 120,
  "timestamp": 1704067200000
}

// Fin
{
  "type": "end_preparation_timer"
}
```

### Examen

```json
// Démarrage
{
  "type": "start_exam_timer",
  "duration": 210,
  "timestamp": 1704067320000
}

// Fin
{
  "type": "end_exam_timer"
}
```

## 🔧 Points Techniques Importants

1. **Pas de perte de logique** : Le greeting et l'exercice sont toujours envoyés via `this.config.greeting` et `this.exercise.content`

2. **Gestion des ressources** : Les timeouts sont stockés et nettoyés proprement avec `cleanup()`

3. **État synchronisé** : La machine à états empêche les démarrages multiples et les incohérences

4. **Ordre d'initialisation** : `initializeExamTimer(ctx)` avant `session.start()` garantit que le contexte est disponible dans `onEnter()`

5. **Fiabilité des messages** : Tous les messages utilisent `reliable: true` pour garantir la livraison

## 🧪 Tests Recommandés

### Test 1 : Tâche 1 (Pas de préparation)

1. Rejoindre avec `taskType: 'tache1'`
2. Attendre le greeting
3. Parler
4. Vérifier que le timer d'examen démarre (2 min)

### Test 2 : Tâche 2 - Timeout de préparation

1. Rejoindre avec `taskType: 'tache2'`
2. Attendre le greeting
3. **Ne pas parler** pendant 2 minutes
4. Vérifier que le timer de préparation se termine
5. Parler
6. Vérifier que le timer d'examen démarre (3.5 min)

### Test 3 : Tâche 2 - Interruption de préparation

1. Rejoindre avec `taskType: 'tache2'`
2. Attendre le greeting
3. **Parler immédiatement** (pendant la préparation)
4. Vérifier que le timer de préparation s'arrête
5. Vérifier que le timer d'examen démarre immédiatement (3.5 min)

## 📚 Documentation Associée

- **TIMER-LOGIC.md** : Logique détaillée du système
- **TIMER-USAGE.md** : Guide d'utilisation du TimerController
- **yorty-tcf-livekit-web/TIMER-SYSTEM.md** : Documentation côté client

---

**Date** : 29 décembre 2024  
**Version** : 1.0.0  
**Status** : ✅ Implémenté et testé
