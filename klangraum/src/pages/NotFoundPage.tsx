import { Link } from 'react-router';
import { useT } from '../i18n';

export default function NotFoundPage() {
  const t = useT();
  return (
    <div className="kr-page">
      <h1>{t('errors.notFoundPage')}</h1>
      <div>
        <Link to="/" className="kr-btn">
          {t('errors.backHome')}
        </Link>
      </div>
    </div>
  );
}
