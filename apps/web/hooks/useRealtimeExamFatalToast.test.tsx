import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { toastAlert } from '@/components/ui/alert-toast';
import { useRealtimeExamFatalToast } from './useRealtimeExamFatalToast';

const h = vi.hoisted(() => ({ exam: { fatalError: null as string | null, end: vi.fn() } }));

vi.mock('@/providers/realtime-exam-provider', () => ({ useRealtimeExam: () => h.exam }));
vi.mock('@/components/ui/alert-toast', () => ({ toastAlert: vi.fn() }));

const toast = vi.mocked(toastAlert);

beforeEach(() => {
  h.exam = { fatalError: null, end: vi.fn() };
  toast.mockReset();
});

describe('useRealtimeExamFatalToast', () => {
  it('does nothing without an error', () => {
    renderHook(() => useRealtimeExamFatalToast());
    expect(toast).not.toHaveBeenCalled();
    expect(h.exam.end).not.toHaveBeenCalled();
  });

  it('shows the error once and ends the session', () => {
    h.exam.fatalError = 'Micro refusé';
    const { rerender } = renderHook(() => useRealtimeExamFatalToast());

    expect(toast).toHaveBeenCalledTimes(1);
    const { title, description } = toast.mock.calls[0][0];
    expect(title).toBe('Session impossible');
    expect((description as ReactElement<{ children: string }>).props.children).toBe('Micro refusé');
    expect(h.exam.end).toHaveBeenCalledTimes(1);

    h.exam = { ...h.exam };
    rerender();
    expect(toast).toHaveBeenCalledTimes(1);
  });

  it('shows a new error', () => {
    h.exam.fatalError = 'Première';
    const { rerender } = renderHook(() => useRealtimeExamFatalToast());
    h.exam = { ...h.exam, fatalError: 'Seconde' };
    rerender();
    expect(toast).toHaveBeenCalledTimes(2);
  });
});
