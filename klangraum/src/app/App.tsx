import { useState } from 'react';
import { RouterProvider } from 'react-router/dom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ServicesContext, type AppServices } from './context';
import { createAppRouter } from './router';

export function App({ services }: { services: AppServices }) {
  const [router] = useState(createAppRouter);
  return (
    <ErrorBoundary>
      <ServicesContext.Provider value={services}>
        <RouterProvider router={router} />
      </ServicesContext.Provider>
    </ErrorBoundary>
  );
}
