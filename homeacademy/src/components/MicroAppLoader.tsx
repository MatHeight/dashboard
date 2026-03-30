import { X } from 'lucide-react';

interface MicroAppLoaderProps {
  url: string;
  title: string;
  onClose: () => void;
}

export function MicroAppLoader({ url, title, onClose }: MicroAppLoaderProps) {
  if (!url || url === '#' || url === null) {
    return (
      <div className="micro-app-container">
        <div className="micro-app-header">
          <h2>{title}</h2>
          <button onClick={onClose} className="close-btn" aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>
        <div className="micro-app-placeholder">
          <div className="placeholder-content">
            <div className="placeholder-icon">🚧</div>
            <h3>Micro-applicazione in sviluppo</h3>
            <p>Questa funzionalità verrà implementata a breve.</p>
            <p className="placeholder-hint">
              Inserisci l'URL in <code>src/config/microApps.tsx</code>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="micro-app-container">
      <div className="micro-app-header">
        <h2>{title}</h2>
        <button onClick={onClose} className="close-btn" aria-label="Chiudi">
          <X size={18} />
        </button>
      </div>
      <iframe
  src={url}
  title={title}
  className="micro-app-iframe"
  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-popups-to-escape-sandbox"
  allow="display-capture; clipboard-write"
/>
    </div>
  );
}