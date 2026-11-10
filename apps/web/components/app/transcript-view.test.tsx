import { describe, expect, it } from 'vitest';
import type { AttemptDetail } from '@parle-tcf/shared';
import { render, screen, within } from '@testing-library/react';
import { ErrorLegend, TranscriptView } from './transcript-view';

type Line = AttemptDetail['transcript'][number];

const examiner: Line = {
  seq: 0,
  speaker: 'examiner',
  text: 'Parlez-moi de vous.',
  correctedText: null,
  errors: null,
};

const candidate: Line = {
  seq: 1,
  speaker: 'candidate',
  text: 'Je suis allé à le marché hier.',
  correctedText: 'Je suis allé au marché hier.',
  errors: [{ start: 13, end: 17, type: 'grammaire', explanation: 'contraction « au »' }],
};

describe('TranscriptView', () => {
  it('labels each line with its speaker and shows plain text when not corrected', () => {
    render(<TranscriptView lines={[examiner, candidate]} corrected={false} />);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Examinateur')).toBeInTheDocument();
    expect(within(items[0]).getByText('Parlez-moi de vous.')).toBeInTheDocument();
    expect(within(items[1]).getByText('Candidat')).toBeInTheDocument();
    expect(within(items[1]).getByText('Je suis allé à le marché hier.')).toBeInTheDocument();
    expect(screen.queryByText('Version corrigée')).not.toBeInTheDocument();
    expect(document.querySelector('mark')).toBeNull();
  });

  it('shows the candidate line, its correction and its highlighted errors once corrected', () => {
    render(<TranscriptView lines={[examiner, candidate]} corrected />);
    const item = screen.getAllByRole('listitem')[1];

    expect(within(item).getByText('Ce que vous avez dit')).toBeInTheDocument();
    expect(within(item).getByText('Version corrigée')).toBeInTheDocument();
    expect(within(item).getByText('Je suis allé au marché hier.')).toBeInTheDocument();

    const mark = item.querySelector('mark');
    expect(mark).toHaveTextContent('à le (erreur de grammaire)');
    expect(mark).toHaveAttribute('title', 'grammaire : contraction « au »');
    expect(mark?.parentElement).toHaveTextContent(
      'Je suis allé à le (erreur de grammaire) marché hier.'
    );
    expect(within(item).getByText(/: contraction « au »/)).toHaveTextContent(
      'grammaire « à le » : contraction « au »'
    );
  });

  it('never corrects the examiner', () => {
    render(<TranscriptView lines={[examiner]} corrected />);
    expect(screen.queryByText('Version corrigée')).not.toBeInTheDocument();
  });

  it('falls back to the original text when there is no correction, without an error list', () => {
    const clean: Line = { ...candidate, correctedText: null, errors: [] };
    render(<TranscriptView lines={[clean]} corrected />);
    expect(screen.getAllByText('Je suis allé à le marché hier.')).toHaveLength(2);
    expect(screen.getAllByRole('list')).toHaveLength(1);
  });

  it('highlights errors in text order and keeps the first of overlapping ones', () => {
    const line: Line = {
      ...candidate,
      text: 'abcdefghij',
      errors: [
        { start: 6, end: 8, type: 'lexique', explanation: 'second' },
        { start: 1, end: 4, type: 'syntaxe', explanation: 'premier' },
        { start: 2, end: 5, type: 'registre', explanation: 'chevauche' },
      ],
    };
    render(<TranscriptView lines={[line]} corrected />);
    const marks = [...document.querySelectorAll('mark')].map((m) => m.firstChild?.textContent);
    expect(marks).toEqual(['bcd', 'gh']);
    expect(document.querySelector('mark')?.parentElement).toHaveTextContent(
      /^abcd \(erreur de syntaxe\)efgh \(erreur de lexique\)ij$/
    );
  });
});

describe('ErrorLegend', () => {
  it('lists the four error types', () => {
    render(<ErrorLegend />);
    const legend = screen.getByRole('list', { name: 'Légende des erreurs' });
    expect(
      within(legend)
        .getAllByRole('listitem')
        .map((li) => li.textContent)
    ).toEqual(['grammaire', 'lexique', 'syntaxe', 'registre']);
  });
});
