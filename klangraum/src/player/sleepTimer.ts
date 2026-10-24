import { create } from 'zustand';
import type { PlayerEngine } from './engine';

export type SleepMode =
  { kind: 'off' } | { kind: 'time'; endsAt: number; minutes: number } | { kind: 'endOfTrack' };

interface SleepStore {
  mode: SleepMode;
  now: number;
}

/** Schlaf-Timer: Musik hält nach einer Zeit oder am Ende des Songs an */
export const useSleepTimer = create<SleepStore>()(() => ({
  mode: { kind: 'off' },
  now: Date.now(),
}));

export const SLEEP_MINUTES = [5, 15, 30, 45, 60, 90] as const;

let engine: PlayerEngine | null = null;
let onStopped: () => void = () => undefined;
let interval: ReturnType<typeof setInterval> | null = null;

function stopTicking() {
  if (interval) clearInterval(interval);
  interval = null;
}

export function setSleepTimer(mode: SleepMode) {
  stopTicking();
  if (engine) engine.stopAfterCurrent = mode.kind === 'endOfTrack';
  useSleepTimer.setState({ mode, now: Date.now() });
  if (mode.kind !== 'time') return;
  interval = setInterval(() => {
    const now = Date.now();
    useSleepTimer.setState({ now });
    if (now < mode.endsAt) return;
    stopTicking();
    useSleepTimer.setState({ mode: { kind: 'off' } });
    engine?.pause();
    onStopped();
  }, 1000);
}

export function startSleepMinutes(minutes: number) {
  setSleepTimer({ kind: 'time', minutes, endsAt: Date.now() + minutes * 60_000 });
}

/** Verbindet den Timer mit der Engine („Ende des Songs“ wird von ihr erledigt) */
export function connectSleepTimer(player: PlayerEngine, stopped: () => void) {
  engine = player;
  onStopped = stopped;
  player.store.subscribe((s, prev) => {
    // Engine hat am Songende angehalten → Timer ist fertig
    const mode = useSleepTimer.getState().mode;
    if (mode.kind === 'endOfTrack' && !player.stopAfterCurrent && s.status !== prev.status)
      useSleepTimer.setState({ mode: { kind: 'off' } });
  });
}

export function remainingMs(mode: SleepMode, now: number): number | null {
  return mode.kind === 'time' ? Math.max(0, mode.endsAt - now) : null;
}
