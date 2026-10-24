import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { setCoverResolver, useCovers } from '../library/covers';

setCoverResolver(null);

afterEach(() => {
  cleanup();
  localStorage.clear();
  useCovers.setState({ urls: {} });
});
