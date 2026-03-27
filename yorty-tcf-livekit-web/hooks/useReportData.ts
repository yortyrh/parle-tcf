import { useState } from 'react';
import { useAgentDataMessage } from './useAgentDataMessage';

export interface ReportMessage {
  type: 'report';
  report: string;
}

export function useReportData() {
  const [report, setReport] = useState<string | null>(null);

  useAgentDataMessage<ReportMessage>('report', (data) => {
    console.log('[Report] Rapport reçu');
    setReport(data.report);
  });

  return report;
}
