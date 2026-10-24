import { SHORTCUTS } from '../app/shortcuts';
import { useT } from '../i18n';
import { Dialog } from './Dialog';
import styles from './Dialog.module.css';

export default function ShortcutsDialog({ onClose }: { onClose(): void }) {
  const t = useT();
  return (
    <Dialog title={t('shortcuts.title')} onClose={onClose}>
      <dl className={styles.keys}>
        {SHORTCUTS.map((s) => (
          <div key={s.label} className={styles.keyRow}>
            <dt>
              {s.keys.map((k) => (
                <kbd key={k}>{k === 'Leertaste' ? t('shortcuts.space') : k}</kbd>
              ))}
            </dt>
            <dd>{t(`shortcuts.${s.label}`)}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
