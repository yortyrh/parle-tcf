'use client';

import { useMemo } from 'react';
import type { AppConfig } from '@/app-config';

export function useCustomTokenSource(
  appConfig: AppConfig,
  taskType: 'tache1' | 'tache2' | 'tache3'
) {
  return useMemo(() => {
    // Create a custom fetch function that includes task type
    const customFetch = async () => {
      const response = await fetch('/api/connection-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_type: taskType,
          mode: 'exam', // Always exam mode
          room_config: appConfig.agentName
            ? {
                agents: [{ agent_name: appConfig.agentName }],
              }
            : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get connection details: ${error}`);
      }

      return response.json();
    };

    // Return a TokenSource-like object with a fetch method
    return {
      fetch: customFetch,
    };
  }, [appConfig, taskType]);
}
