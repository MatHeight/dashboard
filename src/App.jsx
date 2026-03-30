import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RegistrationForm from './pages/RegistrationForm';
import Landing2 from './pages/Landing2';
import Landing2Crew from './pages/Landing2Crew';
import CrewMembro from './pages/CrewMembro';
import './App.css';

// ─── Wrapper con navigate ─────────────────────────────────────────────────────

function Landing2Wrapper({ servizio }) {
  const navigate = useNavigate();
  return <Landing2 servizio={servizio} onAcquistoCompletato={() => navigate('/dashboard')} />;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Controlla se c'è un codice crew pendente da sessionStorage
    // (salvato prima del login quando un membro clicca il link)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);

      if (session) {
        const codicePendente = sessionStorage.getItem('crew_codice_pendente');
        if (codicePendente) {
          sessionStorage.removeItem('crew_codice_pendente');
          window.location.href = `/streamath/crew/${codicePendente}`;
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        minHeight: '100vh', background: '#000',
      }}>
        <div style={{
          width: '44px', height: '44px',
          border: '2px solid rgba(255,255,255,0.08)',
          borderTopColor: '#8B0000',
          borderRadius: '50%',
          animation: 'spin 0.9s linear infinite',
        }} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route
          path="/"
          element={!session ? <Login /> : <Navigate to="/dashboard" replace />}
        />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={session ? <Dashboard /> : <Navigate to="/" replace />}
        />

        {/* Registrazione profilo */}
        <Route
          path="/registrazione"
          element={session ? <RegistrationForm /> : <Navigate to="/" replace />}
        />

        {/* Landing2 One/Go */}
        <Route
          path="/streamath/one"
          element={session ? <Landing2Wrapper servizio="one" /> : <Navigate to="/" replace />}
        />
        <Route
          path="/streamath/go"
          element={session ? <Landing2Wrapper servizio="go" /> : <Navigate to="/" replace />}
        />

        {/* Landing2 Crew — una sola route, il tipo si sceglie dentro la pagina */}
        <Route
          path="/streamath/crew"
          element={session ? <Landing2Crew /> : <Navigate to="/" replace />}
        />

        {/* Pagina membro con codice — pubblica ma richiede login */}
        <Route
          path="/streamath/crew/:codice"
          element={session ? <CrewMembro /> : <Navigate to="/" replace />}
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;