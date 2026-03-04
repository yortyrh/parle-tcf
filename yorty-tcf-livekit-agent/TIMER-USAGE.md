# Utilisation du Système de Timer

Guide d'utilisation du système de timer pour les agents TCF.

## 📋 Import

```typescript
import { TCF_DURATIONS, TimerController } from './agents/TimerController.js';
```

## 🚀 Utilisation de Base

### Initialisation

Le `TimerController` nécessite le contexte de la room et l'instance de l'agent :

```typescript
import type { JobContext } from '@livekit/agents';
import type { TCFAgent } from './TCFAgent.js';
import { TimerController } from './TimerController.js';

class MyTCFAgent extends TCFAgent {
  private timer: TimerController;

  constructor(context: JobContext) {
    super(context);
    this.timer = new TimerController(context, this);
  }
}
```

## 📝 Exemples d'Utilisation

### Exemple 1: Tâche 1 (Sans préparation)

```typescript
async handleTache1() {
  console.log('=== Tâche 1: Expression Orale ===');

  // Instructions de l'agent (5 secondes)
  await this.say("Bonjour, nous allons commencer la tâche 1...");

  // Démarrer le timer d'examen (2 minutes)
  await this.timer.runExamPhase(TCF_DURATIONS.TACHE_1.exam);

  // Fin de la tâche
  await this.say("Merci, la tâche 1 est terminée.");
}
```

### Exemple 2: Tâche 2 (Avec préparation)

```typescript
async handleTache2(exercise: TCFExercise) {
  console.log('=== Tâche 2: Interaction ===');

  // Présenter l'exercice
  await this.say(`Voici votre situation: ${exercise.situation}`);

  // Phase de préparation (2 minutes)
  await this.say("Vous avez 2 minutes pour vous préparer.");
  await this.timer.runPreparationPhase(TCF_DURATIONS.TACHE_2.preparation);

  // Transition
  await this.say("Nous allons maintenant commencer l'exercice.");

  // Phase d'examen (3 minutes)
  await this.timer.runExamPhase(TCF_DURATIONS.TACHE_2.exam);

  // Fin
  await this.say("Merci, la tâche 2 est terminée.");
}
```

### Exemple 3: Tâche 3 (Avec avertissements vocaux)

```typescript
async handleTache3(exercise: TCFExercise) {
  console.log('=== Tâche 3: Expression d\'Opinion ===');

  // Présenter le sujet
  await this.say(`Voici le sujet: ${exercise.question}`);

  // Phase de préparation (3 minutes)
  await this.say("Vous avez 3 minutes pour préparer votre réponse.");
  await this.timer.runPreparationPhase(TCF_DURATIONS.TACHE_3.preparation);

  // Transition
  await this.say("Vous pouvez maintenant présenter votre point de vue.");

  // Phase d'examen avec avertissements (4 minutes)
  await this.timer.runExamPhaseWithWarnings(
    TCF_DURATIONS.TACHE_3.exam,
    async (timeLeft) => {
      if (timeLeft === 120) {
        await this.say("Il vous reste 2 minutes.");
      } else if (timeLeft === 60) {
        await this.say("Il vous reste 1 minute.");
      } else if (timeLeft === 30) {
        await this.say("Il vous reste 30 secondes.");
      }
    }
  );

  // Fin
  await this.say("Merci, la tâche 3 est terminée.");
}
```

## 🎯 Méthodes Disponibles

### `startPreparationTimer(duration?: number)`

Démarre le timer de préparation.

- **duration**: Durée en secondes (défaut: 60)

```typescript
await this.timer.startPreparationTimer(120); // 2 minutes
```

### `endPreparationTimer()`

Arrête le timer de préparation.

```typescript
await this.timer.endPreparationTimer();
```

### `startExamTimer(duration?: number)`

Démarre le timer d'examen.

- **duration**: Durée en secondes (défaut: 120)

```typescript
await this.timer.startExamTimer(180); // 3 minutes
```

### `endExamTimer()`

Arrête le timer d'examen.

```typescript
await this.timer.endExamTimer();
```

### `runPreparationPhase(duration: number)`

Exécute une phase de préparation complète (démarre, attend, arrête).

```typescript
await this.timer.runPreparationPhase(120); // 2 minutes
```

### `runExamPhase(duration: number)`

Exécute une phase d'examen complète (démarre, attend, arrête).

```typescript
await this.timer.runExamPhase(180); // 3 minutes
```

### `runExamPhaseWithWarnings(duration: number, onWarning?: (timeLeft: number) => Promise<void>)`

Exécute une phase d'examen avec des avertissements automatiques.

```typescript
await this.timer.runExamPhaseWithWarnings(240, async (timeLeft) => {
  console.log(`Il reste ${timeLeft} secondes`);
  await this.say(`Il vous reste ${timeLeft} secondes.`);
});
```

Les avertissements sont envoyés automatiquement à :

- Mi-parcours (si durée ≥ 2 minutes)
- 1 minute restante
- 30 secondes restantes

## 📊 Constantes de Durée

Utilisez `TCF_DURATIONS` pour les durées recommandées :

```typescript
// Tâche 1
TCF_DURATIONS.TACHE_1.preparation; // 0 secondes
TCF_DURATIONS.TACHE_1.exam; // 120 secondes (2 min)

// Tâche 2
TCF_DURATIONS.TACHE_2.preparation; // 120 secondes (2 min)
TCF_DURATIONS.TACHE_2.exam; // 180 secondes (3 min)

// Tâche 3
TCF_DURATIONS.TACHE_3.preparation; // 180 secondes (3 min)
TCF_DURATIONS.TACHE_3.exam; // 240 secondes (4 min)
```

## ⚙️ Fonctionnement Interne

Le `TimerController` utilise la méthode `sendDataMessage` de `TCFAgent` pour envoyer des messages JSON au client web via le data channel LiveKit.

Format des messages :

```typescript
// Démarrer un timer
{
  type: 'start_preparation_timer' | 'start_exam_timer',
  duration: 120,
  timestamp: Date.now()
}

// Arrêter un timer
{
  type: 'end_preparation_timer' | 'end_exam_timer'
}
```

## 🐛 Débogage

Les logs sont automatiquement affichés dans la console :

```
[Timer] Message envoyé: start_preparation_timer (120s)
[Timer] Début de la préparation (120s)
[Timer] Fin de la préparation
[Timer] Message envoyé: end_preparation_timer
```

Pour activer plus de logs côté client, ouvrez la console du navigateur.

## ⚠️ Remarques Importantes

1. **Synchronisation** : Le timestamp est envoyé avec les messages de démarrage pour garantir la synchronisation même en cas de latence réseau.

2. **Fiabilité** : Les messages sont envoyés avec `reliable: true` pour garantir la livraison.

3. **Non-bloquant** : Les méthodes `run*Phase` sont bloquantes (attendent la fin du timer). Si vous avez besoin d'un comportement non-bloquant, utilisez `start*Timer` et gérez l'attente vous-même.

4. **Interruption** : Si la session se termine pendant un timer, le timer s'arrêtera automatiquement côté client.

## 🔗 Voir Aussi

- [TIMER-SYSTEM.md](../yorty-tcf-livekit-web/TIMER-SYSTEM.md) - Documentation complète du système côté client
- [TCFAgent.ts](./src/agents/TCFAgent.ts) - Classe de base des agents TCF

---

**Dernière mise à jour** : 29 décembre 2024  
**Version** : 1.0.0
