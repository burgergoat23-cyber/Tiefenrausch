import { SETTINGS_STORAGE_KEY } from '../storage/settings';

const DONE_KEY = 'klangraum.onboarded';

/** Erster Start: noch nie etwas eingestellt und noch nicht begrüßt */
export function needsOnboarding(): boolean {
  try {
    return (
      localStorage.getItem(DONE_KEY) === null && localStorage.getItem(SETTINGS_STORAGE_KEY) === null
    );
  } catch {
    return false;
  }
}

export function markOnboardingDone() {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    // egal
  }
}
