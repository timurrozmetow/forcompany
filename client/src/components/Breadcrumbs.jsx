import { useTranslation } from 'react-i18next';
import { ChevronRight, ChevronLeft, ArrowLeft, ArrowRight, Home } from 'lucide-react';

export default function Breadcrumbs({ crumbs, onNavigate, onBack, onForward }) {
  const { t } = useTranslation();

  return (
    <div className="toolbar" style={{ marginBottom: 10 }}>
      <div className="nav-arrows">
        <button className="btn-icon" onClick={onBack} title={t('common.back')} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <button className="btn-icon" onClick={onForward} title={t('common.forward')} aria-label="Forward">
          <ArrowRight size={18} />
        </button>
      </div>

      <nav className="breadcrumbs">
        <span
          className={`crumb ${crumbs.length === 0 ? 'current' : ''}`}
          onClick={() => onNavigate(null)}
        >
          <Home size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />
          {t('common.root')}
        </span>
        {crumbs.map((c, i) => (
          <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <ChevronRight size={15} className="sep" />
            <span
              className={`crumb ${i === crumbs.length - 1 ? 'current' : ''}`}
              onClick={() => onNavigate(c.id)}
              title={c.name}
            >
              {c.name}
            </span>
          </span>
        ))}
      </nav>
    </div>
  );
}
