# Système de Minuteur TCF

Documentation du système de minuteur pour les examens TCF.

## 📋 Vue d'ensemble

Le système de minuteur permet à l'agent (backend) de contrôler l'affichage d'un compte à rebours dans l'interface web. Il gère deux types de timers :

1. **Timer de préparation** : Pour le temps de préparation avant l'exercice
2. **Timer d'examen** : Pour la durée de l'exercice

## 🎯 Fonctionnalités

- ✅ Affichage en temps réel dans le coin haut-droit
- ✅ Compte à rebours avec minutes et secondes
- ✅ États visuels : Normal → Avertissement (≤30s) → Danger (≤10s)
- ✅ Animation de pulsation quand le temps est écoulé
- ✅ Responsive (adapté mobile et desktop)
- ✅ Contrôlé entièrement par l'agent

## 📡 Messages de Contrôle

L'agent envoie des messages JSON via le data channel pour contrôler le timer :

### 1. Démarrer le timer de préparation

```json
{
  "type": "start_preparation_timer",
  "duration": 60,
  "timestamp": 1704067200000
}
```

**Paramètres :**
- `type` : `"start_preparation_timer"`
- `duration` : Durée en secondes (optionnel, défaut: 60)
- `timestamp` : Timestamp de démarrage en millisecondes (optionnel, défaut: Date.now())

### 2. Arrêter le timer de préparation

```json
{
  "type": "end_preparation_timer"
}
```

**Paramètres :**
- `type` : `"end_preparation_timer"`

### 3. Démarrer le timer d'examen

```json
{
  "type": "start_exam_timer",
  "duration": 120,
  "timestamp": 1704067260000
}
```

**Paramètres :**
- `type` : `"start_exam_timer"`
- `duration` : Durée en secondes (optionnel, défaut: 120)
- `timestamp` : Timestamp de démarrage en millisecondes (optionnel, défaut: Date.now())

### 4. Arrêter le timer d'examen

```json
{
  "type": "end_exam_timer"
}
```

**Paramètres :**
- `type` : `"end_exam_timer"`

## 💻 Utilisation côté Agent (Backend)

### Méthode Recommandée : TimerController

Le projet inclut une classe `TimerController` qui simplifie l'envoi de messages de timer :

```typescript
import { TimerController, TCF_DURATIONS } from './agents/TimerController.js';
import type { JobContext } from '@livekit/agents';

class MyTCFAgent extends TCFAgent {
  private timer: TimerController;

  constructor(context: JobContext) {
    super(context);
    this.timer = new TimerController(context, this);
  }

  async handleTache2(exercise: TCFExercise) {
    // Phase de préparation (2 minutes)
    await this.timer.runPreparationPhase(TCF_DURATIONS.TACHE_2.preparation);
    
    // Phase d'examen (3 minutes)
    await this.timer.runExamPhase(TCF_DURATIONS.TACHE_2.exam);
  }

  async handleTache3WithWarnings(exercise: TCFExercise) {
    // Phase de préparation
    await this.timer.runPreparationPhase(TCF_DURATIONS.TACHE_3.preparation);
    
    // Phase d'examen avec avertissements vocaux
    await this.timer.runExamPhaseWithWarnings(
      TCF_DURATIONS.TACHE_3.exam,
      async (timeLeft) => {
        if (timeLeft === 60) {
          await this.say("Il vous reste 1 minute.");
        }
      }
    );
  }
}
```

Pour plus d'exemples et de détails, voir [TIMER-USAGE.md](../yorty-tcf-livekit-agent/TIMER-USAGE.md).

### Envoi Manuel de Messages

Si vous avez besoin d'envoyer manuellement des messages de timer, utilisez la méthode `sendDataMessage` de `TCFAgent` :

```typescript
// Dans votre classe TCFAgent
async handleCustomTimer() {
  // Démarrer un timer de préparation
  await this.sendDataMessage(this.context, {
    type: 'start_preparation_timer',
    duration: 60,
    timestamp: Date.now()
  });

  // Attendre 60 secondes
  await new Promise(resolve => setTimeout(resolve, 60000));

  // Arrêter le timer
  await this.sendDataMessage(this.context, {
    type: 'end_preparation_timer'
  });
}
```

**Note** : La méthode `sendDataMessage` se trouve dans `TCFAgent.ts` (lignes 81-85) et gère automatiquement l'encodage JSON et l'envoi via `publishData` avec `reliable: true`.

## 🎨 États Visuels

Le timer change d'apparence selon le temps restant :

### État Normal (> 30 secondes)
- Bordure bleu primaire
- Fond bleu clair
- Texte bleu

### État Avertissement (≤ 30 secondes)
- Bordure orange
- Fond orange clair
- Texte orange

### État Danger (≤ 10 secondes)
- Bordure rouge
- Fond rouge clair
- Texte rouge
- Animation de pulsation
- Message "Temps écoulé!"

## 📱 Responsive Design

Le timer s'adapte automatiquement :

**Mobile (< 640px) :**
- Taille réduite
- Texte plus petit
- Position : top-2 right-2

**Desktop (≥ 640px) :**
- Taille normale
- Position : top-4 right-4

## 🔧 Architecture Technique

### Hook `useTimerControls`

```typescript
const { timerState, resetTimer } = useTimerControls();

// timerState contient :
interface TimerState {
  type: 'preparation' | 'exam' | null;
  isRunning: boolean;
  startTime: number | null;
  duration: number; // en secondes
}
```

### Composant `TimerDisplay`

```tsx
<TimerDisplay timerState={timerState} className="..." />
```

**Props :**
- `timerState` : État du timer (requis)
- `className` : Classes CSS supplémentaires (optionnel)

## 🧪 Test et Débogage

### Logs de débogage

Le hook `useTimerControls` affiche des logs détaillés dans la console du navigateur :

```
[Timer] Message reçu: { type: 'start_preparation_timer', duration: 120 }
[Timer] Timer de préparation démarré: 120s
[Timer] Timer de préparation arrêté
[Timer] Message reçu: { type: 'start_exam_timer', duration: 180 }
[Timer] Timer d'examen démarré: 180s
[Timer] Timer d'examen arrêté
```

**Types de logs :**
- ✅ Messages de timer reçus avec leurs paramètres
- ✅ Démarrage/arrêt des timers
- ⚠️ Messages non-JSON ignorés
- ⚠️ Types de message inconnus

### Vérification du Data Channel

Pour vérifier que les messages arrivent bien côté client, ouvrez la console du navigateur et observez les logs préfixés par `[Timer]`. Si aucun log n'apparaît :

1. Vérifiez que l'agent envoie bien les messages
2. Vérifiez que le data channel est actif (connexion établie)
3. Vérifiez que les participants distants sont bien connectés

## 📊 Durées Recommandées par Tâche TCF

| Tâche | Préparation | Examen |
|-------|-------------|--------|
| Tâche 1 | 0 min | 2 min |
| Tâche 2 | 2 min | 3-4 min |
| Tâche 3 | 3 min | 4-5 min |

## ⚠️ Remarques Importantes

1. **Synchronisation** : Le timestamp permet de synchroniser le timer même si le message arrive avec un délai
2. **Fiabilité** : Les messages sont envoyés avec `reliable: true` pour garantir la livraison
3. **État local** : Le timer fonctionne côté client, l'agent doit seulement envoyer les commandes
4. **Persistance** : Le timer se réinitialise automatiquement à la déconnexion

## 🚀 Améliorations Futures

- [ ] Son d'alerte quand le temps est écoulé
- [ ] Affichage du temps écoulé après la fin du timer
- [ ] Pause/reprise du timer
- [ ] Historique des timers dans la session
- [ ] Export des statistiques de temps

## 🐛 Dépannage

### Le timer ne s'affiche pas

1. Vérifier que les messages sont bien envoyés depuis l'agent
2. Vérifier la console du navigateur pour les logs de débogage
3. S'assurer que le format JSON est correct
4. Vérifier que le data channel est actif

### Le timer n'est pas synchronisé

- Toujours inclure le `timestamp` lors du démarrage
- Vérifier que l'horloge du serveur et du client sont synchronisées

### Le timer continue après la fin

- S'assurer d'envoyer le message `end_*_timer` approprié
- Vérifier que le message de fin arrive bien au client

## 📚 Références

- [LiveKit Data Channel](https://docs.livekit.io/client-sdk-js/classes/LocalParticipant.html#publishData)
- [LiveKit Components React](https://docs.livekit.io/reference/components/react/)
- [TCF Official Guidelines](https://www.france-education-international.fr/tcf)

---

**Dernière mise à jour** : 29 décembre 2024  
**Version** : 1.0.0

