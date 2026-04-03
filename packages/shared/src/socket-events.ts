/**
 * Socket.io event names and payloads (server may broadcast to session rooms).
 */
export const SOCKET_EVENTS = {
  JOIN_SESSION: 'join_session',
  SESSION_END: 'session_end',
  REPORT: 'report',
  SESSION_RESTART: 'session_restart',
} as const;

export interface JoinSessionPayload {
  sessionId: string;
}

export interface SessionEndSocketPayload {
  sessionId: string;
}

export interface ReportSocketPayload {
  sessionId: string;
  report: string;
}

export interface SessionRestartSocketPayload {
  sessionId: string;
}
