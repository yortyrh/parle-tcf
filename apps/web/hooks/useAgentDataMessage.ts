import { useEffect, useRef } from 'react';
import { RoomEvent } from 'livekit-client';
import { useRoomContext } from '@livekit/components-react';

/**
 * Listens for agent data messages of a specific type using room-level events.
 *
 * Uses `RoomEvent.DataReceived` on the Room object instead of per-participant
 * listeners. The Room reference is stable across the session, avoiding the
 * subscribe/unsubscribe race condition that occurs when listening on individual
 * RemoteParticipant objects (whose array reference changes on every property
 * update, causing event listener gaps where messages can be dropped).
 */
export function useAgentDataMessage<T extends { type: string }>(
  messageType: string,
  onMessage: (data: T) => void
) {
  const room = useRoomContext();
  const callbackRef = useRef(onMessage);
  callbackRef.current = onMessage;

  useEffect(() => {
    const handleDataReceived = (payload: Uint8Array) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);
        if (data.type === messageType) {
          callbackRef.current(data as T);
        }
      } catch {
        // Not a valid JSON message or wrong shape, ignore
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);
    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, messageType]);
}
