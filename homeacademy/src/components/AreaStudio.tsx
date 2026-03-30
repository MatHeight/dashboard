import { useState } from 'react';
import { AREA_STUDIO, MicroApp } from '../config/microApps';
import { PremiumModal } from './PremiumModal';
import { useUserPermissions } from '../hooks/useUserPermissions';

interface AreaStudioProps {
  onSelectApp: (app: MicroApp) => void;
}

export function AreaStudio({ onSelectApp }: AreaStudioProps) {
  const [premiumApp, setPremiumApp] = useState<MicroApp | null>(null);
  const { hasAccess, isLoading } = useUserPermissions();

  const handleClick = (app: MicroApp) => {
    if (app.isPremium && !hasAccess(app.id)) {
      setPremiumApp(app);
      return;
    }

    if (app.openInNewTab && app.url && app.url !== '#') {
      window.open(app.url, '_blank', 'noopener,noreferrer');
    } else {
      onSelectApp(app);
    }
  };

  if (isLoading) {
    return (
      <div className="area-card area-studio">
        <div className="area-header">
          <h2>AREA STUDIO</h2>
        </div>
        <div className="area-content">
          <p>Caricamento...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="area-card area-studio">
      <div className="area-header">
        <h2>AREA STUDIO</h2>
      </div>
      
      <div className="area-content">
        <div className="app-grid">
          {AREA_STUDIO.map((app) => {
            const isLocked = app.isPremium && !hasAccess(app.id);
            
            return (
              <button
                key={app.id}
                onClick={() => handleClick(app)}
                className={`app-button ${isLocked ? 'app-button-premium' : ''}`}
              >
                <span className="app-label">{app.label}</span>
                {app.description && (
                  <span className="app-description">{app.description}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {premiumApp && (
        <PremiumModal 
          appName={premiumApp.label}
          appDescription={premiumApp.description || ''}
          onClose={() => setPremiumApp(null)}
        />
      )}
    </div>
  );
}