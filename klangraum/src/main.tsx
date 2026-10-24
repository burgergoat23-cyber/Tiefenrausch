import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import './app/global.css';
import { App } from './app/App';
import { setupApp } from './app/setup';

const services = setupApp();

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
);
