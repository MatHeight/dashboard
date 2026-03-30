import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import ConoscitivaForm from './ConoscitivaForm';
import './Dashboard.css';

const GLASS_COLORS = [
  'rgba(0, 31, 80, 0.55)',
  'rgba(100, 0, 20, 0.52)',
  'rgba(0, 60, 80, 0.52)',
  'rgba(60, 20, 80, 0.52)',
  'rgba(0, 50, 50, 0.52)',
  'rgba(80, 40, 0, 0.52)',
];

const BANNER_SLOTS = [
  {
    titolo: 'Novità Academy',
    messaggio: 'Nuovi moduli di algebra disponibili dalla prossima settimana.',
    link: { testo: 'Scopri →', url: '/academy' },
  },
  {
    titolo: 'Evento in arrivo',
    messaggio: 'Webinar gratuito sul metodo MatHeight — 15 marzo ore 18:00.',
    link: { testo: 'Iscriviti →', url: '/eventi' },
  },
  {
    titolo: 'Risorse aggiornate',
    messaggio: 'Le mappe concettuali di geometria sono state revisionate.',
    link: { testo: 'Vai alle risorse →', url: '/risorse' },
  },
];

const SERVIZIO_LABEL = {
  one:   'StreaMathOne',
  go:    'StreaMathGo',
  crew2: 'StreaMathCrew',
  crew3: 'StreaMathCrew',
  crew4: 'StreaMathCrew',
};

function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDataOra(iso) {
  return new Date(iso).toLocaleString('it-IT', {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  });
}

async function registerSession(userId, provider) {
  try {
    await supabase.from('login_sessions').insert({
      user_id: userId,
      provider: provider ?? 'email',
      user_agent: navigator.userAgent,
    });
  } catch (_) {}
}

function getServizioFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('servizio') ?? null;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [profilo, setProfilo] = useState(null);
  const [abbonamenti, setAbb] = useState([]);
  const [notifiche, setNotifiche] = useState([]);

  const [loading, setLoading] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [needsConoscitiva, setNeedsConoscitiva] = useState(false);
  const [servizioConoscitiva, setServizioConoscitiva] = useState('');

  useEffect(() => { init(); }, []);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/'); return; }
    setUser(session.user);

    // ── Gate 1: profilo completo? ─────────────────────────────────────────────
    const { data: prof } = await supabase
      .from('profili_utenti')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (prof) {
      const isComplete = prof.classe != null && prof.id_logico != null
        && prof.classe > 0 && prof.id_logico > 0;
      if (!isComplete) { setNeedsRegistration(true); setLoading(false); return; }
      setProfilo(prof);
    } else {
      setNeedsRegistration(true); setLoading(false); return;
    }

    // ── Gate 2: conoscitiva necessaria? ───────────────────────────────────────
    const servizioUrl = getServizioFromUrl();
    if (servizioUrl) {
      const { data: con } = await supabase
        .from('conoscitive')
        .select('id')
        .eq('user_id', session.user.id)
        .eq('servizio_interessato', servizioUrl)
        .maybeSingle();
      if (!con) {
        setServizioConoscitiva(servizioUrl);
        setNeedsConoscitiva(true);
        setLoading(false);
        return;
      }
    }

    // ── Abbonamenti attivi ────────────────────────────────────────────────────
    const { data: subs } = await supabase
      .from('abbonamenti')
      .select('id, data_scadenza, servizi ( nome_servizio, url )')
      .eq('id_utente', session.user.id)
      .gte('data_scadenza', new Date().toISOString())
      .order('data_scadenza', { ascending: true });
    if (subs) setAbb(subs);

    // ── Notifiche ─────────────────────────────────────────────────────────────
    const { data: notif } = await supabase
      .from('notifiche_abbonamenti')
      .select('id, tipo_notifica, abbonamento_id, creata_il')
      .eq('user_id', session.user.id)
      .eq('inviata', true)
      .order('creata_il', { ascending: false })
      .limit(5);
    if (notif) setNotifiche(notif);

    await registerSession(session.user.id, session.user.app_metadata?.provider);
    setLoading(false);
  }

  async function handleLogout() {
    try {
      await supabase
        .from('login_sessions')
        .update({ is_active: false, last_activity: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('is_active', true);
    } catch (_) {}
    await supabase.auth.signOut();
    navigate('/');
  }

  // ── Gate 1 ────────────────────────────────────────────────────────────────
  if (needsRegistration) {
    return (
      <div className="dashboard">
        <header className="dash-header">
          <div className="brand">
            <div className="brand-line brand-line-top" />
            <h1 className="brand-name">MatHeight</h1>
            <div className="brand-line brand-line-bottom" />
          </div>
        </header>
        <main className="dash-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <div style={{ textAlign: 'center', maxWidth: '500px', padding: '2rem' }}>
            <h2 style={{ color: '#d8e8f5', marginBottom: '1rem', fontSize: '1.8rem' }}>Completa il tuo profilo</h2>
            <p style={{ color: '#a0b5c8', marginBottom: '2rem', lineHeight: '1.6' }}>
              Prima di accedere alla dashboard, completa la tua registrazione inserendo classe e indirizzo di studio.
            </p>
            <button
              onClick={() => navigate('/registrazione')}
              style={{
                display: 'inline-block', background: 'linear-gradient(135deg, #001f3f, #8B0000)',
                color: '#fff', padding: '1rem 2rem', borderRadius: '8px', border: 'none',
                fontWeight: '600', fontSize: '1.1rem', cursor: 'pointer',
              }}
            >
              Completa registrazione →
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ── Gate 2 ────────────────────────────────────────────────────────────────
  if (needsConoscitiva) {
    return (
      <ConoscitivaForm
        servizio={servizioConoscitiva}
        onComplete={() => {
          setNeedsConoscitiva(false);
          window.history.replaceState({}, '', window.location.pathname);
          init();
        }}
      />
    );
  }

  // ── Dati calcolati ────────────────────────────────────────────────────────
  const displayName = profilo?.nome || user?.email || '';
  const abbIds = new Set(abbonamenti.map(a => a.id));
  const notifAttive = notifiche.filter(n => abbIds.has(n.abbonamento_id));

  function labelNotifica(tipo) {
    switch (tipo) {
      case 'scadenza_7gg': return 'Scade tra 7 giorni';
      case 'scadenza_3gg': return 'Scade tra 3 giorni';
      case 'scadenza_1gg': return 'Scade domani!';
      case 'scaduto':      return 'Abbonamento scaduto';
      default:             return tipo;
    }
  }

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="brand">
          <div className="brand-line brand-line-top" />
          <h1 className="brand-name">MatHeight</h1>
          <div className="brand-line brand-line-bottom" />
        </div>
        <div className="dash-user">
          {displayName && <span className="user-greeting">Ciao, {displayName}</span>}
          <button onClick={handleLogout} className="btn-logout">Esci</button>
        </div>
      </header>

      <main className="dash-main">
        {loading ? (
          <div className="dash-loading"><div className="spinner" /></div>
        ) : (
          <>
            {/* Notifiche scadenza */}
            {notifAttive.length > 0 && (
              <div className="notif-banner">
                {notifAttive.map(n => (
                  <div key={n.id} className="notif-item">
                    <span className="notif-icon">⚠</span>
                    <span>{labelNotifica(n.tipo_notifica)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Abbonamenti attivi */}
            <h2 className="page-title">Abbonamenti Attivi</h2>
            <div className="cards-grid">
              {abbonamenti.length === 0 ? (
                <div className="empty-state">
                  <p>Non hai ancora abbonamenti attivi.</p>
                </div>
              ) : (
                abbonamenti.map((sub, idx) => {
                  const nomeSub = sub.servizi?.nome_servizio ?? 'Servizio';
                  const urlServizio = sub.servizi?.url ?? '#';
                  const giorni = daysUntil(sub.data_scadenza);
                  const scadenza = new Date(sub.data_scadenza).toLocaleDateString('it-IT');
                  const glassColor = GLASS_COLORS[idx % GLASS_COLORS.length];
                  const barWidth = Math.min(100, Math.round((giorni / 90) * 100));
                  return (
                    <div key={sub.id} className="sub-card" style={{ background: glassColor }}>
                      <a href={urlServizio} style={{ textDecoration: 'none', display: 'block' }}>
                        <div className="card-top">
                          <h3 className="card-service-name">{nomeSub}</h3>
                          <div className="card-accent" />
                        </div>
                        <div className="card-bottom">
                          <div className="card-row">
                            <span className="row-label">Scadenza</span>
                            <span className={`row-value ${giorni < 7 ? 'expiring' : ''}`}>{scadenza}</span>
                          </div>
                          <div className="days-bar-wrap">
                            <div className={`days-bar ${giorni < 7 ? 'critical' : ''}`} style={{ width: `${barWidth}%` }} />
                          </div>
                        </div>
                      </a>
                      {/* Prenota sessioni per servizi StreaMath → va su Landing2 */}
                      {(() => {
                        const nomeMin = nomeSub.toLowerCase();
                        let route = null;
                        if (nomeMin.includes('one')) route = '/streamath/one';
                        else if (nomeMin.includes('go')) route = '/streamath/go';
                        else if (nomeMin.includes('crew')) route = '/streamath/crew';
                        if (!route) return null;
                        return (
                          <div
                            onClick={() => navigate(route)}
                            style={{
                              padding: '8px 0',
                              textAlign: 'center', fontSize: 12,
                              fontWeight: 700, color: 'rgba(255,255,255,0.7)',
                              borderTop: '1px solid rgba(255,255,255,0.15)',
                              cursor: 'pointer',
                            }}
                          >
                            📅 Prenota sessioni →
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>

            {/* Banner info */}
            <div className="info-banner">
              {BANNER_SLOTS.map((slot, i) => (
                <div key={i} className="info-banner-slot">
                  <span className="slot-title">{slot.titolo}</span>
                  <span className="slot-message">{slot.messaggio}</span>
                  {slot.link && (
                    <a href={slot.link.url} className="slot-link">{slot.link.testo}</a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}