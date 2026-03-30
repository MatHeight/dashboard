import { X } from 'lucide-react';

interface PremiumModalProps {
  appName: string;
  appDescription: string;
  onClose: () => void;
}

export function PremiumModal({ appName, appDescription, onClose }: PremiumModalProps) {
  return (
    <div className="premium-modal-overlay" onClick={onClose}>
      <div className="premium-modal-container" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="premium-modal-close" aria-label="Chiudi">
          <X size={20} />
        </button>
        
        <div className="premium-modal-content">
          {/* 👈 RIMOSSA ICONA ROBOT */}
          
          <h3>{appName}</h3>
          
          <p className="premium-modal-description">
            {appDescription}
          </p>
          
          {/* 👈 MODIFICA QUI: testo del messaggio */}
          <p className="premium-modal-info">
            Questa applicazione non è inclusa nel tuo piano, 
            ma se vuoi puoi aggiungerla singolarmente.
          </p>
          
          {/* 👈 MODIFICA QUI: link bottone */}
          <a 
            href="#"
            className="premium-modal-button"
            target="_blank"
            rel="noopener noreferrer"
          >
            Maggiori informazioni
          </a>
        </div>
      </div>
    </div>
  );
}