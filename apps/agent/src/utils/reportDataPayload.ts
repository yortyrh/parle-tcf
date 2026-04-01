import { randomUUID } from 'node:crypto';

/**
 * LiveKit reliable data packets are limited (~15 KiB user payload after headers).
 * @see https://docs.livekit.io/home/client/data/packets/
 */
export const LIVEKIT_RELIABLE_DATA_MAX_BYTES = 14000;

/** Conservative chunk size for report body so JSON + escaping stays under the cap. */
export const REPORT_TEXT_CHUNK_MAX_BYTES = 2800;

const encoder = new TextEncoder();

/**
 * Split a string into segments whose UTF-8 byte length is at most maxBytes.
 * Iterates by Unicode code points so emojis are not split.
 */
export function splitUtf8ByMaxBytes(s: string, maxBytes: number): string[] {
  const out: string[] = [];
  let current = '';
  for (const ch of s) {
    const next = current + ch;
    if (encoder.encode(next).length > maxBytes) {
      if (current.length === 0) {
        out.push(ch);
        current = '';
      } else {
        out.push(current);
        current = ch;
      }
    } else {
      current = next;
    }
  }
  if (current.length > 0) {
    out.push(current);
  }
  return out;
}

/**
 * Build one or more JSON-serializable payloads for the web client.
 * Uses a single `report` message when small enough; otherwise multipart.
 */
export function buildReportDataMessages(
  report: string,
  options?: { newId?: () => string },
): Array<Record<string, unknown>> {
  const newId = options?.newId ?? randomUUID;
  const singlePayload = JSON.stringify({ type: 'report', report });
  if (encoder.encode(singlePayload).length <= LIVEKIT_RELIABLE_DATA_MAX_BYTES) {
    return [{ type: 'report', report }];
  }

  const id = newId();
  const chunks = splitUtf8ByMaxBytes(report, REPORT_TEXT_CHUNK_MAX_BYTES);
  const messages: Array<Record<string, unknown>> = [
    { type: 'report_multipart', id, total: chunks.length },
  ];

  for (let index = 0; index < chunks.length; index++) {
    const text = chunks[index];
    const part = { type: 'report_part', id, index, text };
    const wire = JSON.stringify(part);
    if (encoder.encode(wire).length > LIVEKIT_RELIABLE_DATA_MAX_BYTES) {
      throw new Error(
        `report_part exceeds LiveKit limit at index ${index} (reduce REPORT_TEXT_CHUNK_MAX_BYTES)`,
      );
    }
    messages.push(part);
  }

  return messages;
}
