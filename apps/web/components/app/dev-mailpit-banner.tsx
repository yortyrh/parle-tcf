'use client';

import { useEffect, useState } from 'react';

const MAILPIT_URL = process.env.NEXT_PUBLIC_MAILPIT_URL ?? 'http://localhost:8025';

/** Local development only: emails land in Mailpit instead of a real inbox. */
export function DevMailpitBanner() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(
      process.env.NODE_ENV === 'development' &&
        ['localhost', '127.0.0.1'].includes(window.location.hostname)
    );
  }, []);
  if (!visible) return null;
  return (
    <p className="mb-4 rounded-md border border-dashed px-3 py-2 text-center text-xs">
      Développement : les e-mails arrivent dans{' '}
      <a href={MAILPIT_URL} target="_blank" rel="noreferrer" className="underline">
        Mailpit
      </a>
      .
    </p>
  );
}
