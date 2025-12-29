# Configuration du Service LiveKit Agent

## Fichier : `config/service.yml`

Ce fichier contient les paramètres globaux du service LiveKit Agent, séparés des configurations spécifiques aux tâches TCF.

## Structure

### 1. Configuration du LLM (Large Language Model)

```yaml
llm:
  provider: "openai"          # Fournisseur du modèle
  model: "realtime"           # Type de modèle
  voice: "alloy"              # Voix à utiliser
  modalities:                 # Modalités supportées
    - "text"
    - "audio"
```

#### Voix disponibles OpenAI
- `alloy` - Voix par défaut, neutre et claire
- `echo` - Voix masculine, professionnelle
- `fable` - Voix féminine, expressive
- `onyx` - Voix masculine, profonde
- `nova` - Voix féminine, énergique
- `shimmer` - Voix féminine, chaleureuse

### 2. Configuration de la session

```yaml
session:
  metricsEnabled: true        # Activer la collecte de métriques
  inputOptions:
    noiseCancellation: "BackgroundVoiceCancellation"  # Type de noise cancellation
```

#### Options de Noise Cancellation
- `BackgroundVoiceCancellation` - Annulation de bruit standard (recommandé pour la plupart des cas)
- `BackgroundVoiceCancellationTelephony` - Optimisé pour la téléphonie (non encore supporté)

### 3. Configuration de la connexion

```yaml
connection:
  participantWaitTime: 1000   # Temps d'attente pour la connexion du participant (ms)
  disconnectDelay: 3000       # Délai avant déconnexion après fin d'examen (ms)
```

### 4. Message de fin d'examen

```yaml
endExamMessage:
  instructions: |
    Say goodbye to the user in a polite, friendly and encouraging way in French, 
    as they have finished the exam. Remind them to relax and wish them good luck for their results.
```

Ce message est envoyé au LLM pour générer l'audio de fin d'examen.

## Utilisation dans le code

La configuration est chargée automatiquement au démarrage de l'agent :

```typescript
import { loadServiceConfig } from '@/config';

const serviceConfig = loadServiceConfig();

// Utiliser la configuration
const session = new voice.AgentSession({
  llm: new openai.realtime.RealtimeModel({
    voice: serviceConfig.llm.voice,
    modalities: serviceConfig.llm.modalities,
  }),
});
```

## Modification de la configuration

1. Éditez `config/service.yml`
2. Modifiez les valeurs souhaitées
3. Redémarrez l'agent : `pnpm run dev`

**Note** : La configuration est mise en cache au premier chargement. Pour recharger en cours d'exécution (développement) :

```typescript
import { reloadServiceConfig } from '@/config';

const config = reloadServiceConfig();
```

## Validation

Les champs suivants sont validés au chargement :
- ✅ `llm.voice` et `llm.modalities` doivent être présents
- ✅ `session.metricsEnabled` doit être défini (boolean)
- ✅ `connection.participantWaitTime` doit être présent

Si un champ requis manque, une erreur sera levée au démarrage.

## Séparation des configurations

### `config/service.yml` (ce fichier)
- Paramètres globaux du service LiveKit
- Configuration du LLM et de la voix
- Paramètres de session et connexion
- Messages système

### `config/agents/tache{1,2,3}.yml`
- Instructions spécifiques à chaque tâche TCF
- Questions, scénarios, et sujets
- Configuration des modes (examen/préparation)
- Durées spécifiques à chaque tâche

Cette séparation permet de :
- ✅ Modifier les paramètres du service sans toucher aux tâches
- ✅ Changer de voix ou de modalités facilement
- ✅ Maintenir une configuration claire et organisée
- ✅ Réutiliser la configuration du service pour d'autres projets

## Exemples de modifications courantes

### Changer la voix

```yaml
llm:
  voice: "nova"  # Passer de alloy à nova
```

### Ajuster les délais

```yaml
connection:
  participantWaitTime: 2000    # Augmenter à 2 secondes
  disconnectDelay: 5000        # Augmenter à 5 secondes
```

### Personnaliser le message de fin

```yaml
endExamMessage:
  instructions: |
    Remerciez chaleureusement le candidat en français. 
    Félicitez-le pour ses efforts et souhaitez-lui bonne chance pour ses résultats.
    Soyez encourageant et positif.
```

## Support

Pour plus d'informations :
- `src/config/types.ts` - Types TypeScript complets
- `src/config/configLoader.ts` - Implémentation du chargeur
- `src/agent.ts` - Utilisation de la configuration

