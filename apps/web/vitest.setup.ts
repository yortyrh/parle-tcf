import { afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';

// Component tests (*.test.tsx) run in jsdom; unmount between tests.
afterEach(() => {
  cleanup();
});
