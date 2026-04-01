/**
 * Wire protocol types for data messages exchanged between agent and web client
 * over LiveKit reliable data channels.
 */

// ---------------------------------------------------------------------------
// Agent -> Web
// ---------------------------------------------------------------------------

export interface ExerciseData {
  title: string;
  description: string;
  content?: string;
  exerciseId?: string;
  taskType?: string;
}

export interface ExerciseDataMessage {
  type: "exercise_data";
  data: ExerciseData;
}

export interface ExerciseImageMessage {
  type: "exerciseImage";
  id?: string;
  filename: string;
  section: "A" | "B";
  annonce?: string;
  title?: string;
  consigne?: string;
  generatedImagePath?: string | null;
  generatedImagePaths?: Record<string, string> | null;
}

export interface ReportMessage {
  type: "report";
  report: string;
}

export interface ReportMultipartMessage {
  type: "report_multipart";
  id: string;
  total: number;
}

export interface ReportPartMessage {
  type: "report_part";
  id: string;
  index: number;
  text: string;
}

export interface SessionEndMessage {
  type: "session_end";
}

export interface SessionRestartMessage {
  type: "session_restart";
}

// ---------------------------------------------------------------------------
// Web -> Agent
// ---------------------------------------------------------------------------

export interface RestartTestMessage {
  type: "restart_test";
}

// ---------------------------------------------------------------------------
// Discriminated union of all data messages
// ---------------------------------------------------------------------------

export type AgentToWebMessage =
  | ExerciseDataMessage
  | ExerciseImageMessage
  | ReportMessage
  | ReportMultipartMessage
  | ReportPartMessage
  | SessionEndMessage
  | SessionRestartMessage;

export type WebToAgentMessage = RestartTestMessage;

export type DataMessage = AgentToWebMessage | WebToAgentMessage;
