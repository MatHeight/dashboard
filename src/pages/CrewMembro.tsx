import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate, useParams } from 'react-router-dom';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface GruppoInfo {
  id: string;
  codice: string;
  tipo: 'crew2' | 'crew3' | 'crew4';
  stato: string;
  scade_il: string;
  capogruppo_id: string;
}

interface Slot {
  id: string;
  data_ora: string;
  durata_minuti: number;
  note: string | null;
}

interface Conoscitiva {
  id: string;
  modalita: 'sincrona' | 'asincrona';
  stato: string;
  conoscitive_messaggi?: {
    id: string; autore: string;
    testo: string | null; media_url: string | null; created_at: string;
  }[];
}

interface MembroInfo {
  stato: 'in_attesa' | 'pagato' | 'scaduto';
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const TIPO_INFO = {
  crew2: { label: 'StreaMathCrew 2', membri: 2 },
  crew3: { label: 'StreaMathCrew 3', membri: 3 },
  crew4: { label: 'StreaMathCrew 4', membri: 4 },
};

// Prezzi DB per i membri (stesso schema di Landing2crew)
const SERVIZIO_PREZZI: Record<string, string> = {
  crew2: 'streamathcrew_2',
  crew3: 'streamathcrew_3',
  crew4: 'streamathcrew_4',
};

// ─── Palette ─────────────────────────────────────────────────────────────────

const C = {
  bg:         '#06080d',
  cardBg:     'rgba(0,206,209,0.07)',
  cardBorder: 'rgba(0,206,209,0.22)',
  priceBg:    'rgba(0,206,209,0.14)',
  teal:       '#00ced1',
  slate:      '#4a90d9',
  gold:       '#f5bc76',
  amber:      '#f5a623',
  text1:      '#deeaf5',
  text2:      'rgba(180,205,225,0.65)',
  text3:      'rgba(180,205,225,0.35)',
};

// ─── Utils ────────────────────────────────────────────────────────────────────

function formatDataLunga(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatOra(iso: string) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function formatEuro(centesimi: number) {
  if (centesimi === 0) return 'Da definire';
  return `€${(centesimi / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CrewMembro() {
  const navigate   = useNavigate();
  const { codice } = useParams<{ codice: string }>();

  const [user, setUser]               = useState<any>(null);
  const [gruppo, setGruppo]           = useState<GruppoInfo | null>(null);
  const [slots, setSlots]             = useState<Slot[]>([]);
  const [conoscitiva, setConoscitiva] = useState<Conoscitiva | null>(null);
  const [membroInfo, setMembroInfo]   = useState<MembroInfo | null>(null);
  const [membriPagati, setMembriPagati] = useState(0);
  const [prezzoSingolo, setPrezzoSingolo] = useState(0);
  const [loading, setLoading]         = useState(true);
  const [errore, setErrore]           = useState('');
  const [step, setStep]               = useState<'info' | 'successo'>('info');
  const [processing, setProcessing]   = useState(false);
  const [secondiRimasti, setSecondiRimasti] = useState<number | null>(null);
  const [gruppoScaduto, setGruppoScaduto]   = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef  = useRef<any>(null);

  useEffect(() => { init(); }, [codice]);

  // Countdown + realtime — avviati dopo che gruppo è caricato
  useEffect(() => {
    if (!gruppo || step === 'successo') return;

    const scadeIlDate = new Date(gruppo.scade_il);

    // Countdown
    const tick = () => {
      const sec = Math.max(0, Math.round((scadeIlDate.getTime() - Date.now()) / 1000));
      setSecondiRimasti(sec);
      if (sec === 0) {
        clearInterval(countdownRef.current!);
        supabase.rpc('scadi_riserve_scadute');
        setGruppoScaduto(true);
      }
    };
    tick();
    countdownRef.current = setInterval(tick, 1000);

    // Realtime: conta i membri pagati
    const aggiornaMemb = async () => {
      const { data } = await supabase
        .from('crew_membri').select('id')
        .eq('gruppo_id', gruppo.id).eq('stato', 'pagato');
      if (data) setMembriPagati(data.length);
    };
    aggiornaMemb();

    realtimeRef.current = supabase
      .channel(`crew_membro_${gruppo.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'crew_membri',
        filter: `gruppo_id=eq.${gruppo.id}`,
      }, aggiornaMemb)
      .subscribe();

    return () => {
      clearInterval(countdownRef.current!);
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, [gruppo, step]);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      sessionStorage.setItem('crew_codice_pendente', codice ?? '');
      navigate('/');
      return;
    }
    setUser(session.user);

    // Carica gruppo
    const { data: gr, error } = await supabase
      .from('crew_gruppi').select('*').eq('codice', codice).maybeSingle();

    if (error || !gr) { setErrore('Codice gruppo non valido o scaduto.'); setLoading(false); return; }
    if (gr.stato === 'scaduto') { setErrore('Questo gruppo è scaduto. Chiedi al capogruppo di crearne uno nuovo.'); setLoading(false); return; }
    if (gr.capogruppo_id === session.user.id) { setErrore('Sei il capogruppo di questo gruppo. Condividi il codice agli altri membri.'); setLoading(false); return; }
    setGruppo(gr);

    // Prezzo dal DB
    const servizioDb = SERVIZIO_PREZZI[gr.tipo];
    if (servizioDb) {
      const { data: prz } = await supabase
        .from('prezzi_servizi').select('prezzo_centesimi')
        .eq('servizio', servizioDb).maybeSingle();
      if (prz) setPrezzoSingolo(prz.prezzo_centesimi);
    }

    // Slot del gruppo (prenotati dal capogruppo) — la RLS permette la lettura a chiunque conosca il gruppo
    const { data: bookings } = await supabase
      .from('calendar_bookings')
      .select('calendar_slots ( id, data_ora, durata_minuti, note )')
      .eq('crew_gruppo_id', gr.id)
      .eq('stato', 'riservata');
    if (bookings) {
      setSlots(bookings.map(b => b.calendar_slots).filter(Boolean) as Slot[]);
    }

    // Conoscitiva del capogruppo (solo lettura)
    const { data: con } = await supabase
      .from('conoscitive').select('*, conoscitive_messaggi(*)')
      .eq('user_id', gr.capogruppo_id)
      .in('servizio_interessato', ['crew2', 'crew3', 'crew4']).maybeSingle();
    if (con) setConoscitiva(con);

    // Stato membro attuale
    const { data: membro } = await supabase
      .from('crew_membri').select('stato')
      .eq('gruppo_id', gr.id).eq('user_id', session.user.id).maybeSingle();
    if (membro) setMembroInfo(membro as MembroInfo);

    // Quanti hanno già pagato
    const { data: pagati } = await supabase
      .from('crew_membri').select('id')
      .eq('gruppo_id', gr.id).eq('stato', 'pagato');
    if (pagati) setMembriPagati(pagati.length);

    setLoading(false);
  }

  async function handleUnisciti() {
    if (!user || !gruppo) return;
    setProcessing(true);
    try {
      // Aggiunge il membro se non lo è già
      if (!membroInfo) {
        await supabase.from('crew_membri').insert({
          gruppo_id: gruppo.id, user_id: user.id, stato: 'in_attesa',
        });
      }

      // ── STRIPE PLACEHOLDER ──
      alert('⚠️ Stripe non ancora integrato. Simulazione pagamento completato.');

      // Segna come pagato
      await supabase.from('crew_membri')
        .update({ stato: 'pagato' })
        .eq('gruppo_id', gruppo.id).eq('user_id', user.id);

      // Inserisce il booking del membro come riservata
      for (const slot of slots) {
        await supabase.from('calendar_bookings').upsert({
          slot_id: slot.id, user_id: user.id, servizio: gruppo.tipo,
          stato: 'riservata', crew_gruppo_id: gruppo.id,
          reserved_until: new Date(gruppo.scade_il).toISOString(),
        }, { onConflict: 'slot_id,user_id' });
      }

      // Se il gruppo è completo, conferma tutti i booking
      await supabase.rpc('conferma_booking_gruppo', { p_gruppo_id: gruppo.id });

      await supabase.from('ordini').insert({
        user_id: user.id, servizio: SERVIZIO_PREZZI[gruppo.tipo] ?? gruppo.tipo,
        stato: 'pagato', slot_ids: slots.map(s => s.id),
        crew_gruppo_id: gruppo.id,
        importo_centesimi: Math.round(prezzoSingolo / TIPO_INFO[gruppo.tipo].membri) * slots.length,
      });

      setStep('successo');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert(`Errore: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: `2px solid rgba(0,206,209,0.15)`, borderTopColor: C.teal, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ─── Errore ───────────────────────────────────────────────────────────────

  if (errore) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: '1rem' }}>
          {errore.includes('capogruppo') ? '👥' : '⚠️'}
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 400, color: C.text1, margin: '0 0 12px', fontFamily: 'Georgia, serif' }}>
          {errore.includes('capogruppo') ? 'Sei già il capogruppo' : 'Gruppo non trovato'}
        </h2>
        <p style={{ fontSize: 14, color: C.text2, lineHeight: 1.7, margin: '0 0 1.5rem', fontFamily: 'system-ui' }}>{errore}</p>
        <button onClick={() => navigate('/dashboard')}
          style={{ padding: '10px 24px', background: C.cardBg, border: `1px solid ${C.teal}`, color: C.teal, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'system-ui' }}>
          Torna alla dashboard
        </button>
      </div>
    </div>
  );

  // ─── Successo ─────────────────────────────────────────────────────────────

  if (step === 'successo') return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <PageHeader navigate={navigate} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: C.priceBg, border: `2px solid ${C.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 2rem', color: C.teal }}>✓</div>
          <h2 style={{ fontSize: 22, fontWeight: 400, color: C.text1, margin: '0 0 0.75rem', fontFamily: 'Georgia, serif' }}>Sei nel gruppo!</h2>
          <p style={{ fontSize: 13, color: C.text2, fontFamily: 'system-ui', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Le sessioni sono confermate.
          </p>
          <div style={{ marginBottom: '1.25rem' }}>
            {slots.map(s => (
              <div key={s.id} style={{ fontSize: 13, color: C.text1, fontFamily: 'system-ui', padding: '8px 0', borderBottom: `1px solid ${C.cardBorder}`, textTransform: 'capitalize' }}>
                📅 {formatDataLunga(s.data_ora)} ore {formatOra(s.data_ora)}
              </div>
            ))}
          </div>
          <div style={{ padding: '10px 16px', background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 10, fontSize: 13, color: C.text2, fontFamily: 'system-ui', marginBottom: '1.5rem' }}>
            {TIPO_INFO[gruppo!.tipo].label} · {membriPagati + 1}/{TIPO_INFO[gruppo!.tipo].membri} membri
          </div>
          <button onClick={() => navigate('/dashboard')}
            style={{ width: '100%', padding: '13px', background: C.priceBg, border: `1px solid ${C.teal}`, color: C.teal, borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'system-ui' }}>
            Vai alla dashboard →
          </button>
        </div>
      </div>
    </div>
  );

  // ─── Vista principale ─────────────────────────────────────────────────────

  const infoTipo       = TIPO_INFO[gruppo!.tipo];
  const giaPagato      = membroInfo?.stato === 'pagato';
  const prezzoPerMembro = prezzoSingolo > 0 ? Math.round(prezzoSingolo / infoTipo.membri) : 0;
  const quotaPerMembro  = prezzoPerMembro * slots.length;
  const completo        = membriPagati >= infoTipo.membri;

  const fmtCountdown = (sec: number) => {
    if (sec <= 0) return '00:00';
    const m = Math.floor(sec / 60); const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui' }}>
      <PageHeader navigate={navigate} />

      <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const }}>

        {/* Header info gruppo */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
            {infoTipo.label}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 400, color: C.text1, margin: '0 0 12px', fontFamily: 'Georgia, serif' }}>
            Sei stato invitato in un gruppo
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
            {/* Badge membri */}
            <span style={{ padding: '4px 12px', borderRadius: 20, background: completo ? 'rgba(0,206,209,0.15)' : C.cardBg, border: `1px solid ${completo ? C.teal : C.cardBorder}`, color: completo ? C.teal : C.text2, fontSize: 12, fontWeight: completo ? 700 : 400 }}>
              👥 {membriPagati}/{infoTipo.membri} membri
            </span>
            {/* Countdown */}
            {!giaPagato && secondiRimasti !== null && (
              gruppoScaduto ? (
                <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 12 }}>
                  Scaduto
                </span>
              ) : (
                <span style={{ padding: '4px 12px', borderRadius: 20, background: (secondiRimasti < 120) ? 'rgba(245,166,35,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${(secondiRimasti < 120) ? 'rgba(245,166,35,0.4)' : 'rgba(255,255,255,0.1)'}`, color: (secondiRimasti < 120) ? C.amber : C.text2, fontSize: 12, fontFamily: 'system-ui', fontWeight: 600, letterSpacing: 1 }}>
                  ⏱ {fmtCountdown(secondiRimasti)}
                </span>
              )
            )}
          </div>

          {/* Pallini stato membri */}
          {!giaPagato && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {Array.from({ length: infoTipo.membri }).map((_, i) => (
                <div key={i} style={{ width: 24, height: 24, borderRadius: '50%', background: i < membriPagati ? C.teal : 'rgba(255,255,255,0.07)', border: `2px solid ${i < membriPagati ? C.teal : C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: C.bg, fontWeight: 700, transition: 'all 0.3s' }}>
                  {i < membriPagati ? '✓' : ''}
                </div>
              ))}
              <span style={{ fontSize: 11, color: C.text3, fontFamily: 'system-ui', marginLeft: 4 }}>
                {completo ? 'Gruppo completo!' : `${infoTipo.membri - membriPagati} in attesa`}
              </span>
            </div>
          )}
        </div>

        {/* Gruppo scaduto e non completo */}
        {gruppoScaduto && !completo && !giaPagato ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: 48, marginBottom: '1rem' }}>⏰</div>
            <h2 style={{ fontSize: 20, fontWeight: 400, color: C.text1, margin: '0 0 0.75rem', fontFamily: 'Georgia, serif' }}>
              Il gruppo non si è formato
            </h2>
            <p style={{ fontSize: 13, color: C.text2, fontFamily: 'system-ui', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Il tempo è scaduto con soli <strong style={{ color: C.teal }}>{membriPagati}/{infoTipo.membri}</strong> membri.
              Chiedi al capogruppo di creare un nuovo gruppo e condividere un nuovo codice.
            </p>
            <button onClick={() => navigate('/dashboard')}
              style={{ padding: '10px 28px', background: C.cardBg, border: `1px solid ${C.cardBorder}`, color: C.text2, borderRadius: 10, fontWeight: 500, fontSize: 13, cursor: 'pointer', fontFamily: 'system-ui' }}>
              Torna alla dashboard
            </button>
          </div>
        ) : (
          <>

        {/* Conoscitiva capogruppo — solo lettura */}
        {conoscitiva && (() => {
          const risposte = conoscitiva.conoscitive_messaggi?.filter(m => m.autore === 'admin') ?? [];
          if (risposte.length === 0) return null;
          return (
            <div style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Conoscitiva del gruppo</div>
              <div style={{ fontSize: 12, color: C.text3, marginBottom: 10 }}>La risposta del docente al capogruppo</div>
              {risposte.map(r => (
                <div key={r.id}>
                  {r.testo && <p style={{ fontSize: 13, color: C.text1, lineHeight: 1.7, margin: '0 0 8px' }}>{r.testo}</p>}
                  {r.media_url && (
                    <a href={r.media_url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: 'rgba(0,206,209,0.08)', border: `1px solid ${C.cardBorder}`, color: C.teal, borderRadius: 7, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>
                      🎬 Guarda la risposta del docente
                    </a>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {/* Sessioni del gruppo */}
        <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.text1, margin: '0 0 1rem' }}>Sessioni del gruppo</h3>
          {slots.length === 0 ? (
            <div style={{ color: C.text3, fontSize: 13 }}>Nessuna sessione selezionata dal capogruppo.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slots.map(slot => (
                <div key={slot.id} style={{ padding: '12px 14px', borderRadius: 10, background: C.priceBg, border: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.cardBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>📅</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text1, textTransform: 'capitalize' }}>{formatDataLunga(slot.data_ora)}</div>
                    <div style={{ fontSize: 11, color: C.text2, marginTop: 2 }}>ore {formatOra(slot.data_ora)} · {slot.durata_minuti} min{slot.note ? ` · ${slot.note}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA */}
        {giaPagato ? (
          <div style={{ padding: '16px 20px', background: C.priceBg, borderRadius: 12, border: `1px solid ${C.teal}`, display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 22 }}>✅</div>
            <div>
              <div style={{ fontWeight: 700, color: C.teal, fontSize: 14, marginBottom: 2 }}>Sei già nel gruppo!</div>
              <div style={{ fontSize: 12, color: C.text2 }}>Il tuo pagamento è confermato.</div>
            </div>
            <button onClick={() => navigate('/dashboard')}
              style={{ marginLeft: 'auto', padding: '8px 16px', background: C.priceBg, border: `1px solid ${C.teal}`, color: C.teal, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Dashboard →
            </button>
          </div>
        ) : gruppoScaduto ? null : (
          <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.text1 }}>Quota di partecipazione</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>
                {slots.length > 0 && quotaPerMembro > 0
                  ? formatEuro(quotaPerMembro)
                  : prezzoPerMembro > 0
                    ? `${formatEuro(prezzoPerMembro)} / sessione`
                    : '— (da definire)'}
              </span>
            </div>
            {slots.length > 0 && prezzoPerMembro > 0 && (
              <div style={{ fontSize: 11, color: C.text3, marginBottom: '1rem' }}>
                {formatEuro(prezzoPerMembro)} × {slots.length} sessione{slots.length > 1 ? 'i' : ''}
                {' '}({formatEuro(prezzoSingolo)} totale ÷ {infoTipo.membri} partecipanti)
              </div>
            )}
            {slots.length === 0 && prezzoPerMembro > 0 && (
              <div style={{ fontSize: 11, color: C.text3, marginBottom: '1rem' }}>
                In attesa che il capogruppo confermi le sessioni
              </div>
            )}
            {prezzoPerMembro === 0 && (
              <div style={{ fontSize: 11, color: C.text3, marginBottom: '1rem' }}>Il prezzo sarà definito con l'integrazione Stripe</div>
            )}
            <button onClick={handleUnisciti} disabled={processing || slots.length === 0}
              style={{ width: '100%', padding: '13px', background: processing ? C.cardBg : 'rgba(0,206,209,0.1)', border: `1px solid ${processing ? C.cardBorder : C.teal}`, color: processing ? C.text3 : C.teal, borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: processing || slots.length === 0 ? 'not-allowed' : 'pointer', transition: 'all 0.12s' }}>
              {processing ? 'Elaborazione...' : '🔒 Unisciti al gruppo'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 11, color: C.text3, margin: '8px 0 0' }}>
              Pagamento sicuro · Ogni membro paga per sé
            </p>
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

function PageHeader({ navigate }: { navigate: (p: string) => void }) {
  return (
    <header style={{ background: 'rgba(6,8,13,0.96)', backdropFilter: 'blur(12px)', borderBottom: `1px solid rgba(255,255,255,0.07)`, padding: '0 2rem', height: 68, display: 'flex', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 24px rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'rgba(180,205,225,0.35)', cursor: 'pointer', fontSize: 13, fontFamily: 'system-ui', padding: 0 }}>← Dashboard</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div style={{ height: '1.5px', width: 110, background: 'linear-gradient(90deg, transparent, #4a90d9 40%, #4a90d9 60%, transparent)' }} />
          <span style={{ fontFamily: 'Georgia, serif', fontSize: '1.3rem', fontWeight: 400, letterSpacing: 5, color: '#f5bc76' }}>MatHeight</span>
          <div style={{ height: '1.5px', width: 110, background: 'linear-gradient(90deg, transparent, #8B0000 40%, #8B0000 60%, transparent)' }} />
        </div>
      </div>
    </header>
  );
}