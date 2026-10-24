import { lazy } from 'react';
import { createHashRouter, type RouteObject } from 'react-router';
import { AppShell } from './AppShell';
import { RouteError } from '../pages/RouteError';

// Jede Seite wird erst geladen, wenn man sie öffnet (schnellerer Start am Handy)
const HomePage = lazy(() => import('../pages/HomePage'));
const SearchPage = lazy(() => import('../pages/SearchPage'));
const LibraryPage = lazy(() => import('../pages/LibraryPage'));
const PlayerPage = lazy(() => import('../pages/PlayerPage'));
const QueuePage = lazy(() => import('../pages/QueuePage'));
const CustomizePage = lazy(() => import('../pages/CustomizePage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const CollectionPage = lazy(() => import('../pages/CollectionPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));
const RadioPage = lazy(() => import('../pages/RadioPage'));

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'suche', element: <SearchPage /> },
      { path: 'radio', element: <RadioPage /> },
      { path: 'bibliothek', element: <LibraryPage /> },
      { path: 'player', element: <PlayerPage /> },
      { path: 'warteschlange', element: <QueuePage /> },
      { path: 'anpassen', element: <CustomizePage /> },
      { path: 'einstellungen', element: <SettingsPage /> },
      { path: 'album/:sourceId/:id', element: <CollectionPage kind="album" /> },
      { path: 'artist/:sourceId/:id', element: <CollectionPage kind="artist" /> },
      { path: 'playlist/:sourceId/:id', element: <CollectionPage kind="playlist" /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

/** Hash-Router (#/suche): funktioniert auf jedem Webspace und in jedem Unterordner ohne Server-Einstellungen */
export function createAppRouter() {
  return createHashRouter(routes);
}
