import { Info } from 'lucide-react';
import { useState } from 'react';

interface AppInfoTooltipProps {
  description: string;
}

export function AppInfoTooltip({ description }: AppInfoTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="app-info-container">
      <button
        className="app-info-button"
        onClick={(e) => {
          e.stopPropagation();
          setShowTooltip(!showTooltip);
        }}
        aria-label="Informazioni app"
      >
        <Info size={18} />
      </button>
      
      {showTooltip && (
        <>
          <div 
            className="app-info-backdrop" 
            onClick={(e) => {
              e.stopPropagation();
              setShowTooltip(false);
            }}
          />
          <div className="app-info-tooltip">
            {description}
          </div>
        </>
      )}
    </div>
  );
}