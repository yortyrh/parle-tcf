import { useCallback, useEffect, useState } from 'react';
import { useRemoteParticipants } from '@livekit/components-react';

export interface ReportMessage {
  type: 'report';
  report: string;
}

/**
 * Hook pour recevoir le rapport depuis l'agent
 */
export function useReportData() {
  const [report, setReport] = useState<string | null>(null);
  const remoteParticipants = useRemoteParticipants();

  const handleReportMessage = useCallback((message: ReportMessage) => {
    console.log('[Report] Rapport reçu');
    setReport(message.report);
  }, []);

  useEffect(() => {
    // Fonction pour gérer les données reçues
    const handleDataReceived = (payload: Uint8Array) => {
      // Décoder les données
      const decoder = new TextDecoder();
      const text = decoder.decode(payload);

      try {
        // Parser le JSON
        const data = JSON.parse(text);

        // Vérifier si c'est un message de rapport
        if (data.type === 'report') {
          handleReportMessage(data as ReportMessage);
        }
      } catch {
        // Pas un message JSON ou pas un message de rapport, ignorer
        console.debug('[Report] Message non-JSON ignoré');
      }
    };

    // S'abonner aux événements de données de tous les participants distants
    const unsubscribeFns: Array<() => void> = [];

    remoteParticipants.forEach((participant) => {
      // Écouter les événements de données
      participant.on('dataReceived', handleDataReceived);

      // Ajouter la fonction de désabonnement
      unsubscribeFns.push(() => {
        participant.off('dataReceived', handleDataReceived);
      });
    });

    // Nettoyer les abonnements lors du démontage
    return () => {
      unsubscribeFns.forEach((unsubscribe) => unsubscribe());
    };
  }, [remoteParticipants, handleReportMessage]);

  return report;
}
