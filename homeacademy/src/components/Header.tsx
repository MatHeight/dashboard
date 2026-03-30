import { User } from 'lucide-react';

interface HeaderProps {
  userProfile?: {
    nome?: string;
    classe?: number;
    indirizzo_reale?: string;
  } | null;
}

export function Header({ userProfile }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo">
          <h1>MathHeight</h1>
          <span className="logo-subtitle">HOME ACADEMY</span>
        </div>
      </div>

      <div className="header-right">
        <div className="user-info">
          <div className="user-avatar">
            <User size={20} />
          </div>
          <div className="user-details">
            {userProfile ? (
              <span className="user-name">
                {userProfile.nome || 'Studente'}
                {userProfile.classe && (
                  <>
                    {' · '}
                    {userProfile.classe}° {userProfile.indirizzo_reale || ''}
                  </>
                )}
              </span>
            ) : (
              <span className="user-name">Studente</span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}