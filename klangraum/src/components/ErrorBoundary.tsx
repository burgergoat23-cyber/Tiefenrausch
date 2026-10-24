import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useSettings } from '../app/settingsStore';
import { translate } from '../i18n';

interface State {
  failed: boolean;
}

/** Fängt Programmfehler ab – statt einer leeren weißen Seite kommt eine freundliche Meldung. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Klangraum-Fehler:', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <CrashScreen />;
  }
}

export function CrashScreen() {
  const lang = useSettings.getState().settings.language;
  return (
    <div className="kr-page" role="alert">
      <h1>{translate(lang, 'errors.crashTitle')}</h1>
      <p className="kr-muted">{translate(lang, 'errors.crashText')}</p>
      <div>
        <button type="button" className="kr-btn kr-btn--primary" onClick={() => location.reload()}>
          {translate(lang, 'errors.reload')}
        </button>
      </div>
    </div>
  );
}
