import { useEffect, useRef, useState } from 'react';
import { RoomEvent } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';

export interface ReportMessage {
  type: 'report';
  report: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/**
 * Receives the examiner report. Handles single-packet messages and multipart
 * payloads when the agent splits large markdown across LiveKit data packets
 * (~15 KiB reliable limit per packet).
 */
export function useReportData() {
  const [report, setReport] = useState<string | null>(null);
  const room = useRoomContext();
  const multipartRef = useRef<{
    id: string;
    total: number;
    parts: Map<number, string>;
  } | null>(null);

  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const data = JSON.parse(new TextDecoder().decode(payload)) as unknown;
        if (!isRecord(data) || typeof data.type !== 'string') {
          return;
        }

        if (data.type === 'report') {
          if (typeof data.report !== 'string') {
            return;
          }
          console.log('[Report] Rapport reçu');
          multipartRef.current = null;
          setReport(data.report);
          return;
        }

        if (data.type === 'report_multipart') {
          const id = data.id as string;
          const total = data.total as number;
          if (typeof id !== 'string' || typeof total !== 'number' || total < 1) {
            return;
          }
          multipartRef.current = {
            id,
            total,
            parts: new Map(),
          };
          return;
        }

        if (data.type === 'report_part') {
          const id = data.id as string;
          const index = data.index as number;
          const text = data.text as string;
          const buf = multipartRef.current;
          if (
            !buf ||
            buf.id !== id ||
            typeof index !== 'number' ||
            index < 0 ||
            index >= buf.total ||
            typeof text !== 'string'
          ) {
            return;
          }
          buf.parts.set(index, text);
          if (buf.parts.size === buf.total) {
            console.log('[Report] Rapport reçu (multipart)');
            const ordered = Array.from({ length: buf.total }, (_, i) => buf.parts.get(i) ?? '');
            setReport(ordered.join(''));
            multipartRef.current = null;
          }
        }
      } catch {
        // ignore non-JSON or malformed payloads
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room]);

  return report;
}
