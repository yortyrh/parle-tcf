import { ImageResponse } from 'next/og';

export const alt = 'parle-tcf · Entraînement à l’expression orale du TCF avec un examinateur IA';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Social card: paper background, ink headline, poppy accent (matches the site tokens). */
export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        width: '100%',
        height: '100%',
        padding: 72,
        background: '#fbf8f2',
        color: '#1b2236',
        fontFamily: 'serif',
      }}
    >
      <div style={{ display: 'flex', fontSize: 34, fontWeight: 700 }}>
        parle<span style={{ color: '#e2562f' }}>·</span>tcf
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', fontSize: 68, lineHeight: 1.08, maxWidth: 980 }}>
          Entraînez-vous à l’expression orale du TCF avec un examinateur IA
        </div>
        <div style={{ display: 'flex', fontSize: 30, color: '#4a5468', fontFamily: 'sans-serif' }}>
          3 tâches au temps officiel · évaluation CECRL sur 5 critères
        </div>
      </div>
      <div
        style={{ display: 'flex', height: 10, width: 220, background: '#1f5d8c', borderRadius: 5 }}
      />
    </div>,
    size
  );
}
