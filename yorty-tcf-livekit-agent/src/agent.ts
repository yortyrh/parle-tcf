import { type JobContext, ServerOptions, cli, defineAgent, metrics, voice } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { TCFTache1, TCFTache2, TCFTache3, TEFSectionA, TEFSectionB } from './agents/index.js';
import { loadServiceConfig } from './config/index.js';
import type { TaskType } from './config/index.js';

dotenv.config({ path: '.env.local' });

/**
 * Obtient la fonction de noise cancellation appropriée basée sur la configuration
 */
function getNoiseCancellation(type: string) {
  // Pour l'instant, seul BackgroundVoiceCancellation est supporté
  // BackgroundVoiceCancellationTelephony pourrait être ajouté dans le futur
  if (type === 'BackgroundVoiceCancellation' || type === 'BackgroundVoiceCancellationTelephony') {
    return BackgroundVoiceCancellation();
  }
  return BackgroundVoiceCancellation();
}

export default defineAgent({
  entry: async (ctx: JobContext) => {
    // Charger la configuration du service
    const serviceConfig = loadServiceConfig();

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({
        voice: serviceConfig.llm.voice,
        temperature: 0.8,
        modalities: serviceConfig.llm.modalities as ('text' | 'audio')[],
      }),
      // llm: new google.beta.realtime.RealtimeModel({
      //   model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      //   voice: 'Puck',
      //   temperature: 0.8,
      //   apiKey: process.env.GEMINI_API_KEY ?? '',
      // }),
    });

    // Metrics collection, to measure pipeline performance
    // For more information, see https://docs.livekit.io/agents/build/metrics/
    const usageCollector = new metrics.UsageCollector();
    session.on(voice.AgentSessionEventTypes.MetricsCollected, (ev) => {
      metrics.logMetrics(ev.metrics);
      usageCollector.collect(ev.metrics);
    });

    const logUsage = async () => {
      const summary = usageCollector.getSummary();
      console.log(`Usage: ${JSON.stringify(summary)}`);
    };

    ctx.addShutdownCallback(logUsage);

    // Join the room and connect to the user first
    await ctx.connect();

    // Wait for a participant to join and read their metadata to determine task type
    const getParticipantMetadata = (): TaskType => {
      const participants = Array.from(ctx.room.remoteParticipants.values());
      if (participants.length > 0) {
        const participant = participants[0];
        if (participant) {
          try {
            const metadata = JSON.parse(participant.metadata || '{}');
            const taskType = (metadata.taskType || 'tache1') as TaskType;
            return taskType;
          } catch (error) {
            console.error('Error parsing participant metadata:', error);
          }
        }
      }
      return 'tache1';
    };

    // Wait until the candidate is in the room so participant metadata (taskType) is present.
    // A fixed short sleep used to run before the client finished joining, yielding wrong taskType
    // and delaying or derailing the first examiner turn.
    const joinDeadlineMs = Date.now() + serviceConfig.connection.participantWaitTime;
    const pollMs = serviceConfig.connection.participantJoinPollIntervalMs ?? 200;
    while (ctx.room.remoteParticipants.size === 0 && Date.now() < joinDeadlineMs) {
      await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
    if (ctx.room.remoteParticipants.size === 0) {
      console.warn(
        '[agent] No remote participant before timeout; taskType may default to tache1. Check LiveKit connectivity and participantWaitTime.',
      );
    }
    const taskType = getParticipantMetadata();
    const rawMetadata = Array.from(ctx.room.remoteParticipants.values())[0]?.metadata;
    console.log(`[agent] participant raw metadata: ${rawMetadata}`);
    console.log(`TCF ${taskType} started in exam mode`);

    // Create the appropriate agent instance based on task type
    const agent = (() => {
      switch (taskType) {
        case 'tache1':
          return new TCFTache1(ctx);
        case 'tache2':
          return new TCFTache2(ctx);
        case 'tache3':
          return new TCFTache3(ctx);
        case 'tef-section-a':
          return new TEFSectionA(ctx);
        case 'tef-section-b':
          return new TEFSectionB(ctx);
        default:
          console.warn(`Unknown task type: ${taskType}, defaulting to tache1`);
          return new TCFTache1(ctx);
      }
    })();

    // Start the session, which initializes the voice pipeline and warms up the models
    await session.start({
      agent,
      room: ctx.room,
      inputOptions: {
        // LiveKit Cloud enhanced noise cancellation
        // Configuration loaded from service.yml
        noiseCancellation: getNoiseCancellation(
          serviceConfig.session.inputOptions.noiseCancellation,
        ),
      },
    });
  },
});

cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    // Default 500 MB warns on typical OpenAI Realtime + audio stack RSS (~520–600 MB).
    jobMemoryWarnMB: 1024,
  }),
);
