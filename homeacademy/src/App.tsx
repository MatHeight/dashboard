import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Header } from './components/Header';
import { AreaNormativa } from './components/AreaNormativa';
import { AreaDocumenti } from './components/AreaDocumenti';
import { AreaStudio } from './components/AreaStudio';
import { MicroAppLoader } from './components/MicroAppLoader';
import { MicroApp } from './config/microApps';
import './App.css';

type AreaType = 'studio' | 'documenti' | 'normativa' | null;

const SB_URL = import.meta.env.VITE_SUPABASE_URL || 'https://vwpigreayunxjusxpmjx.supabase.co';
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cGlncmVheXVueGp1c3hwbWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NTM5MjEsImV4cCI6MjA4NTMyOTkyMX0.ad33Ubut-_qLAuM-aKSOzhlF5VbfghXbw2RxE0LxGTk';
//const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || '/dashboard';

const supabase = createClient(SB_URL, SB_KEY);

export default function HomeAcademyApp() {
  const [view, setView] = useState('LOADING');
  const [selectedApp, setSelectedApp] = useState<MicroApp | null>(null);
  const [selectedArea, setSelectedArea] = useState<AreaType>(null);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    async function init() {
      try {
        // Sessione Supabase con refresh obbligatorio
        let { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // Refresh obbligatorio se sessione non trovata
          const { data: refreshed } = await supabase.auth.refreshSession();
          session = refreshed.session;
        }

        if (!session) {
          console.error('❌ Nessuna sessione attiva');
          window.location.href = DASHBOARD_URL;
          return;
        }

        const userId = session.user.id;

        const { data: profile, error: pError } = await supabase
          .from('profili_utenti')
          .select('nome, classe, indirizzo_reale, id_logico')
          .eq('id', userId)
          .single();

        if (pError) throw pError;
        setUserProfile(profile);

        setView('HUB');
      } catch (err) {
        console.error('❌ Errore init:', err);
        setView('ERROR');
      }
    }

    init();
  }, []);

  // ========================================
  // CIELO DINAMICO + SOLE E LUNA
  // ========================================
  useEffect(() => {
    function updateSkyAndCelestialBodies() {
      const now = new Date();
      const hour = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutes = hour * 60 + minutes;
      
      const body = document.body;
      
      body.classList.remove('time-morning', 'time-afternoon', 'time-sunset', 'time-evening', 'time-night');
      
      if (hour >= 6 && hour < 11) {
        body.classList.add('time-morning');
      } else if (hour >= 11 && hour < 17) {
        body.classList.add('time-afternoon');
      } else if (hour >= 17 && hour < 19) {
        body.classList.add('time-sunset');
      } else if (hour >= 19 && hour < 22) {
        body.classList.add('time-evening');
      } else {
        body.classList.add('time-night');
      }
      
      let sun = document.querySelector('.sun') as HTMLElement;
      let moon = document.querySelector('.moon') as HTMLElement;
      
      if (!sun) {
        sun = document.createElement('div');
        sun.className = 'celestial-body sun';
        body.appendChild(sun);
      }
      
      if (!moon) {
        moon = document.createElement('div');
        moon.className = 'celestial-body moon';
        body.appendChild(moon);
      }
      
      if (hour >= 6 && hour < 19) {
        const sunStart = 6 * 60;
        const sunEnd = 19 * 60;
        const sunProgress = (totalMinutes - sunStart) / (sunEnd - sunStart);
        
        const sunLeft = 5 + (sunProgress * 90);
        const sunTop = 5 + Math.sin(sunProgress * Math.PI) * 10;
        
        sun.style.left = `${sunLeft}%`;
        sun.style.top = `${sunTop}%`;
      }
      
      if (hour >= 19 || hour < 6) {
        const moonStart = 19 * 60;
        const moonEnd = (24 + 6) * 60;
        let moonMinutes = totalMinutes;
        
        if (hour < 6) {
          moonMinutes = (24 * 60) + totalMinutes;
        }
        
        const moonProgress = (moonMinutes - moonStart) / (moonEnd - moonStart);
        
        const moonLeft = 5 + (moonProgress * 90);
        const moonTop = 5 + Math.sin(moonProgress * Math.PI) * 10;
        
        moon.style.left = `${moonLeft}%`;
        moon.style.top = `${moonTop}%`;
      }
    }
    
    updateSkyAndCelestialBodies();
    const interval = setInterval(updateSkyAndCelestialBodies, 60000);
    
    return () => clearInterval(interval);
  }, []);

  function handleSelectApp(app: MicroApp) {
    setSelectedApp(app);
  }

  function handleCloseApp() {
    setSelectedApp(null);
  }

  function handleSelectArea(area: AreaType) {
    setSelectedArea(area);
  }

  function handleBackToGallery() {
    setSelectedArea(null);
  }

  if (view === 'LOADING') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold text-slate-600">Caricamento HomeAcademy...</p>
        </div>
      </div>
    );
  }

  if (view === 'ERROR') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center text-red-600 max-w-md">
          <p className="font-bold text-xl mb-2">⚠️ Errore di accesso</p>
          <p className="text-sm mb-4">Impossibile accedere all'HomeAcademy</p>
          <a
            href={DASHBOARD_URL}
            className="inline-block px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm"
          >
            Torna alla Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <Header userProfile={userProfile} />
      
      <main className="main-content">
        <div className={`dashboard-container ${selectedApp ? 'app-open' : ''}`}>
          {selectedArea === null ? (
            <>
             
              
              <div className="gallery-grid">
                <div className="area-preview area-studio" onClick={() => handleSelectArea('studio')}>
                  <h2>AREA STUDIO</h2>
                  <p className="preview-hint">Clicca per aprire</p>
                </div>
                
                <div className="area-preview area-documenti" onClick={() => handleSelectArea('documenti')}>
                  <h2>AREA DOCUMENTI</h2>
                  <p className="preview-hint">Clicca per aprire</p>
                </div>
                
                <div className="area-preview area-normativa" onClick={() => handleSelectArea('normativa')}>
                  <h2>AREA NORMATIVA</h2>
                  <p className="preview-hint">Clicca per aprire</p>
                </div>
              </div>
              
              <button className="back-to-dashboard-btn" onClick={() => window.location.href = '/dashboard'}>
                ← Torna alla Dashboard
              </button>
            </>
          ) : (
            <>
              <button className="back-to-gallery-btn" onClick={handleBackToGallery}>
                ← Torna alla galleria
              </button>
              
              {selectedArea === 'studio' && <AreaStudio onSelectApp={handleSelectApp} />}
              {selectedArea === 'documenti' && <AreaDocumenti onSelectApp={handleSelectApp} />}
              {selectedArea === 'normativa' && <AreaNormativa />}
              
              <button className="back-to-dashboard-btn" onClick={() => window.location.href = '/dashboard'}>
                ← Torna alla Dashboard
              </button>
            </>
          )}
        </div>

        {selectedApp && (
          <div className="micro-app-overlay">
            <MicroAppLoader
              url={selectedApp.url || ''}
              title={selectedApp.label}
              onClose={handleCloseApp}
            />
          </div>
        )}
      </main>
    </div>
  );
}