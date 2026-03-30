import { ExternalLink } from 'lucide-react';
import { AREA_NORMATIVA } from '../config/microApps';

export function AreaNormativa() {
  return (
    <div className="area-card area-normativa">
      <div className="area-header">
        <h2>AREA NORMATIVA</h2>
      </div>
      
      <div className="area-content">
        <div className="link-list">
          {AREA_NORMATIVA.map((item, index) => (
            <a 
              key={index} 
              href={item.url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="normativa-link"
            >
              <span>{item.label}</span>
              <ExternalLink size={16} />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}