import type { CreateExamSessionInput, CreateExamSessionOutput } from '@yorty-tcf/shared';

function getExamApiBase(): string {
  const base = process.env.NEXT_PUBLIC_EXAM_API_URL;
  if (!base) {
    return 'http://localhost:3001';
  }
  return base.replace(/\/$/, '');
}

export async function createExamSession(
  input: CreateExamSessionInput
): Promise<CreateExamSessionOutput> {
  const res = await fetch(`${getExamApiBase()}/exam/session/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Exam session failed: ${res.status}`);
  }
  return res.json() as Promise<CreateExamSessionOutput>;
}
