import { AREA_DOCUMENTI, MicroApp } from '../config/microApps';

interface AreaDocumentiProps {
  onSelectApp: (app: MicroApp) => void;
}

export function AreaDocumenti({ onSelectApp }: AreaDocumentiProps) {
  const handleClick = (app: MicroApp) => {
    if (app.openInNewTab && app.url && app.url !== '#') {
      window.open(app.url, '_blank', 'noopener,noreferrer');
    } else {
      onSelectApp(app);
    }
  };

  return (
    <div className="area-card area-documenti">
      <div className="area-header">
        <h2>AREA DOCUMENTI</h2>
      </div>
      
      <div className="area-content">
        <div className="app-grid">
          {AREA_DOCUMENTI.map((app) => (
            <button
              key={app.id}
              onClick={() => handleClick(app)}
              className="app-button"
            >
              <span className="app-label">{app.label}</span>
              {app.description && (
                <span className="app-description">{app.description}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}