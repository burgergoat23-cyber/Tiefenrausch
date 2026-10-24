import { useRef } from 'react';
import { useDialogs } from '../../app/dialogStore';
import { useSettings } from '../../app/settingsStore';
import { useToasts } from '../../app/toastStore';
import { Icon } from '../../components/Icon';
import { useT } from '../../i18n';
import { buildBackup, downloadJson, MAX_BACKUP_BYTES, parseBackup } from '../../library/backup';
import { useLibrary } from '../../library/libraryStore';
import { saveSettings, safeLocalStorage } from '../../storage/settings';
import styles from '../SettingsPage.module.css';

/** Abspielen: Autoplay, Tastenkürzel */
export function PlaybackSettings() {
  const t = useT();
  const autoplay = useSettings((s) => s.settings.autoplay);
  const setAutoplay = useSettings((s) => s.setAutoplay);
  const openDialog = useDialogs((s) => s.open);
  return (
    <section className="kr-section kr-card" aria-labelledby="s-play">
      <h2 id="s-play">{t('settings.playback')}</h2>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          role="switch"
          checked={autoplay}
          onChange={(e) => setAutoplay(e.target.checked)}
        />
        <span>{t('settings.autoplay')}</span>
      </label>
      <p className="kr-muted">{t('settings.autoplayHint')}</p>
      <div>
        <button type="button" className="kr-btn" onClick={() => openDialog({ kind: 'shortcuts' })}>
          {t('shortcuts.title')}
        </button>
      </div>
    </section>
  );
}

/** Sichern und Laden (Datei) – z. B. für ein neues Handy */
export function BackupSettings() {
  const t = useT();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToasts((s) => s.show);
  const importData = useLibrary((s) => s.importData);

  const onExport = () => {
    const data = buildBackup(useSettings.getState().settings, useLibrary.getState().data);
    const day = new Date().toISOString().slice(0, 10);
    downloadJson(`klangraum-sicherung-${day}.json`, data);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const parsed =
      file.size > MAX_BACKUP_BYTES
        ? null
        : parseBackup(await file.text(), useSettings.getState().settings);
    if (!parsed) {
      toast('backup.invalid', undefined, 'error');
      return;
    }
    importData(parsed.library);
    if (parsed.settings) {
      useSettings.setState({ settings: parsed.settings });
      saveSettings(safeLocalStorage(), parsed.settings);
    }
    toast('backup.imported', {
      likes: parsed.library.likes.length,
      playlists: parsed.library.playlists.length,
    });
  };

  return (
    <section className="kr-section kr-card" aria-labelledby="s-backup">
      <h2 id="s-backup">{t('backup.title')}</h2>
      <p className="kr-muted">{t('backup.hint')}</p>
      <div className={styles.buttons}>
        <button type="button" className="kr-btn" onClick={onExport}>
          <Icon name="download" size={18} />
          {t('backup.export')}
        </button>
        <button type="button" className="kr-btn" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" size={18} />
          {t('backup.import')}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          data-testid="backup-file"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
    </section>
  );
}
