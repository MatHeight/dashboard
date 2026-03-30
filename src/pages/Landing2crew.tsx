import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import ConoscitivaForm from './ConoscitivaForm';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

type TipoCrew = 'crew2' | 'crew3' | 'crew4';

interface Slot {
  id: string;
  data_ora: string;
  durata_minuti: number;
  posti_max: number;
  posti_occupati: number;
  stato: string;
  note: string | null;
  minuti_riserva: number;
}

interface Conoscitiva {
  id: string;
  modalita: 'sincrona' | 'asincrona';
  stato: string;
  created_at?: string;
  difficolta_percepita?: string;
  aspettative?: string;
  conoscitive_messaggi?: {
    id: string; autore: string;
    testo: string | null; media_url: string | null; created_at: string;
  }[];
}

interface PacchettoInfo {
  tipo: TipoCrew;
  membri: number;
  label: string;
  emoji: string;
  // prezzi dal DB
  prezzoSingolo: number;   // centesimi per 1 lezione (per membro)
  prezzoPack4: number;     // centesimi per 4 lezioni (per membro)
  servizioSingolo: string; // id in prezzi_servizi
  servizioPack4: string;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const PACCHETTI_BASE: { tipo: TipoCrew; membri: number; label: string; emoji: string; servizioSingolo: string; servizioPack4: string }[] = [
  { tipo: 'crew2', membri: 2, label: 'Crew 2', emoji: '👥',   servizioSingolo: 'streamathcrew_2', servizioPack4: 'streamathcrew_2_pack' },
  { tipo: 'crew3', membri: 3, label: 'Crew 3', emoji: '👥👤', servizioSingolo: 'streamathcrew_3', servizioPack4: 'streamathcrew_3_pack' },
  { tipo: 'crew4', membri: 4, label: 'Crew 4', emoji: '👥👥', servizioSingolo: 'streamathcrew_4', servizioPack4: 'streamathcrew_4_pack' },
];

const GIORNI_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
               'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// Validità del codice per i membri: 7 giorni dalla creazione del gruppo
const GIORNI_VALIDITA_CODICE = 7;

// ─── Palette ─────────────────────────────────────────────────────────────────

const C = {
  bg:          '#06080d',
  cardBg:      'rgba(0,206,209,0.07)',
  cardBorder:  'rgba(0,206,209,0.22)',
  priceBg:     'rgba(0,206,209,0.14)',
  priceBorder: '#00ced1',
  teal:        '#00ced1',
  slate:       '#4a90d9',
  gold:        '#f5bc76',
  amber:       '#f5a623',
  text1:       '#deeaf5',
  text2:       'rgba(180,205,225,0.65)',
  text3:       'rgba(180,205,225,0.35)',
  inpBg:       'rgba(0,206,209,0.05)',
  inpBorder:   'rgba(0,206,209,0.22)',
  disabledBg:  'rgba(255,255,255,0.04)',
  disabledBdr: 'rgba(255,255,255,0.09)',
};

// ─── Utils ────────────────────────────────────────────────────────────────────

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDow(y: number, m: number) { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; }
function isSameDay(iso: string, y: number, m: number, d: number) {
  const dt = new Date(iso);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
}
function formatOra(iso: string) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}
function formatDataBreve(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}
function formatDataLunga(iso: string) {
  return new Date(iso).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatEuro(centesimi: number) {
  if (centesimi === 0) return 'Da definire';
  return `€${(centesimi / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Landing2Crew() {
  const navigate = useNavigate();
  const now = new Date();

  const [user, setUser]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Pacchetti con prezzi dal DB
  const [pacchetti, setPacchetti] = useState<PacchettoInfo[]>([]);

  // Selezione
  const [tipoCrew, setTipoCrew]   = useState<TipoCrew | null>(null);
  const [usaPack4, setUsaPack4]   = useState(false); // false = singola, true = 4 lezioni

  // Conoscitiva
  const [conoscitiva, setConoscitiva]         = useState<Conoscitiva | null>(null);
  const [conoscitivaFatta, setConoscitivaFatta] = useState(false);

  // Calendario
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDay, setSelectedDay]     = useState<number | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
  const [calEspanso, setCalEspanso]       = useState(false);

  // Step
  const [step, setStep] = useState<'pacchetto' | 'calendario' | 'codice' | 'successo'>('pacchetto');
  const [processing, setProcessing] = useState(false);

  // Pannello conoscitiva (bottone a scomparsa — solo step pacchetto)
  const [pannelloConoscitive, setPannelloConoscitive] = useState(false);
  const [conoscitivaAperta, setConoscitivaAperta] = useState<string | null>(null);
  const [messaggiConoscitiva, setMessaggiConoscitiva] = useState<Record<string, any[]>>({});

  async function apriConoscitiva(id: string) {
    if (conoscitivaAperta === id) { setConoscitivaAperta(null); return; }
    setConoscitivaAperta(id);
    if (!messaggiConoscitiva[id]) {
      const { data } = await supabase
        .from('conoscitive_messaggi').select('*')
        .eq('conoscitiva_id', id).order('created_at', { ascending: true });
      if (data) setMessaggiConoscitiva(prev => ({ ...prev, [id]: data }));
    }
  }

  // Gruppo creato
  const [codiceCrew, setCodiceCrew]           = useState<string | null>(null);
  const [gruppoId, setGruppoId]               = useState<string | null>(null);
  const [scadenzaCodice, setScadenzaCodice]   = useState<Date | null>(null);
  const [membriPagati, setMembriPagati]       = useState(0);
  const [secondiRimasti, setSecondiRimasti]   = useState<number | null>(null);
  const [gruppoScaduto, setGruppoScaduto]     = useState(false);
  const countdownRef2 = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef   = useRef<any>(null);

  // Avvia countdown e realtime quando si arriva allo step codice
  useEffect(() => {
    if (step !== 'codice' || !gruppoId || !scadenzaCodice) return;

    // Countdown
    const tick = () => {
      const secondi = Math.max(0, Math.round((scadenzaCodice.getTime() - Date.now()) / 1000));
      setSecondiRimasti(secondi);
      if (secondi === 0) {
        clearInterval(countdownRef2.current!);
        supabase.rpc('scadi_riserve_scadute');
        setGruppoScaduto(true);
      }
    };
    tick();
    countdownRef2.current = setInterval(tick, 1000);

    // Realtime: ascolta i cambiamenti su crew_membri per questo gruppo
    realtimeRef.current = supabase
      .channel(`crew_gruppo_${gruppoId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'crew_membri',
        filter: `gruppo_id=eq.${gruppoId}`,
      }, async () => {
        const { data } = await supabase
          .from('crew_membri').select('id')
          .eq('gruppo_id', gruppoId).eq('stato', 'pagato');
        if (data) setMembriPagati(data.length);
      })
      .subscribe();

    // Carica conteggio iniziale
    supabase.from('crew_membri').select('id')
      .eq('gruppo_id', gruppoId).eq('stato', 'pagato')
      .then(({ data }) => { if (data) setMembriPagati(data.length); });

    return () => {
      clearInterval(countdownRef2.current!);
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, [step, gruppoId, scadenzaCodice]);

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => { init(); }, []);

  const loadSlots = useCallback(async () => {
    const from = new Date(year, month - 1, 1).toISOString();
    const to   = new Date(year, month + 2, 0).toISOString();
    const { data } = await supabase
      .from('calendar_slots')
      .select('*')
      .eq('servizio', 'streamath')
      .neq('stato', 'annullato')
      .gte('data_ora', new Date().toISOString())
      .gte('data_ora', from)
      .lte('data_ora', to)
      .order('data_ora');
    if (data) setSlots(data);
  }, [year, month]);

  useEffect(() => {
    if (step === 'calendario') loadSlots();
  }, [step, loadSlots]);

  async function init() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUser(session.user);

      // Prezzi dal DB
      const { data: prezziData } = await supabase
        .from('prezzi_servizi')
        .select('servizio, prezzo_centesimi')
        .in('servizio', [
          'streamathcrew_2', 'streamathcrew_2_pack',
          'streamathcrew_3', 'streamathcrew_3_pack',
          'streamathcrew_4', 'streamathcrew_4_pack',
        ])
        .eq('attivo', true);

      const mappa: Record<string, number> = {};
      if (prezziData) prezziData.forEach(p => { mappa[p.servizio] = p.prezzo_centesimi; });

      setPacchetti(PACCHETTI_BASE.map(p => ({
        ...p,
        prezzoSingolo: mappa[p.servizioSingolo] ?? 0,
        prezzoPack4:   mappa[p.servizioPack4]   ?? 0,
      })));

      // Conoscitiva — query separata dai messaggi
      const { data: cons, error: errCon } = await supabase
        .from('conoscitive')
        .select('id, modalita, stato, created_at, difficolta_percepita, aspettative')
        .eq('user_id', session.user.id)
        .in('servizio_interessato', ['crew2', 'crew3', 'crew4'])
        .order('created_at', { ascending: false })
        .limit(1);

      if (errCon) console.error('Errore query conoscitiva:', errCon);

      const conBase = cons?.[0] ?? null;
      if (conBase) {
        const { data: msgs } = await supabase
          .from('conoscitive_messaggi').select('*')
          .eq('conoscitiva_id', conBase.id)
          .order('created_at', { ascending: true });
        setConoscitiva({ ...conBase, conoscitive_messaggi: msgs ?? [] });
        setConoscitivaFatta(true);
      } else {
        setConoscitivaFatta(false);
      }
    } catch (err) {
      console.error('Errore init Landing2crew:', err);
      // In caso di errore non bloccare l'utente — se ha già la conoscitiva lasciala com'è
    } finally {
      setLoading(false);
    }
  }

  // ─── Calendario helpers ───────────────────────────────────────────────────

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
    setSelectedDay(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
    setSelectedDay(null);
  }
  function getSlotsPerDay(day: number) { return slots.filter(s => isSameDay(s.data_ora, year, month, day)); }
  const slotsDelGiorno = selectedDay !== null ? getSlotsPerDay(selectedDay) : [];
  function toggleSlot(slot: Slot) {
    if (slot.posti_occupati >= slot.posti_max) return;
    const giàSelezionato = selectedSlots.find(s => s.id === slot.id);
    if (giàSelezionato) {
      setSelectedSlots(prev => prev.filter(s => s.id !== slot.id));
    } else {
      const limite = usaPack4 ? 4 : 1;
      if (selectedSlots.length >= limite) return;
      setSelectedSlots(prev => [...prev, slot]);
    }
  }

  // ─── Pacchetto corrente ───────────────────────────────────────────────────

  const pacchettoCorrente = pacchetti.find(p => p.tipo === tipoCrew) ?? null;
  // Prezzo per membro = prezzo totale / numero membri
  const prezzoPerMembro = pacchettoCorrente
    ? (usaPack4
        ? Math.round(pacchettoCorrente.prezzoPack4 / pacchettoCorrente.membri)
        : Math.round(pacchettoCorrente.prezzoSingolo / pacchettoCorrente.membri) * selectedSlots.length)
    : 0;
  const servizioOrdine = pacchettoCorrente
    ? (usaPack4 ? pacchettoCorrente.servizioPack4 : pacchettoCorrente.servizioSingolo)
    : '';

  // ─── Crea gruppo ──────────────────────────────────────────────────────────

  async function handleConfermaSlots() {
    if (selectedSlots.length === 0 || !tipoCrew || !user || !pacchettoCorrente) return;
    setProcessing(true);
    try {
      const { data: codiceData } = await supabase.rpc('genera_codice_crew');
      const codice = codiceData as string;

      // Scadenza degli slot riservati e del codice: minuti_riserva dal DB
      const minutiRiserva = Math.max(...selectedSlots.map(s => s.minuti_riserva ?? 30));
      const reservedUntil = new Date();
      reservedUntil.setMinutes(reservedUntil.getMinutes() + minutiRiserva);

      // La scadenza del codice per i membri è la stessa: minuti_riserva dallo slot
      const scadCodice = new Date(reservedUntil);

      const membriAttesi = pacchettoCorrente.membri;

      const { data: gruppo, error } = await supabase
        .from('crew_gruppi')
        .insert({
          codice,
          capogruppo_id: user.id,
          tipo: tipoCrew,
          membri_attesi: membriAttesi,
          stato: 'aperto',
          scade_il: scadCodice.toISOString(), // scadenza codice, non degli slot
        })
        .select('id, codice')
        .single();
      if (error) throw error;

      // Aggiungi capogruppo come primo membro
      await supabase.from('crew_membri').insert({
        gruppo_id: gruppo.id, user_id: user.id, stato: 'in_attesa',
      });

      // Riserva gli slot (scadenza separata: minuti_riserva dello slot)
      for (const slot of selectedSlots) {
        await supabase.from('calendar_bookings').insert({
          slot_id: slot.id, user_id: user.id, servizio: tipoCrew,
          stato: 'riservata', reserved_until: reservedUntil.toISOString(),
          crew_gruppo_id: gruppo.id,
        });
      }

      setGruppoId(gruppo.id);
      setCodiceCrew(codice);
      setScadenzaCodice(scadCodice);
      setStep('codice');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert(`Errore: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }

  // ─── Pagamento capogruppo ─────────────────────────────────────────────────

  async function handlePagamento() {
    if (!gruppoId || !user || !tipoCrew) return;
    setProcessing(true);
    try {
      // ── STRIPE PLACEHOLDER ──
      alert('⚠️ Stripe non ancora integrato. Simulazione pagamento completato.');

      await supabase.from('crew_membri')
        .update({ stato: 'pagato' })
        .eq('gruppo_id', gruppoId).eq('user_id', user.id);

      await supabase.from('ordini').insert({
        user_id: user.id, servizio: servizioOrdine,
        stato: 'pagato', slot_ids: selectedSlots.map(s => s.id),
        crew_gruppo_id: gruppoId, importo_centesimi: prezzoPerMembro,
      });

      setStep('successo');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert(`Errore: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  }

  // ─── Griglia mese ─────────────────────────────────────────────────────────

  const daysInMonth   = getDaysInMonth(year, month);
  const firstDow      = getFirstDow(year, month);
  const today         = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const cellH         = calEspanso ? 38 : 24;

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const navBtn: React.CSSProperties = {
    width: 22, height: 22, borderRadius: '50%', border: `1px solid ${C.cardBorder}`,
    background: 'transparent', color: C.text1, cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  // ─── Loading ──────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 36, height: 36, border: `2px solid rgba(0,206,209,0.15)`, borderTopColor: C.teal, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ─── Gate: conoscitiva obbligatoria ──────────────────────────────────────

  if (!conoscitivaFatta) return (
    <ConoscitivaForm
      servizio="crew2"
      onComplete={() => { setConoscitivaFatta(true); init(); }}
    />
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCCESSO
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 'successo') return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <PageHeader navigate={navigate} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: C.priceBg, border: `2px solid ${C.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 2rem', color: C.teal }}>✓</div>
          <h2 style={{ fontSize: 22, fontWeight: 400, color: C.text1, margin: '0 0 0.75rem', fontFamily: 'Georgia, serif' }}>Gruppo creato!</h2>
          <p style={{ fontSize: 13, color: C.text2, fontFamily: 'system-ui', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            Condividi il codice agli altri {pacchettoCorrente!.membri - 1} membri — ognuno pagherà per sé.
          </p>
          <div style={{ padding: '20px', background: C.cardBg, borderRadius: 14, border: `2px dashed ${C.cardBorder}`, marginBottom: '1.5rem' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, fontFamily: 'system-ui' }}>Codice gruppo</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: C.teal, letterSpacing: '0.12em', fontFamily: 'system-ui' }}>{codiceCrew}</div>
            {scadenzaCodice && (
              <div style={{ fontSize: 12, color: C.text3, marginTop: 6, fontFamily: 'system-ui' }}>
                I membri hanno tempo fino alle {scadenzaCodice.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} del {scadenzaCodice.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} per unirsi
              </div>
            )}
          </div>
          <Btn onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/streamath/crew/${codiceCrew}`); alert('Link copiato!'); }}>
            📋 Copia link per i membri
          </Btn>
          <div style={{ marginTop: 10 }}>
            <button onClick={() => navigate('/dashboard')}
              style={{ width: '100%', padding: '13px', background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.text2, borderRadius: 10, fontWeight: 500, fontSize: 14, cursor: 'pointer', fontFamily: 'system-ui' }}>
              Torna alla dashboard →
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CODICE + PAGAMENTO CAPOGRUPPO
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 'codice') {
    const totMemb  = pacchettoCorrente!.membri;
    const completo = membriPagati >= totMemb;

    // Formato countdown
    const fmtCountdown = (sec: number) => {
      if (sec <= 0) return '00:00';
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <PageHeader navigate={navigate} />
      <div style={{ flex: 1, padding: '2rem 1rem', maxWidth: 560, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const }}>

        {/* Se il gruppo è scaduto e non è completo */}
        {gruppoScaduto && !completo ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
            <div style={{ fontSize: 48, marginBottom: '1rem' }}>⏰</div>
            <h2 style={{ fontSize: 20, fontWeight: 400, color: C.text1, margin: '0 0 0.75rem', fontFamily: 'Georgia, serif' }}>
              Il gruppo non si è formato
            </h2>
            <p style={{ fontSize: 13, color: C.text2, fontFamily: 'system-ui', lineHeight: 1.7, marginBottom: '0.5rem' }}>
              Il tempo è scaduto con soli <strong style={{ color: C.teal }}>{membriPagati}/{totMemb}</strong> membri.
            </p>
            <p style={{ fontSize: 13, color: C.text2, fontFamily: 'system-ui', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              Se vuoi procedere, ricrea il gruppo scegliendo le date e condividi il nuovo codice ai tuoi compagni.
            </p>
            <Btn onClick={() => { setStep('pacchetto'); setSelectedSlots([]); setGruppoScaduto(false); setMembriPagati(0); setSecondiRimasti(null); }}>
              Ricomincia la selezione →
            </Btn>
          </div>
        ) : (
          <>
            {/* Countdown */}
            {secondiRimasti !== null && !completo && (
              <div style={{ marginBottom: '1rem', padding: '10px 16px', borderRadius: 10, background: (secondiRimasti ?? 0) < 120 ? 'rgba(245,166,35,0.1)' : C.cardBg, border: `1px solid ${(secondiRimasti ?? 0) < 120 ? 'rgba(245,166,35,0.4)' : C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: C.text2, fontFamily: 'system-ui' }}>⏱ Tempo per i membri per unirsi</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: (secondiRimasti ?? 0) < 120 ? C.amber : C.teal, fontFamily: 'system-ui', letterSpacing: 2 }}>
                  {fmtCountdown(secondiRimasti ?? 0)}
                </span>
              </div>
            )}

            {/* Stato membri — aggiornamento realtime */}
            <div style={{ marginBottom: '1rem', padding: '12px 16px', borderRadius: 10, background: completo ? 'rgba(0,206,209,0.1)' : C.cardBg, border: `1px solid ${completo ? C.teal : C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: completo ? C.teal : C.text1, fontFamily: 'system-ui' }}>
                  {completo ? '✅ Gruppo completo!' : '👥 Membri nel gruppo'}
                </div>
                <div style={{ fontSize: 11, color: C.text3, fontFamily: 'system-ui', marginTop: 2 }}>
                  {completo ? 'Tutti i membri hanno pagato' : 'In attesa degli altri membri...'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {Array.from({ length: totMemb }).map((_, i) => (
                  <div key={i} style={{ width: 28, height: 28, borderRadius: '50%', background: i < membriPagati ? C.teal : 'rgba(255,255,255,0.08)', border: `2px solid ${i < membriPagati ? C.teal : C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, transition: 'all 0.3s' }}>
                    {i < membriPagati ? '✓' : ''}
                  </div>
                ))}
              </div>
            </div>

            {/* Codice */}
            <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 14, padding: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.text1, margin: '0 0 6px', fontFamily: 'system-ui' }}>Il tuo codice gruppo</h3>
              <p style={{ fontSize: 13, color: C.text2, margin: '0 0 1.25rem', fontFamily: 'system-ui' }}>
                Condividilo agli altri {totMemb - 1} membri — ognuno si unisce e paga per sé
              </p>
              <div style={{ padding: '20px', background: C.priceBg, borderRadius: 12, border: `2px dashed ${C.teal}`, marginBottom: '1.25rem' }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: C.teal, letterSpacing: '0.12em', fontFamily: 'system-ui' }}>{codiceCrew}</div>
                {scadenzaCodice && (
                  <div style={{ fontSize: 12, color: C.text3, marginTop: 6, fontFamily: 'system-ui' }}>
                    I membri hanno tempo fino alle {scadenzaCodice.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} del {scadenzaCodice.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })} per unirsi
                  </div>
                )}
              </div>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/streamath/crew/${codiceCrew}`); alert('Link copiato!'); }}
                style={{ width: '100%', padding: '10px', background: 'rgba(0,206,209,0.08)', color: C.teal, border: `1px solid ${C.cardBorder}`, borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'system-ui' }}>
                📋 Copia link per i membri
              </button>
            </div>

            {/* Riepilogo sessioni */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'system-ui', fontWeight: 700 }}>
                Sessioni selezionate ({selectedSlots.length})
              </div>
              {selectedSlots.map(slot => (
                <div key={slot.id} style={{ padding: '7px 0', borderBottom: `1px solid rgba(255,255,255,0.05)`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, color: C.text1, fontFamily: 'system-ui', textTransform: 'capitalize' }}>{formatDataLunga(slot.data_ora)}</div>
                    <div style={{ fontSize: 11, color: C.text2, marginTop: 2, fontFamily: 'system-ui' }}>ore {formatOra(slot.data_ora)} · {slot.durata_minuti} min</div>
                  </div>
                  {!usaPack4 && pacchettoCorrente && (
                    <div style={{ fontSize: 12, color: C.text2, fontFamily: 'system-ui' }}>
                      {formatEuro(Math.round(pacchettoCorrente.prezzoSingolo / pacchettoCorrente.membri))}
                    </div>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.text1, fontFamily: 'system-ui' }}>La tua quota</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.teal, fontFamily: 'system-ui' }}>
                  {prezzoPerMembro > 0 ? formatEuro(prezzoPerMembro) : '— (da definire)'}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.text3, marginTop: 4, fontFamily: 'system-ui' }}>
                {totMemb} persone · ogni membro paga per sé
              </div>
            </div>

            <Btn onClick={handlePagamento} disabled={processing}>
              {processing ? 'Elaborazione...' : '🔒 Paga la tua quota'}
            </Btn>
            <p style={{ textAlign: 'center', fontSize: 12, color: C.text3, marginTop: 10, fontFamily: 'system-ui' }}>
              Gli altri {totMemb - 1} membri pagheranno separatamente usando il codice gruppo
            </p>
          </>
        )}
      </div>
    </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDARIO
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 'calendario' && tipoCrew && pacchettoCorrente) return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui' }}>
      <PageHeader navigate={navigate} />
      <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: 1080, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: '1.25rem', padding: '10px 16px', borderRadius: 10, background: C.cardBg, border: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.teal }}>
              StreaMathCrew — {pacchettoCorrente.label}
            </span>
            <span style={{ fontSize: 11, color: C.text3, marginLeft: 10 }}>
              {usaPack4
                ? `Pack 4 lezioni · ${formatEuro(Math.round(pacchettoCorrente.prezzoPack4 / 4 / pacchettoCorrente.membri))} a lezione per partecipante`
                : `${formatEuro(Math.round(pacchettoCorrente.prezzoSingolo / pacchettoCorrente.membri))} per partecipante a sessione`}
            </span>
          </div>
          <button onClick={() => { setStep('pacchetto'); setSelectedSlots([]); }}
            style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: 11 }}>
            ← cambia pacchetto
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '1.5rem', alignItems: 'start' }}>

          {/* ── Calendario ── */}
          <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 14, overflow: 'hidden' }}>

            <div style={{ padding: '0.6rem 0.9rem', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 13, color: C.text1 }}>
                Sessioni crew
                {selectedSlots.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 10, padding: '1px 7px', borderRadius: 20, background: C.priceBg, border: `1px solid ${C.teal}`, color: C.teal, fontFamily: 'system-ui' }}>
                    {selectedSlots.length}
                  </span>
                )}
              </span>
              <button onClick={() => setCalEspanso(e => !e)}
                style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.text3, padding: '2px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 10 }}>
                {calEspanso ? 'Riduci' : 'Espandi'}
              </button>
            </div>

            <div style={{ padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid rgba(0,206,209,0.1)` }}>
              <button onClick={prevMonth} style={navBtn}>‹</button>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: C.text1, fontFamily: 'Georgia, serif' }}>{MESI[month]}</span>
                <span style={{ fontSize: 10, color: C.text3, marginLeft: 4 }}>{year}</span>
              </div>
              <button onClick={nextMonth} style={navBtn}>›</button>
            </div>

            <div style={{ padding: '0.5rem 0.6rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 3 }}>
                {GIORNI_SHORT.map(g => (
                  <div key={g} style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '2px 0' }}>{g}</div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {cells.map((day, idx) => {
                  if (day === null) return <div key={`e${idx}`} style={{ minHeight: cellH }} />;
                  const daySlots = getSlotsPerDay(day);
                  const isToday  = isCurrentMonth && today.getDate() === day;
                  const isSel    = selectedDay === day;
                  const isPast   = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const hasSlots = daySlots.length > 0 && !isPast;
                  const selCount = selectedSlots.filter(s => isSameDay(s.data_ora, year, month, day)).length;
                  return (
                    <div key={day} onClick={() => hasSlots && setSelectedDay(prev => prev === day ? null : day)}
                      style={{ minHeight: cellH, borderRadius: 5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: hasSlots ? 'pointer' : 'default', background: isSel ? C.priceBg : hasSlots ? 'rgba(0,206,209,0.04)' : 'transparent', border: isSel ? `2px solid ${C.teal}` : isToday ? `2px solid ${C.slate}` : hasSlots ? `1px solid ${C.cardBorder}` : '1px solid transparent', position: 'relative', transition: 'all 0.1s' }}>
                      <span style={{ fontSize: 10, fontWeight: hasSlots ? 600 : 400, color: isPast ? C.text3 : isSel ? C.teal : C.text1 }}>{day}</span>
                      {hasSlots && (
                        <div style={{ display: 'flex', gap: 1, marginTop: 1 }}>
                          {daySlots.slice(0, calEspanso ? 3 : 1).map(s => (
                            <div key={s.id} style={{ width: 3, height: 3, borderRadius: '50%', background: selectedSlots.find(ss => ss.id === s.id) ? C.teal : 'rgba(0,206,209,0.45)' }} />
                          ))}
                        </div>
                      )}
                      {selCount > 0 && (
                        <div style={{ position: 'absolute', top: 1, right: 1, width: 11, height: 11, borderRadius: '50%', background: C.teal, color: C.bg, fontSize: 7, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{selCount}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Slot del giorno */}
            {selectedDay !== null && (
              <div style={{ borderTop: `1px solid ${C.cardBorder}`, padding: '0.7rem 0.9rem' }}>
                <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 700 }}>
                  {MESI[month]} {selectedDay}
                </div>
                {slotsDelGiorno.length === 0 ? (
                  <div style={{ fontSize: 12, color: C.text3, textAlign: 'center', padding: '0.75rem 0' }}>Nessuno slot.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {slotsDelGiorno.map(slot => {
                      const isSel2 = !!selectedSlots.find(s => s.id === slot.id);
                      const pieno  = slot.posti_occupati >= slot.posti_max;
                      const limite = usaPack4 ? 4 : 1;
                      const limiteRaggiunto = !isSel2 && selectedSlots.length >= limite;
                      const nonDisp = pieno || limiteRaggiunto;
                      return (
                        <div key={slot.id} onClick={() => !nonDisp && toggleSlot(slot)}
                          style={{ padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${isSel2 ? C.teal : nonDisp ? 'rgba(255,255,255,0.06)' : C.cardBorder}`, background: isSel2 ? C.priceBg : nonDisp ? C.disabledBg : C.inpBg, cursor: nonDisp ? 'not-allowed' : 'pointer', opacity: nonDisp && !isSel2 ? 0.4 : 1, transition: 'all 0.12s' }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${isSel2 ? C.teal : C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {isSel2 && <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.teal }} />}
                          </div>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: isSel2 ? C.teal : C.text1 }}>{formatOra(slot.data_ora)}</span>
                            <span style={{ fontSize: 10, color: C.text2, marginLeft: 6 }}>{slot.durata_minuti} min{slot.note ? ` · ${slot.note}` : ''}</span>
                          </div>
                          <span style={{ fontSize: 10, color: C.text3 }}>
                            {pieno ? 'Pieno' : limiteRaggiunto ? '—' : `${slot.posti_max - slot.posti_occupati} posto${slot.posti_max - slot.posti_occupati > 1 ? 'i' : ''}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* CTA calendario */}
            <div style={{ padding: '0.7rem 0.9rem', borderTop: `1px solid ${C.cardBorder}` }}>
              {(() => {
                const limite = usaPack4 ? 4 : 1;
                const pronto = selectedSlots.length === limite;
                if (pronto) return (
                  <Btn onClick={handleConfermaSlots} disabled={processing}>
                    {processing ? '...' : `Crea gruppo con ${selectedSlots.length} sessione${selectedSlots.length > 1 ? 'i' : ''} →`}
                  </Btn>
                );
                if (selectedSlots.length === 0) return (
                  <p style={{ fontSize: 11, color: C.text3, textAlign: 'center', margin: 0, padding: '4px 0' }}>
                    Clicca un giorno per vedere gli slot disponibili
                  </p>
                );
                if (usaPack4) return (
                  <p style={{ fontSize: 11, color: C.amber, textAlign: 'center', margin: 0, padding: '4px 0' }}>
                    Seleziona ancora {4 - selectedSlots.length} sessione{4 - selectedSlots.length > 1 ? 'i' : ''} per completare il pack
                  </p>
                );
                return null;
              })()}
            </div>

            {slots.length === 0 && (
              <div style={{ padding: '1.25rem', textAlign: 'center', color: C.text3, fontSize: 12 }}>Nessuno slot disponibile.</div>
            )}
          </div>

          {/* ── Colonna destra ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

            {/* Sessioni selezionate */}
            {selectedSlots.length > 0 && (
              <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 12, padding: '1rem' }}>
                <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 700, fontFamily: 'system-ui' }}>Sessioni selezionate</div>
                {selectedSlots.map((s, i) => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < selectedSlots.length - 1 ? `1px solid rgba(255,255,255,0.05)` : 'none' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.cardBg, border: `1px solid ${C.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.teal, flexShrink: 0 }}>{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.text1, fontFamily: 'system-ui' }}>{formatDataBreve(s.data_ora)}</div>
                      <div style={{ fontSize: 10, color: C.text2, fontFamily: 'system-ui' }}>ore {formatOra(s.data_ora)} · {s.durata_minuti} min</div>
                    </div>
                    <button onClick={() => setSelectedSlots(prev => prev.filter(x => x.id !== s.id))}
                      style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: 16, padding: '0 2px' }}>✕</button>
                  </div>
                ))}
                {pacchettoCorrente && selectedSlots.length > 0 && !usaPack4 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid rgba(255,255,255,0.06)`, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: 'system-ui' }}>
                    <span style={{ color: C.text2 }}>Quota per membro</span>
                    <span style={{ color: C.teal, fontWeight: 700 }}>
                      {formatEuro(Math.round(pacchettoCorrente.prezzoSingolo / pacchettoCorrente.membri) * selectedSlots.length)}
                    </span>
                  </div>
                )}
                {pacchettoCorrente && usaPack4 && (
                  <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid rgba(255,255,255,0.06)`, display: 'flex', justifyContent: 'space-between', fontSize: 13, fontFamily: 'system-ui' }}>
                    <span style={{ color: C.text2 }}>Quota per membro (pack 4)</span>
                    <span style={{ color: C.teal, fontWeight: 700 }}>
                      {formatEuro(Math.round(pacchettoCorrente.prezzoPack4 / pacchettoCorrente.membri))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Info gruppo */}
            {pacchettoCorrente && (
              <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '1rem' }}>
                <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12, fontWeight: 700, fontFamily: 'system-ui' }}>Info gruppo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>👥</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text1, fontFamily: 'system-ui' }}>{pacchettoCorrente.membri} partecipanti</div>
                      <div style={{ fontSize: 11, color: C.text3, fontFamily: 'system-ui' }}>Crew {pacchettoCorrente.membri === 2 ? 'due' : pacchettoCorrente.membri === 3 ? 'tre' : 'quattro'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>💳</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text1, fontFamily: 'system-ui' }}>Pagamento individuale</div>
                      <div style={{ fontSize: 11, color: C.text3, fontFamily: 'system-ui' }}>Ogni membro paga per sé tramite codice</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>⏱</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.text1, fontFamily: 'system-ui' }}>Validità codice: {GIORNI_VALIDITA_CODICE} giorni</div>
                      <div style={{ fontSize: 11, color: C.text3, fontFamily: 'system-ui' }}>I membri hanno {GIORNI_VALIDITA_CODICE} giorni per unirsi e pagare</div>
                    </div>
                  </div>
                  {!usaPack4 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>💰</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.teal, fontFamily: 'system-ui' }}>
                          {formatEuro(Math.round(pacchettoCorrente.prezzoSingolo / pacchettoCorrente.membri))} per partecipante a sessione
                        </div>
                        <div style={{ fontSize: 11, color: C.text3, fontFamily: 'system-ui' }}>
                          Totale sessione: {formatEuro(pacchettoCorrente.prezzoSingolo)}
                        </div>
                      </div>
                    </div>
                  )}
                  {usaPack4 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 18 }}>💰</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.teal, fontFamily: 'system-ui' }}>
                          {formatEuro(Math.round(pacchettoCorrente.prezzoPack4 / pacchettoCorrente.membri))} per partecipante (4 lezioni)
                        </div>
                        <div style={{ fontSize: 11, color: C.text3, fontFamily: 'system-ui' }}>
                          Totale pack: {formatEuro(pacchettoCorrente.prezzoPack4)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <style>{`@media(max-width:700px){main>div:last-child{grid-template-columns:1fr!important}}`}</style>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PACCHETTO — step iniziale
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui' }}>
      <PageHeader navigate={navigate} />
      <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: 1060, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const }}>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.teal, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'system-ui' }}>StreaMathCrew</div>
          <h1 style={{ fontSize: 28, fontWeight: 400, color: C.text1, margin: '0 0 10px', fontFamily: 'Georgia, serif', letterSpacing: '-0.01em' }}>Crea il tuo gruppo</h1>
          <p style={{ fontSize: 13, color: C.text2, margin: 0, fontFamily: 'system-ui', lineHeight: 1.7 }}>
            Gestisci il tuo gruppo. Definisci i partecipanti e il calendario, invia il codice d'invito e ogni componente potrà pagare la propria parte entro{' '}
            <strong style={{ color: C.text1 }}>30 minuti</strong> dal momento di creazione del gruppo.
          </p>
        </div>

        {/* Bottone incontro conoscitivo + pannello a scomparsa */}
        {conoscitiva && (
          <div style={{ marginBottom: '1.5rem' }}>
            <button
              onClick={() => setPannelloConoscitive(v => !v)}
              style={{ padding: '7px 18px', background: pannelloConoscitive ? C.priceBg : C.cardBg, border: `1px solid ${pannelloConoscitive ? C.teal : C.cardBorder}`, color: C.teal, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'system-ui', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8 }}>
              📋 Incontro conoscitivo
              <span style={{ fontSize: 10, opacity: 0.7, display: 'inline-block', transition: 'transform 0.2s', transform: pannelloConoscitive ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>

            {pannelloConoscitive && (() => {
              const msgList = messaggiConoscitiva[conoscitiva.id] ?? conoscitiva.conoscitive_messaggi ?? [];
              const haRisp  = msgList.some((m: any) => m.autore === 'admin');
              const dataRich = new Date((conoscitiva as any).created_at ?? '').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
              const isAperta = conoscitivaAperta === conoscitiva.id;
              return (
                <div style={{ marginTop: 8, background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '1rem', animation: 'fadeIn 0.2s ease' }}>
                  <div onClick={() => apriConoscitiva(conoscitiva.id)}
                    style={{ padding: '10px 12px', borderRadius: isAperta ? '8px 8px 0 0' : 8, background: isAperta ? C.priceBg : 'rgba(0,206,209,0.04)', border: `1.5px solid ${isAperta ? C.teal : C.cardBorder}`, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text1, fontFamily: 'system-ui' }}>StreaMathCrew</span>
                        <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: conoscitiva.modalita === 'sincrona' ? 'rgba(0,206,209,0.15)' : 'rgba(245,188,118,0.15)', color: conoscitiva.modalita === 'sincrona' ? C.teal : C.gold, fontFamily: 'system-ui' }}>
                          {conoscitiva.modalita === 'sincrona' ? '📅 Dal vivo' : '💬 In differita'}
                        </span>
                        {conoscitiva.stato === 'completata' && (
                          <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(0,206,209,0.1)', color: C.teal, fontFamily: 'system-ui' }}>✓ Completata</span>
                        )}
                        {haRisp && !isAperta && (
                          <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(245,188,118,0.15)', color: C.gold, fontFamily: 'system-ui', animation: 'pulse 2s infinite' }}>
                            🔔 Risposta ricevuta
                          </span>
                        )}
                      </div>
                      {conoscitiva.created_at && (
                        <div style={{ fontSize: 11, color: C.text3, fontFamily: 'system-ui' }}>Richiesta il {dataRich}</div>
                      )}
                    </div>
                    <span style={{ fontSize: 14, color: C.text3, display: 'inline-block', transition: 'transform 0.15s', transform: isAperta ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </div>
                  {isAperta && (
                    <div style={{ padding: '1rem', background: 'rgba(0,206,209,0.04)', border: `1.5px solid ${C.teal}`, borderTop: 'none', borderRadius: '0 0 8px 8px', animation: 'fadeIn 0.15s ease' }}>
                      {(conoscitiva.difficolta_percepita || conoscitiva.aspettative) && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
                          {[
                            { label: 'La tua difficoltà', value: conoscitiva.difficolta_percepita },
                            { label: 'Le tue aspettative', value: conoscitiva.aspettative },
                          ].filter(i => i.value).map(item => (
                            <div key={item.label}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'system-ui', marginBottom: 4 }}>{item.label}</div>
                              <div style={{ fontSize: 13, color: C.text2, fontFamily: 'system-ui', lineHeight: 1.6 }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      {msgList.length === 0 ? (
                        <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.02)', border: `1px dashed ${C.cardBorder}`, textAlign: 'center' }}>
                          {conoscitiva.modalita === 'asincrona'
                            ? <div style={{ fontSize: 13, color: C.text2, fontFamily: 'system-ui' }}>⏳ La risposta arriverà entro <strong style={{ color: C.text1 }}>72 ore</strong></div>
                            : <div style={{ fontSize: 13, color: C.text3, fontFamily: 'system-ui' }}>Nessun messaggio ancora.</div>
                          }
                        </div>
                      ) : (
                        <div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'system-ui', marginBottom: 8 }}>Risposta</div>
                          {msgList.filter((m: any) => m.autore === 'admin').map((m: any) => (
                            <div key={m.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(0,206,209,0.08)', border: `1px solid ${C.cardBorder}`, marginBottom: 6 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.teal, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'system-ui', marginBottom: 4 }}>
                                👨‍🏫 Risposta del docente · {new Date(m.created_at).toLocaleDateString('it-IT')}
                              </div>
                              {m.testo && <div style={{ fontSize: 13, color: C.text1, fontFamily: 'system-ui', lineHeight: 1.7 }}>{m.testo}</div>}
                              {m.media_url && (
                                <a href={m.media_url} target="_blank" rel="noopener noreferrer"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: m.testo ? 8 : 0, padding: '6px 12px', background: 'rgba(0,206,209,0.1)', borderRadius: 7, fontSize: 12, fontWeight: 600, color: C.teal, textDecoration: 'none', fontFamily: 'system-ui' }}>
                                  🎬 Guarda il video/audio
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Griglia 3 card — struttura dallo schizzo */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: '2rem' }}>
          {pacchetti.map(p => {
            const selSingola = tipoCrew === p.tipo && !usaPack4;
            const selPack    = tipoCrew === p.tipo && usaPack4;
            // Prezzo per partecipante = prezzo totale / numero membri (sempre dal DB)
            const prezzoPartSingola = p.prezzoSingolo > 0 ? p.prezzoSingolo / p.membri : 0;
            // Pack 4: prezzo totale / 4 lezioni / numero membri = prezzo per lezione per partecipante
            const prezzoPartPack4   = p.prezzoPack4   > 0 ? p.prezzoPack4   / 4 / p.membri : 0;

            return (
              <div key={p.tipo} style={{ background: C.cardBg, border: `1.5px solid ${tipoCrew === p.tipo ? C.teal : C.cardBorder}`, borderRadius: 14, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem', transition: 'border-color 0.15s' }}>

                {/* Testo descrittivo — frase dello schizzo */}
                <p style={{ fontSize: 13, color: C.text2, margin: 0, fontFamily: 'system-ui', lineHeight: 1.6 }}>
                  Sessione di gruppo per <strong style={{ color: C.text1 }}>{p.membri === 2 ? 'due' : p.membri === 3 ? 'tre' : 'quattro'}</strong>.
                  {' '}Tutto il valore della lezione a un costo condiviso:{' '}
                  <strong style={{ color: C.teal }}>
                    {prezzoPartSingola > 0 ? formatEuro(prezzoPartSingola) : '—'} per partecipante
                  </strong>.
                </p>

                {/* Rettangolo prezzo singolo — CLICCABILE */}
                <PacchettoCard
                  prezzo={p.prezzoSingolo}
                  selected={selSingola}
                  onClick={() => { setTipoCrew(p.tipo); setUsaPack4(false); }}
                />

                {/* Testo pack 4 — frase dello schizzo con prezzo per partecipante calcolato */}
                <p style={{ fontSize: 13, color: C.text2, margin: 0, fontFamily: 'system-ui', lineHeight: 1.6 }}>
                  Disponibile il pacchetto da 4 lezioni al costo di{' '}
                  <strong style={{ color: C.text1 }}>
                    {prezzoPartPack4 > 0 ? formatEuro(prezzoPartPack4) : '—'} a lezione per partecipante
                  </strong>.
                  {' '}Le 4 lezioni sono da prenotare prima dell'acquisto.
                  {' '}Il pacchetto include l'accesso mensile ai materiali delle lezioni e all'Academy.
                </p>

                {/* Rettangolo pack 4 — CLICCABILE */}
                <PacchettoCard
                  prezzo={p.prezzoPack4}
                  selected={selPack}
                  onClick={() => { setTipoCrew(p.tipo); setUsaPack4(true); }}
                />
              </div>
            );
          })}
        </div>

        {/* CTA unica sotto la griglia */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {tipoCrew && pacchettoCorrente ? (
            <>
              <p style={{ fontSize: 13, color: C.text2, margin: 0, fontFamily: 'system-ui' }}>
                Hai selezionato:{' '}
                <strong style={{ color: C.teal }}>
                  {pacchettoCorrente.label} — {usaPack4 ? 'Pack 4 lezioni' : '1 lezione'} — {formatEuro(usaPack4 ? pacchettoCorrente.prezzoPack4 : pacchettoCorrente.prezzoSingolo)} totale
                </strong>
              </p>
              <Btn onClick={() => setStep('calendario')}>
                Selezione date →
              </Btn>
            </>
          ) : (
            <p style={{ fontSize: 12, color: C.text3, margin: 0, fontFamily: 'system-ui' }}>
              Seleziona un pacchetto per procedere.
            </p>
          )}
        </div>
      </main>

      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.6}}
      `}</style>
    </div>
  );
}

// ─── PacchettoCard — rettangolo prezzo cliccabile ────────────────────────────

function PacchettoCard({ prezzo, selected, onClick }: { prezzo: number; selected: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const active = selected || hover;
  return (
    <div onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ background: active ? 'rgba(0,206,209,0.18)' : 'rgba(0,206,209,0.14)', border: `1.5px solid ${active ? '#00ced1' : 'rgba(0,206,209,0.4)'}`, borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none' }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#deeaf5' }}>{prezzo > 0 ? `€${(prezzo / 100).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}</div>
        <div style={{ fontSize: 11, color: 'rgba(180,205,225,0.35)', marginTop: 1 }}>netto</div>
      </div>
      <div style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${active ? '#00ced1' : 'rgba(0,206,209,0.4)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: active ? '#00ced1' : 'transparent', transition: 'all 0.15s' }} />
      </div>
    </div>
  );
}

// ─── Componenti di supporto ───────────────────────────────────────────────────

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

function Btn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ width: '100%', padding: '13px', background: disabled ? 'rgba(255,255,255,0.04)' : 'rgba(0,206,209,0.1)', border: `1px solid ${disabled ? 'rgba(255,255,255,0.09)' : '#00ced1'}`, color: disabled ? 'rgba(180,205,225,0.3)' : '#00ced1', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'system-ui', transition: 'background 0.12s', letterSpacing: '0.3px' }}>
      {children}
    </button>
  );
}