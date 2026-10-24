import { useT } from '../i18n';

export default function LibraryPage() {
  const t = useT();
  return (
    <div className="kr-page">
      <h1>{t('library.title')}</h1>
      <p className="kr-card kr-muted">{t('library.comingSoon')}</p>
    </div>
  );
}
