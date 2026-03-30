import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface Props {
  onAcquistoCompletato?: () => void;
}

type Servizio = 'one' | 'go';

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

interface PrezzoDB {
  servizio: string;
  prezzo_centesimi: number;
  lezioni: number | null;
}

interface Pacchetto {
  id: string;
  svServizio: Servizio;
  label: string;
  lezioni: number;
  prezzo_centesimi: number;
  prezzo_per_lezione: number;
}

interface Conoscitiva {
  id: string;
  modalita: 'sincrona' | 'asincrona';
  stato: string;
  servizio_interessato: string;
  calendar_slots?: { data_ora: string } | null;
  conoscitive_messaggi?: {
    id: string; autore: string;
    testo: string | null; media_url: string | null; created_at: string;
  }[];
}

interface SessionePrenotata {
  id: string;
  servizio: string;
  stato: string;
  calendar_slots: { data_ora: string; durata_minuti: number; note: string | null } | null;
}

// ─── Step ─────────────────────────────────────────────────────────────────────
// intro       → due card con pacchetti cliccabili
// conoscitiva → form obbligatorio
// attesa      → in attesa risposta admin
// calendario  → selezione date (tutte obbligatorie)
// checkout    → riepilogo + countdown
// successo    → conferma

type Step = 'intro' | 'conoscitiva' | 'attesa' | 'calendario' | 'checkout' | 'successo';

// ─── Costanti ─────────────────────────────────────────────────────────────────

const GIORNI_SHORT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
               'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

const SLOT_SERVIZIO: Record<Servizio, string> = { one: 'streamath', go: 'go' };

const PREZZI_ID: Record<Servizio, string[]> = {
  one: ['streamathone', 'streamathone_4'],
  go:  ['streamathgo', 'stremathgo_3', 'streamathgo_12'],
};

// ─── Palette ─────────────────────────────────────────────────────────────────

const C = {
  bg:          '#06080d',
  cardBg:      'rgba(0,206,209,0.07)',
  cardBorder:  'rgba(0,206,209,0.22)',
  priceBg:     'rgba(0,206,209,0.14)',
  priceBorder: '#00ced1',
  teal:        '#00ced1',
  slate:       '#4a90d9',
  navy:        '#1a2332',
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
  return `€${(centesimi / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function calcolaScadenza35gg(): Date {
  const d = new Date(); d.setDate(d.getDate() + 35); d.setHours(23, 59, 59, 999); return d;
}
function formatCountdown(sec: number) {
  const m = Math.floor(sec / 60); const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
function oraIT() { return new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }); }
function dataIT() { return new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' }); }

// ─── Componente principale ────────────────────────────────────────────────────

export default function Landing2({ onAcquistoCompletato }: Props) {
  const navigate = useNavigate();

  const [user, setUser]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep]       = useState<Step>('intro');

  const [servizioScelto, setServizioScelto]   = useState<Servizio | null>(null);
  const [pacchettoScelto, setPacchettoScelto] = useState<Pacchetto | null>(null);

  // Prezzi dal DB
  const [prezziDB, setPrezziDB] = useState<Record<Servizio, Pacchetto[]>>({ one: [], go: [] });

  // Posti disponibili prossimi 30gg
  const [postiDisp, setPostiDisp] = useState<Record<Servizio, number | null>>({ one: null, go: null });

  const [conoscitive, setConoscitive] = useState<Record<Servizio, Conoscitiva | null>>({ one: null, go: null });

  // Form conoscitiva
  const [fDifficolta, setFDifficolta] = useState('');
  const [fAspettative, setFAspettative] = useState('');
  const [fModalita, setFModalita]     = useState<'sincrona' | 'asincrona' | ''>('');
  const [fDomande, setFDomande]       = useState('');
  const [fError, setFError]           = useState('');
  const [savingCon, setSavingCon]     = useState(false);

  // Calendario
  const [year, setYear]   = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedDay, setSelectedDay]     = useState<number | null>(null);
  const [selectedSlots, setSelectedSlots] = useState<Slot[]>([]);
  const [calEspanso, setCalEspanso]       = useState(false);

  // Checkout
  const [processing, setProcessing]         = useState(false);
  const [secondiRimasti, setSecondiRimasti] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [sessioni, setSessioni] = useState<SessionePrenotata[]>([]);
  const [ora, setOra] = useState(oraIT());
  const [pannelloConoscitive, setPannelloConoscitive] = useState(false);
  const [conoscitivaAperta, setConoscitivaAperta] = useState<string | null>(null);
  const [messaggiConoscitiva, setMessaggiConoscitiva] = useState<Record<string, any[]>>({});

  useEffect(() => {
    const t = setInterval(() => setOra(oraIT()), 60000);
    return () => clearInterval(t);
  }, []);

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

  // ─── Init ─────────────────────────────────────────────────────────────────

  useEffect(() => { init(); }, []);

  useEffect(() => {
    if (step !== 'checkout' || secondiRimasti === null || secondiRimasti <= 0) return;
    countdownRef.current = setInterval(() => {
      setSecondiRimasti(s => {
        if (s === null || s <= 1) { clearInterval(countdownRef.current!); handleRiservaScaduta(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [step]);

  const loadSlots = useCallback(async (sv: Servizio, y: number, m: number) => {
    const from = new Date(y, m - 1, 1).toISOString();
    const to   = new Date(y, m + 2, 0).toISOString();
    const { data } = await supabase
      .from('calendar_slots').select('*')
      .eq('servizio', SLOT_SERVIZIO[sv]).neq('stato', 'annullato')
      .gte('data_ora', new Date().toISOString())
      .gte('data_ora', from).lte('data_ora', to).order('data_ora');
    if (data) setSlots(data);
  }, []);

  useEffect(() => {
    if (step === 'calendario' && servizioScelto) loadSlots(servizioScelto, year, month);
  }, [step, servizioScelto, year, month]);

  async function init() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }
    setUser(session.user);

    // Prezzi dal DB
    const { data: prezzi } = await supabase
      .from('prezzi_servizi')
      .select('servizio, prezzo_centesimi, lezioni')
      .in('servizio', [...PREZZI_ID.one, ...PREZZI_ID.go])
      .eq('attivo', true);

    if (prezzi) {
      const toP = (p: PrezzoDB, sv: Servizio): Pacchetto => ({
        id: p.servizio, svServizio: sv,
        label: (p.lezioni ?? 1) === 1 ? '1 lezione' : `${p.lezioni} lezioni`,
        lezioni: p.lezioni ?? 1,
        prezzo_centesimi: p.prezzo_centesimi,
        prezzo_per_lezione: Math.round(p.prezzo_centesimi / (p.lezioni ?? 1)),
      });
      setPrezziDB({
        one: PREZZI_ID.one.map(id => prezzi.find(p => p.servizio === id)).filter(Boolean).map(p => toP(p!, 'one')),
        go:  PREZZI_ID.go.map(id => prezzi.find(p => p.servizio === id)).filter(Boolean).map(p => toP(p!, 'go')),
      });
    }

    // Conoscitive
    const { data: cons } = await supabase
      .from('conoscitive').select('*, calendar_slots(data_ora), conoscitive_messaggi(*)')
      .eq('user_id', session.user.id).in('servizio_interessato', ['one', 'go']);
    const cMap: Record<Servizio, Conoscitiva | null> = { one: null, go: null };
    if (cons) cons.forEach(c => { if (c.servizio_interessato === 'one' || c.servizio_interessato === 'go') cMap[c.servizio_interessato as Servizio] = c; });
    setConoscitive(cMap);

    // Sessioni
    const { data: bk } = await supabase
      .from('calendar_bookings').select('id, servizio, stato, calendar_slots(data_ora, durata_minuti, note)')
      .eq('user_id', session.user.id).in('servizio', ['one', 'go']).eq('stato', 'confermata')
      .order('created_at', { ascending: false });
    if (bk) setSessioni(bk.filter(b => b.calendar_slots));

    // Posti
    const [{ data: pOne }, { data: pGo }] = await Promise.all([
      supabase.rpc('get_posti_disponibili_mese', { p_servizio: 'streamath' }),
      supabase.rpc('get_posti_disponibili_mese', { p_servizio: 'go' }),
    ]);
    setPostiDisp({ one: pOne ?? 0, go: pGo ?? 0 });

    setLoading(false);
  }

  // ─── Selezione pacchetto da rettangolo ───────────────────────────────────
  //
  // Click sul rettangolo: seleziona (o deseleziona) il pacchetto
  // nella card. La pagina rimane nell'intro — apparirà il bottone CTA.

  function selezionaDaRettangolo(sv: Servizio, pac: Pacchetto) {
    // Se già selezionato, deseleziona
    if (servizioScelto === sv && pacchettoScelto?.id === pac.id) {
      setServizioScelto(null);
      setPacchettoScelto(null);
      return;
    }
    setServizioScelto(sv);
    setPacchettoScelto(pac);
  }

  // ─── Avvio flusso dal bottone CTA ─────────────────────────────────────────
  //
  // Chiamata dal bottone "Scegli le date →" che appare dopo la selezione.

  function avviaFlusso() {
    if (!servizioScelto || !pacchettoScelto) return;
    const con = conoscitive[servizioScelto];
    if (!con) {
      setFDifficolta(''); setFAspettative(''); setFModalita(''); setFDomande(''); setFError('');
      setStep('conoscitiva');
    } else if (con.stato === 'in_attesa') {
      setStep('attesa');
    } else {
      setSelectedSlots([]);
      setStep('calendario');
    }
  }

  // ─── Conoscitiva ──────────────────────────────────────────────────────────

  async function submitConoscitiva() {
    if (!fDifficolta.trim() || !fAspettative.trim() || !fModalita) {
      setFError('Compila tutti i campi.'); return;
    }
    if (fModalita === 'asincrona' && !fDomande.trim()) {
      setFError('Scrivi almeno una domanda.'); return;
    }
    if (!servizioScelto || !user) return;
    setSavingCon(true); setFError('');
    try {
      const { data, error } = await supabase
        .from('conoscitive').insert({
          user_id: user.id, servizio_interessato: servizioScelto,
          difficolta_percepita: fDifficolta.trim(), aspettative: fAspettative.trim(),
          modalita: fModalita, stato: 'in_attesa',
        }).select('id').single();
      if (error) throw error;
      if (fModalita === 'asincrona') {
        await supabase.from('conoscitive_messaggi').insert({
          conoscitiva_id: data.id, autore: 'utente', testo: fDomande.trim(),
        });
      }
      setConoscitive(prev => ({
        ...prev,
        [servizioScelto]: { id: data.id, modalita: fModalita as any, stato: 'in_attesa', servizio_interessato: servizioScelto },
      }));
      setStep('attesa');
    } catch (err: any) {
      setFError(`Errore: ${err.message}`);
    } finally {
      setSavingCon(false);
    }
  }

  // ─── Calendario ───────────────────────────────────────────────────────────

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
    if (slot.stato === 'pieno' || slot.posti_occupati >= slot.posti_max) return;
    const già = selectedSlots.find(s => s.id === slot.id);
    if (già) { setSelectedSlots(prev => prev.filter(s => s.id !== slot.id)); }
    else {
      if (!pacchettoScelto || selectedSlots.length >= pacchettoScelto.lezioni) return;
      setSelectedSlots(prev => [...prev, slot]);
    }
  }

  const tutteLeDate = !!pacchettoScelto && selectedSlots.length === pacchettoScelto.lezioni;

  // ─── Riserva + pagamento ──────────────────────────────────────────────────

  async function handleBlocca() {
    if (!tutteLeDate || !user || !pacchettoScelto || !servizioScelto) return;
    setProcessing(true);
    try {
      const minRis = Math.max(...selectedSlots.map(s => s.minuti_riserva ?? 30));
      const until  = new Date(); until.setMinutes(until.getMinutes() + minRis);
      for (const slot of selectedSlots) {
        const { error } = await supabase.from('calendar_bookings').insert({
          slot_id: slot.id, user_id: user.id, servizio: servizioScelto,
          stato: 'riservata', reserved_until: until.toISOString(),
        });
        if (error) throw error;
      }
      setSecondiRimasti(minRis * 60);
      setStep('checkout');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) { alert(`Errore: ${err.message}`); }
    finally { setProcessing(false); }
  }

  async function handleRiservaScaduta() {
    setSelectedSlots([]);
    setStep('calendario');
    if (servizioScelto) await loadSlots(servizioScelto, year, month);
    alert("⚠️ Tempo scaduto. Seleziona di nuovo le date.");
  }

  async function handlePagamento() {
    if (!user || !pacchettoScelto || !servizioScelto) return;
    setProcessing(true);
    try {
      const scad = calcolaScadenza35gg();
      const { data: ord, error: errO } = await supabase.from('ordini').insert({
        user_id: user.id, servizio: servizioScelto, stato: 'in_attesa',
        slot_ids: selectedSlots.map(s => s.id), importo_centesimi: pacchettoScelto.prezzo_centesimi,
      }).select('id').single();
      if (errO) throw errO;

      alert('⚠️ Stripe non ancora integrato. Simulazione pagamento completato.');
      await supabase.from('ordini').update({ stato: 'pagato' }).eq('id', ord.id);

      for (const slot of selectedSlots) {
        await supabase.from('calendar_bookings').update({ stato: 'confermata' })
          .eq('slot_id', slot.id).eq('user_id', user.id).eq('stato', 'riservata');
      }

      const { data: svDb } = await supabase.from('servizi').select('id')
        .ilike('nome_servizio', `%${servizioScelto === 'one' ? 'One' : 'Go'}%`).maybeSingle();
      if (svDb) {
        await supabase.from('abbonamenti').insert({
          id_utente: user.id, id_servizio: svDb.id, data_scadenza: scad.toISOString(),
        });
      }
      if (countdownRef.current) clearInterval(countdownRef.current);
      setStep('successo');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) { alert(`Errore: ${err.message}`); }
    finally { setProcessing(false); }
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

  // ─── Stili condivisi ──────────────────────────────────────────────────────

  const inpSt: React.CSSProperties = {
    width: '100%', padding: '10px 14px', border: `1.5px solid ${C.inpBorder}`,
    borderRadius: 10, fontSize: 13, outline: 'none', background: C.inpBg,
    boxSizing: 'border-box' as const, resize: 'vertical' as const,
    fontFamily: 'system-ui', lineHeight: 1.6, minHeight: 90,
    color: C.text1, transition: 'border-color 0.15s',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: C.text3,
    marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'system-ui',
  };
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

  // ═══════════════════════════════════════════════════════════════════════════
  // SUCCESSO
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 'successo') return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <PageHeader navigate={navigate} />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
        <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 68, height: 68, borderRadius: '50%', background: C.cardBg, border: `2px solid ${C.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto 2rem', color: C.teal }}>✓</div>
          <h2 style={{ fontSize: 22, fontWeight: 400, color: C.text1, margin: '0 0 0.75rem', fontFamily: 'Georgia, serif', letterSpacing: 0.5 }}>Acquisto completato!</h2>
          <p style={{ fontSize: 13, color: C.text2, fontFamily: 'system-ui', marginBottom: '1.5rem', lineHeight: 1.6 }}>Le tue sessioni sono confermate. Trovi tutto nella dashboard.</p>
          <div style={{ marginBottom: '2rem' }}>
            {selectedSlots.map(s => (
              <div key={s.id} style={{ padding: '9px 0', borderBottom: `1px solid ${C.cardBorder}`, fontSize: 13, color: C.text1, fontFamily: 'system-ui' }}>
                📅 {formatDataLunga(s.data_ora)} ore {formatOra(s.data_ora)}
              </div>
            ))}
          </div>
          <Btn onClick={() => navigate('/dashboard')}>Torna alla dashboard →</Btn>
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CHECKOUT
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 'checkout') return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
      <PageHeader navigate={navigate} />
      <div style={{ flex: 1, padding: '2rem 1rem', maxWidth: 540, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const }}>

        {secondiRimasti !== null && secondiRimasti > 0 && (
          <div style={{ marginBottom: '1.5rem', padding: '12px 18px', borderRadius: 10, background: secondiRimasti < 120 ? 'rgba(245,166,35,0.1)' : C.cardBg, border: `1px solid ${secondiRimasti < 120 ? 'rgba(245,166,35,0.4)' : C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: C.text2, fontFamily: 'system-ui' }}>⏱ Slot bloccati per te</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: secondiRimasti < 120 ? C.amber : C.teal, fontFamily: 'system-ui', letterSpacing: 2 }}>{formatCountdown(secondiRimasti)}</span>
          </div>
        )}

        <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, color: C.slate, fontSize: 18, margin: '0 0 1.25rem' }}>Riepilogo ordine</h2>

        {pacchettoScelto && servizioScelto && (
          <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 10, padding: '12px 16px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.teal, fontFamily: 'system-ui' }}>
                {servizioScelto === 'one' ? 'StreaMathOne' : 'StreaMathGo'} — {pacchettoScelto.label}
              </div>
              {pacchettoScelto.lezioni > 1 && (
                <div style={{ fontSize: 11, color: C.text3, fontFamily: 'system-ui', marginTop: 2 }}>{formatEuro(pacchettoScelto.prezzo_per_lezione)} a lezione</div>
              )}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text1, fontFamily: 'system-ui' }}>{formatEuro(pacchettoScelto.prezzo_centesimi)}</div>
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontFamily: 'system-ui', fontWeight: 700 }}>Date prenotate ({selectedSlots.length})</div>
          {selectedSlots.map(slot => (
            <div key={slot.id} style={{ padding: '7px 0', borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
              <div style={{ fontSize: 13, color: C.text1, fontFamily: 'system-ui', textTransform: 'capitalize' }}>{formatDataLunga(slot.data_ora)}</div>
              <div style={{ fontSize: 11, color: C.text2, marginTop: 2, fontFamily: 'system-ui' }}>ore {formatOra(slot.data_ora)} · {slot.durata_minuti} min</div>
            </div>
          ))}
        </div>

        <Btn onClick={handlePagamento} disabled={processing}>
          {processing ? 'Elaborazione...' : '🔒 Procedi al pagamento'}
        </Btn>
        <p style={{ marginTop: 8, fontSize: 11, color: C.text3, textAlign: 'center', fontFamily: 'system-ui' }}>Il prezzo sarà confermato con l'integrazione Stripe</p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // CALENDARIO
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 'calendario' && servizioScelto && pacchettoScelto) {
    const maxSlot   = pacchettoScelto.lezioni;
    const sessioniSv = sessioni.filter(b => b.servizio === servizioScelto && b.calendar_slots && new Date(b.calendar_slots.data_ora) > new Date());

    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui' }}>
        <PageHeader navigate={navigate} />
        <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: 1080, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const }}>

          <div style={{ marginBottom: '1.25rem', padding: '10px 16px', borderRadius: 10, background: C.cardBg, border: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.teal }}>{servizioScelto === 'one' ? 'StreaMathOne' : 'StreaMathGo'} — {pacchettoScelto.label}</span>
              <span style={{ fontSize: 11, color: C.text3, marginLeft: 10 }}>{formatEuro(pacchettoScelto.prezzo_centesimi)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 12, color: tutteLeDate ? C.teal : C.text2, fontWeight: tutteLeDate ? 700 : 400 }}>
                {selectedSlots.length}/{maxSlot} date selezionate
              </span>
              <button onClick={() => { setStep('intro'); setSelectedSlots([]); }}
                style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: 11, fontFamily: 'system-ui' }}>
                ← torna ai servizi
              </button>
            </div>
          </div>

          {maxSlot > 1 && (
            <div style={{ marginBottom: '1rem', padding: '8px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 12, color: C.text2, border: `1px solid rgba(255,255,255,0.06)` }}>
              ℹ️ Seleziona tutte e {maxSlot} le date prima di procedere al pagamento.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: '1.5rem', alignItems: 'start' }}>

            {/* Calendario */}
            <div style={{ background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 14, overflow: 'hidden' }}>

              <div style={{ padding: '0.6rem 0.9rem', borderBottom: `1px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 13, color: C.text1 }}>
                  Sessioni
                  {selectedSlots.length > 0 && (
                    <span style={{ marginLeft: 8, fontSize: 10, padding: '1px 7px', borderRadius: 20, background: C.priceBg, border: `1px solid ${C.teal}`, color: C.teal, fontFamily: 'system-ui' }}>
                      {selectedSlots.length}/{maxSlot}
                    </span>
                  )}
                </span>
                <button onClick={() => setCalEspanso(e => !e)}
                  style={{ background: 'transparent', border: `1px solid ${C.cardBorder}`, color: C.text3, padding: '2px 8px', borderRadius: 5, cursor: 'pointer', fontSize: 10, fontFamily: 'system-ui' }}>
                  {calEspanso ? 'Riduci' : 'Espandi'}
                </button>
              </div>

              <div style={{ padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid rgba(0,206,209,0.1)` }}>
                <button onClick={prevMonth} style={navBtn}>‹</button>
                <div style={{ textAlign: 'center' }}>
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

              {selectedDay !== null && (
                <div style={{ borderTop: `1px solid ${C.cardBorder}`, padding: '0.7rem 0.9rem' }}>
                  <div style={{ fontSize: 10, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 700 }}>{MESI[month]} {selectedDay}</div>
                  {slotsDelGiorno.length === 0 ? (
                    <div style={{ fontSize: 12, color: C.text3, textAlign: 'center', padding: '0.75rem 0' }}>Nessuno slot.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {slotsDelGiorno.map(slot => {
                        const isSel2 = !!selectedSlots.find(s => s.id === slot.id);
                        const pieno  = slot.stato === 'pieno' || slot.posti_occupati >= slot.posti_max;
                        const limit  = !isSel2 && selectedSlots.length >= maxSlot;
                        const off    = pieno || limit;
                        return (
                          <div key={slot.id} onClick={() => !off && toggleSlot(slot)}
                            style={{ padding: '8px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${isSel2 ? C.teal : off ? 'rgba(255,255,255,0.06)' : C.cardBorder}`, background: isSel2 ? C.priceBg : off ? C.disabledBg : C.inpBg, cursor: off ? 'not-allowed' : 'pointer', opacity: off && !isSel2 ? 0.4 : 1, transition: 'all 0.12s' }}>
                            {/* Radio button funzionante */}
                            <div style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${isSel2 ? C.teal : C.cardBorder}`, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              {isSel2 && <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.teal }} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: isSel2 ? C.teal : C.text1 }}>{formatOra(slot.data_ora)}</span>
                              <span style={{ fontSize: 10, color: C.text2, marginLeft: 6 }}>{slot.durata_minuti} min{slot.note ? ` · ${slot.note}` : ''}</span>
                            </div>
                            <span style={{ fontSize: 10, color: C.text3 }}>{pieno ? 'Pieno' : limit ? '—' : 'Libero'}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div style={{ padding: '0.7rem 0.9rem', borderTop: `1px solid ${C.cardBorder}` }}>
                {tutteLeDate ? (
                  <Btn onClick={handleBlocca} disabled={processing}>
                    {processing ? '...' : `Blocca ${maxSlot > 1 ? `le ${maxSlot} date` : 'la data'} e acquista →`}
                  </Btn>
                ) : (
                  <p style={{ fontSize: 11, color: C.text3, textAlign: 'center', margin: 0, padding: '4px 0' }}>
                    {selectedSlots.length === 0
                      ? 'Clicca un giorno per vedere gli slot disponibili'
                      : `Ancora ${maxSlot - selectedSlots.length} data${maxSlot - selectedSlots.length !== 1 ? 'e' : ''} da scegliere`}
                  </p>
                )}
              </div>

              {slots.length === 0 && (
                <div style={{ padding: '1.25rem', textAlign: 'center', color: C.text3, fontSize: 12 }}>Nessuno slot disponibile.</div>
              )}
            </div>

            {/* Colonna destra */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {selectedSlots.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 12, padding: '1rem' }}>
                  <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 700, fontFamily: 'system-ui' }}>Date selezionate</div>
                  {selectedSlots.map((s, i) => (
                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: i < selectedSlots.length - 1 ? `1px solid rgba(255,255,255,0.05)` : 'none' }}>
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.cardBg, border: `1px solid ${C.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: C.teal, flexShrink: 0 }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, color: C.text1, fontFamily: 'system-ui' }}>{formatDataBreve(s.data_ora)}</div>
                        <div style={{ fontSize: 10, color: C.text2, fontFamily: 'system-ui' }}>ore {formatOra(s.data_ora)} · {s.durata_minuti} min</div>
                      </div>
                      <button onClick={() => setSelectedSlots(prev => prev.filter(x => x.id !== s.id))}
                        style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>✕</button>
                    </div>
                  ))}
                  {!tutteLeDate && (
                    <p style={{ margin: '8px 0 0', fontSize: 11, color: C.text3, fontStyle: 'italic', fontFamily: 'system-ui' }}>
                      Ancora {pacchettoScelto.lezioni - selectedSlots.length} da scegliere...
                    </p>
                  )}
                </div>
              )}
              {sessioniSv.length > 0 && (
                <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid rgba(255,255,255,0.06)`, borderRadius: 12, padding: '1rem' }}>
                  <div style={{ fontSize: 11, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 700, fontFamily: 'system-ui' }}>Sessioni già prenotate</div>
                  {sessioniSv.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                      <span style={{ fontSize: 10, color: C.teal }}>✓</span>
                      <div>
                        <div style={{ fontSize: 11, color: C.text1, fontFamily: 'system-ui' }}>{formatDataBreve(b.calendar_slots!.data_ora)}</div>
                        <div style={{ fontSize: 10, color: C.text2 }}>ore {formatOra(b.calendar_slots!.data_ora)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
        <style>{`@media(max-width:700px){main>div:last-child{grid-template-columns:1fr!important}}`}</style>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ATTESA
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 'attesa' && servizioScelto) {
    const con = conoscitive[servizioScelto];
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
        <PageHeader navigate={navigate} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
          <div style={{ maxWidth: 460, width: '100%', textAlign: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: '50%', background: C.cardBg, border: `2px solid ${C.cardBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, margin: '0 auto 1.5rem' }}>
              {con?.modalita === 'sincrona' ? '📅' : '💬'}
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 400, color: C.text1, margin: '0 0 0.75rem', fontFamily: 'Georgia, serif' }}>Conoscitiva inviata</h2>
            <p style={{ fontSize: 13, color: C.text2, fontFamily: 'system-ui', lineHeight: 1.7, marginBottom: '1.5rem' }}>
              {con?.modalita === 'asincrona'
                ? 'Risponderemo entro 72 ore con un video o audio.'
                : 'Riceverai la conferma dello slot a breve. Torna qui per scegliere le date.'}
            </p>
            <button onClick={() => setStep('intro')}
              style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: 12, fontFamily: 'system-ui' }}>
              ← Torna ai servizi
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONOSCITIVA
  // ═══════════════════════════════════════════════════════════════════════════

  if (step === 'conoscitiva' && servizioScelto) {
    const svLabel = servizioScelto === 'one' ? 'StreaMathOne' : 'StreaMathGo';
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column' }}>
        <PageHeader navigate={navigate} />
        <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: 600, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const }}>

          <button onClick={() => setStep('intro')}
            style={{ background: 'none', border: 'none', color: C.text3, cursor: 'pointer', fontSize: 12, fontFamily: 'system-ui', padding: 0, marginBottom: 16, display: 'block' }}>
            ← Torna ai servizi
          </button>

          <div style={{ marginBottom: '2rem' }}>
            <span style={{ display: 'inline-block', padding: '3px 12px', background: C.cardBg, borderRadius: 20, fontSize: 11, fontWeight: 700, color: C.teal, fontFamily: 'system-ui', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>{svLabel}</span>
            <h1 style={{ fontSize: 22, fontWeight: 400, color: C.text1, margin: '0 0 8px', fontFamily: 'Georgia, serif' }}>Incontro conoscitivo</h1>
            <p style={{ fontSize: 14, color: C.text2, margin: 0, fontFamily: 'system-ui', lineHeight: 1.6 }}>Raccontaci la tua situazione per prepararci al meglio.</p>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={lbl}>Qual è la tua difficoltà principale? *</label>
            <textarea style={inpSt} value={fDifficolta} onChange={e => setFDifficolta(e.target.value)}
              placeholder="Es. Faccio fatica con le equazioni..."
              onFocus={e => (e.currentTarget.style.borderColor = C.teal)}
              onBlur={e => (e.currentTarget.style.borderColor = C.inpBorder)} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={lbl}>Cosa ti aspetti da questo percorso? *</label>
            <textarea style={inpSt} value={fAspettative} onChange={e => setFAspettative(e.target.value)}
              placeholder="Es. Voglio capire i concetti, non solo memorizzare le formule..."
              onFocus={e => (e.currentTarget.style.borderColor = C.teal)}
              onBlur={e => (e.currentTarget.style.borderColor = C.inpBorder)} />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={lbl}>Come preferisci fare l'incontro conoscitivo? *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { v: 'sincrona',  t: '📅 Dal vivo',    d: 'Prenoti uno slot in videochiamata' },
                { v: 'asincrona', t: '💬 In differita', d: 'Scrivi le domande, rispondo entro 72h' },
              ].map(opt => (
                <div key={opt.v} onClick={() => { setFModalita(opt.v as any); setFError(''); }}
                  style={{ padding: '14px 12px', borderRadius: 12, cursor: 'pointer', border: `2px solid ${fModalita === opt.v ? C.teal : C.cardBorder}`, background: fModalita === opt.v ? C.priceBg : C.cardBg, transition: 'all 0.15s' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text1, fontFamily: 'system-ui', marginBottom: 4 }}>{opt.t}</div>
                  <div style={{ fontSize: 12, color: C.text2, fontFamily: 'system-ui', lineHeight: 1.4 }}>{opt.d}</div>
                  {fModalita === opt.v && (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: C.teal, fontFamily: 'system-ui' }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${C.teal}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.teal }} />
                      </div>
                      Selezionato
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {fModalita === 'asincrona' && (
            <div style={{ marginBottom: '1.5rem', padding: '16px', background: C.cardBg, borderRadius: 12, border: `1.5px solid ${C.cardBorder}`, animation: 'fadeIn 0.2s ease' }}>
              <label style={lbl}>Le tue domande *</label>
              <textarea style={{ ...inpSt, minHeight: 120 }} value={fDomande} onChange={e => setFDomande(e.target.value)}
                placeholder="Scrivi qui le tue domande o dubbi..."
                onFocus={e => (e.currentTarget.style.borderColor = C.teal)}
                onBlur={e => (e.currentTarget.style.borderColor = C.inpBorder)} />
              <p style={{ fontSize: 12, color: C.text3, fontFamily: 'system-ui', margin: '6px 0 0', lineHeight: 1.5 }}>La risposta apparirà qui entro 72 ore.</p>
            </div>
          )}

          {fError && (
            <div style={{ padding: '10px 14px', background: 'rgba(245,166,35,0.08)', borderRadius: 8, fontSize: 13, color: C.amber, fontFamily: 'system-ui', marginBottom: 12, border: `1px solid rgba(245,166,35,0.25)` }}>{fError}</div>
          )}

          <Btn onClick={submitConoscitiva} disabled={savingCon || !fModalita}>
            {savingCon ? 'Salvataggio...' : fModalita === 'sincrona' ? 'Invia e scegli la data →' : fModalita === 'asincrona' ? 'Invia le domande →' : 'Continua →'}
          </Btn>
          <p style={{ textAlign: 'center', fontSize: 11, color: C.text3, fontFamily: 'system-ui', marginTop: 10 }}>Puoi fare una sola conoscitiva per servizio</p>
        </main>
        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INTRO — rettangoli dei pacchetti cliccabili
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui' }}>
      <PageHeader navigate={navigate} />

      <main style={{ flex: 1, padding: '2rem 1.5rem', maxWidth: 1060, margin: '0 auto', width: '100%', boxSizing: 'border-box' as const }}>

        {/* Barra superiore */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: pannelloConoscitive ? '1rem' : '2rem' }}>
          <button
            onClick={() => setPannelloConoscitive(v => !v)}
            style={{ padding: '7px 18px', background: pannelloConoscitive ? C.priceBg : C.cardBg, border: `1px solid ${pannelloConoscitive ? C.teal : C.cardBorder}`, color: C.teal, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'system-ui', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 8 }}>
            📋 Incontro conoscitivo
            <span style={{ fontSize: 10, opacity: 0.7, transition: 'transform 0.2s', display: 'inline-block', transform: pannelloConoscitive ? 'rotate(180deg)' : 'none' }}>▾</span>
          </button>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: C.text3 }}>{dataIT()}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text2, letterSpacing: 1 }}>{ora}</div>
          </div>
        </div>

        {/* Pannello conoscitive — si apre al click del bottone */}
        {pannelloConoscitive && (() => {
          const tutteConoscitive = [conoscitive.one, conoscitive.go].filter(Boolean) as any[];
          const SERVIZIO_LABEL: Record<string, string> = { one: 'StreaMathOne', go: 'StreaMathGo' };
          return (
            <div style={{ marginBottom: '2rem', background: C.cardBg, border: `1px solid ${C.cardBorder}`, borderRadius: 12, padding: '1.25rem', animation: 'fadeIn 0.2s ease' }}>
              {tutteConoscitive.length === 0 ? (
                <p style={{ fontSize: 13, color: C.text3, fontFamily: 'system-ui', margin: 0, textAlign: 'center' }}>
                  Nessun incontro conoscitivo ancora inviato.
                </p>
              ) : tutteConoscitive.map(c => {
                const isAperta = conoscitivaAperta === c.id;
                const msgList  = messaggiConoscitiva[c.id] ?? [];
                const haRisp   = msgList.some((m: any) => m.autore === 'admin');
                const dataRich = new Date(c.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const slotData = c.calendar_slots?.data_ora
                  ? new Date(c.calendar_slots.data_ora).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : null;
                return (
                  <div key={c.id} style={{ marginBottom: 8 }}>
                    <div onClick={() => apriConoscitiva(c.id)}
                      style={{ padding: '12px 14px', borderRadius: isAperta ? '10px 10px 0 0' : 10, background: isAperta ? 'rgba(0,206,209,0.12)' : 'rgba(0,206,209,0.05)', border: `1.5px solid ${isAperta ? C.teal : C.cardBorder}`, cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.text1, fontFamily: 'system-ui' }}>
                            {SERVIZIO_LABEL[c.servizio_interessato] ?? c.servizio_interessato}
                          </span>
                          <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: c.modalita === 'sincrona' ? 'rgba(0,206,209,0.15)' : 'rgba(245,188,118,0.15)', color: c.modalita === 'sincrona' ? C.teal : C.gold, fontFamily: 'system-ui' }}>
                            {c.modalita === 'sincrona' ? '📅 Dal vivo' : '💬 In differita'}
                          </span>
                          {c.stato === 'completata' && (
                            <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(0,206,209,0.1)', color: C.teal, fontFamily: 'system-ui' }}>✓ Completata</span>
                          )}
                          {haRisp && !isAperta && (
                            <span style={{ padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'rgba(245,188,118,0.15)', color: C.gold, fontFamily: 'system-ui', animation: 'pulse 2s infinite' }}>
                              🔔 Risposta ricevuta
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: C.text3, fontFamily: 'system-ui' }}>
                          {slotData ? `Slot: ${slotData} · ` : ''}Richiesta il {dataRich}
                        </div>
                      </div>
                      <span style={{ fontSize: 14, color: C.text3, transition: 'transform 0.15s', display: 'inline-block', transform: isAperta ? 'rotate(180deg)' : 'none' }}>▾</span>
                    </div>

                    {isAperta && (
                      <div style={{ padding: '1rem 1.25rem', background: 'rgba(0,206,209,0.04)', border: `1.5px solid ${C.teal}`, borderTop: 'none', borderRadius: '0 0 10px 10px', animation: 'fadeIn 0.15s ease' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
                          {[{ label: 'La tua difficoltà', value: c.difficolta_percepita }, { label: 'Le tue aspettative', value: c.aspettative }].map(item => (
                            <div key={item.label}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'system-ui', marginBottom: 4 }}>{item.label}</div>
                              <div style={{ fontSize: 13, color: C.text2, fontFamily: 'system-ui', lineHeight: 1.6 }}>{item.value}</div>
                            </div>
                          ))}
                        </div>

                        {msgList.length === 0 ? (
                          <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: `1px dashed ${C.cardBorder}`, textAlign: 'center' }}>
                            {c.modalita === 'asincrona'
                              ? <div style={{ fontSize: 13, color: C.text2, fontFamily: 'system-ui' }}>⏳ La risposta arriverà entro <strong style={{ color: C.text1 }}>72 ore</strong></div>
                              : <div style={{ fontSize: 13, color: C.text3, fontFamily: 'system-ui' }}>Nessun messaggio per questa conoscitiva.</div>
                            }
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: 10, fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'system-ui', marginBottom: 8 }}>Risposta</div>
                            {msgList.map((m: any) => (
                              <div key={m.id} style={{ padding: '10px 12px', borderRadius: 10, background: m.autore === 'admin' ? 'rgba(0,206,209,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${m.autore === 'admin' ? C.cardBorder : 'rgba(255,255,255,0.07)'}`, marginBottom: 6 }}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: m.autore === 'admin' ? C.teal : C.text3, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'system-ui', marginBottom: 4 }}>
                                  {m.autore === 'admin' ? '👨‍🏫 Risposta del docente' : 'Tu'} · {new Date(m.created_at).toLocaleDateString('it-IT')}
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
              })}
            </div>
          );
        })()}

        {/* Le due card */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>

          {/* ── StreaMathOne ── */}
          {(() => {
            const packs = prezziDB.one;
            const pOne  = packs.find(p => p.id === 'streamathone');
            const p4    = packs.find(p => p.id === 'streamathone_4');
            const posti = postiDisp.one;

            return (
              <div style={{ background: C.cardBg, border: `1.5px solid ${C.cardBorder}`, borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                <div>
                  <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 20, color: C.text1, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>StreamathOne</h2>
                  <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>Lezione singola, da 50 minuti, su piattaforma dedicata</p>
                </div>

                {/* Rettangolo prezzo singolo — CLICCABILE */}
                {pOne && (
                  <PacchettoCard
                    pacchetto={pOne}
                    selected={servizioScelto === 'one' && pacchettoScelto?.id === pOne.id}
                    onClick={() => selezionaDaRettangolo('one', pOne)}
                  />
                )}

                {/* Frase marketing */}
                <p style={{ fontSize: 13, fontWeight: 500, color: C.text1, fontFamily: 'Georgia, serif', margin: 0, lineHeight: 1.7 }}>
                  Inizia ora il tuo percorso, per i prossimi 30 giorni i posti sono{' '}
                  {posti === null
                    ? <span style={{ color: C.text3, fontWeight: 400, fontSize: 12 }}>in caricamento...</span>
                    : posti === 0
                      ? <span style={{ color: C.amber }}>esauriti.</span>
                      : <><span style={{ color: C.teal, fontWeight: 700 }}>{posti}</span>.</>
                  }
                </p>

                {/* Rettangolo pacchetto 4 lezioni — CLICCABILE */}
                {p4 && (
                  <>
                    <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.6 }}>
                      Disponibile il pacchetto da 4 lezioni al costo di{' '}
                      <strong style={{ color: C.text1 }}>{formatEuro(p4.prezzo_per_lezione)} a lezione</strong>.
                      {' '}Le 4 lezioni sono da prenotare prima dall'acquisto.
                      {' '}Il pacchetto include l'accesso mensile ai materiali delle lezioni e all'Academy.
                    </p>
                    <PacchettoCard
                      pacchetto={p4}
                      selected={servizioScelto === 'one' && pacchettoScelto?.id === p4.id}
                      onClick={() => selezionaDaRettangolo('one', p4)}
                    />
                  </>
                )}
              </div>
            );
          })()}
          {(() => {
            const packs = prezziDB.go;
            const pGo   = packs.find(p => p.id === 'streamathgo');
            const p3    = packs.find(p => p.id === 'stremathgo_3');
            const p12   = packs.find(p => p.id === 'streamathgo_12');
            const posti = postiDisp.go;

            return (
              <div style={{ background: C.cardBg, border: `1.5px solid ${C.cardBorder}`, borderRadius: 16, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                <div>
                  <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 20, color: C.text1, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.02em' }}>StreamathGo</h2>
                  <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.5 }}>Lezione singola da 20 minuti su piattaforma dedicata</p>
                </div>

                {/* Rettangolo prezzo singolo — CLICCABILE */}
                {pGo && (
                  <PacchettoCard
                    pacchetto={pGo}
                    selected={servizioScelto === 'go' && pacchettoScelto?.id === pGo.id}
                    onClick={() => selezionaDaRettangolo('go', pGo)}
                  />
                )}

                {/* Frase marketing */}
                <p style={{ fontSize: 13, fontWeight: 500, color: C.text1, fontFamily: 'Georgia, serif', margin: 0, lineHeight: 1.7 }}>
                  Un confronto rapido di 20 minuti. Tutto il supporto di una lezione, nel tempo di una pausa.
                  {' '}Per i prossimi 30 giorni i posti sono{' '}
                  {posti === null
                    ? <span style={{ color: C.text3, fontWeight: 400, fontSize: 12 }}>in caricamento...</span>
                    : posti === 0
                      ? <span style={{ color: C.amber }}>esauriti.</span>
                      : <><span style={{ color: C.teal, fontWeight: 700 }}>{posti}</span>.</>
                  }
                </p>

                {/* Testo pacchetti multipli */}
                {(p3 || p12) && (
                  <p style={{ fontSize: 13, color: C.text2, margin: 0, lineHeight: 1.6 }}>
                    Disponibili i pacchetti da{' '}
                    {p3 && <strong style={{ color: C.text1 }}>3 lezioni a {formatEuro(p3.prezzo_per_lezione)} a lezione</strong>}
                    {p3 && p12 && ' e da '}
                    {p12 && <strong style={{ color: C.text1 }}>12 lezioni a {formatEuro(p12.prezzo_per_lezione)} a lezione</strong>}.
                    {' '}Le lezioni sono da prenotare prima dall'acquisto.
                    {' '}Entrambi i pacchetti includono l'accesso mensile ai materiali delle lezioni e all'Academy.
                  </p>
                )}

                {/* Rettangoli pacchetti 3 e 12 — CLICCABILI, affiancati */}
                {(p3 || p12) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[p3, p12].filter(Boolean).map(p => p && (
                      <PacchettoCard
                        key={p.id}
                        pacchetto={p}
                        selected={servizioScelto === 'go' && pacchettoScelto?.id === p.id}
                        onClick={() => selezionaDaRettangolo('go', p)}
                        small
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* ── Bottone unico "Scegli le date" — fuori dai blocchi ── */}
        <div style={{ marginTop: '1.75rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          {pacchettoScelto && servizioScelto ? (
            <>
              <p style={{ fontSize: 13, color: C.text2, margin: 0, fontFamily: 'system-ui' }}>
                Hai selezionato:{' '}
                <strong style={{ color: C.teal }}>
                  {servizioScelto === 'one' ? 'StreaMathOne' : 'StreaMathGo'} — {pacchettoScelto.label} — {formatEuro(pacchettoScelto.prezzo_centesimi)}
                </strong>
              </p>
              <button
                onClick={avviaFlusso}
                style={{ padding: '13px 48px', background: 'rgba(0,206,209,0.12)', border: `1.5px solid ${C.teal}`, color: C.teal, borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer', fontFamily: 'system-ui', letterSpacing: '0.4px', transition: 'background 0.15s', animation: 'fadeIn 0.2s ease' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,206,209,0.22)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,206,209,0.12)'; }}>
                Scegli le date →
              </button>
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
        @media(max-width:720px){main>div:nth-child(2){grid-template-columns:1fr!important}}
      `}</style>
    </div>
  );
}

// ─── PacchettoCard — rettangolo cliccabile con radio button ──────────────────
//
// Questo è il componente chiave dell'intro: ogni rettangolo di prezzo
// è un elemento cliccabile. Al hover si illumina il bordo.
// Al click chiama onClick() che avvia avviaDaRettangolo().

function PacchettoCard({
  pacchetto,
  selected = false,
  onClick,
  small = false,
}: {
  pacchetto: Pacchetto;
  selected?: boolean;
  onClick: () => void;
  small?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const active = selected || hover;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: active ? 'rgba(0,206,209,0.18)' : C.priceBg,
        border: `1.5px solid ${active ? C.teal : C.priceBorder}`,
        borderRadius: 10,
        padding: small ? '10px 14px' : '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: 'pointer',
        transition: 'all 0.15s',
        userSelect: 'none',
      }}
    >
      <div>
        <div style={{ fontSize: small ? 16 : 20, fontWeight: 700, color: C.text1 }}>
          {formatEuro(pacchetto.prezzo_centesimi)}
        </div>
        <div style={{ fontSize: 11, color: C.text3, marginTop: 1 }}>
          netto
          {pacchetto.lezioni > 1 && (
            <span style={{ marginLeft: 6, color: C.teal }}>
              · {formatEuro(pacchetto.prezzo_per_lezione)} a lezione
            </span>
          )}
        </div>
      </div>

      {/* Radio button — pieno se selezionato o hover */}
      <div style={{
        width: small ? 24 : 28,
        height: small ? 24 : 28,
        borderRadius: '50%',
        border: `2px solid ${active ? C.teal : C.priceBorder}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}>
        <div style={{
          width: small ? 9 : 11,
          height: small ? 9 : 11,
          borderRadius: '50%',
          background: active ? C.teal : 'transparent',
          border: active ? 'none' : `1.5px solid rgba(0,206,209,0.4)`,
          transition: 'all 0.15s',
        }} />
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