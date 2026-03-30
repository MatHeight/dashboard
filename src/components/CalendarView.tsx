import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface CalendarSlot {
  id: string;
  servizio: string;
  servizi_compatibili: string[];
  data_ora: string;
  durata_minuti: number;
  posti_max: number;
  posti_occupati: number;
  stato: string;
  note: string | null;
}

interface CalendarBooking {
  id: string;
  slot_id: string;
  user_id: string;
  servizio: string;
  stato: string;
  nome: string | null;
  email: string | null;
}

interface Props {
  isAdmin?: boolean;
  filtroServizio?: string;
  onBookingConfirmata?: () => void;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
const MESI_SHORT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const SERVIZIO_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  streamath:   { bg: '#e0f2fe', text: '#0369a1', dot: '#0ea5e9' },
  one:         { bg: '#e0f2fe', text: '#0369a1', dot: '#0ea5e9' },
  crew:        { bg: '#e0f2fe', text: '#0369a1', dot: '#0ea5e9' },
  go:          { bg: '#dcfce7', text: '#166534', dot: '#22c55e' },
  conoscitiva: { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' },
  whywhat:     { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
  wwm:         { bg: '#fef3c7', text: '#92400e', dot: '#f59e0b' },
};

function getServizioColor(servizio: string) {
  return SERVIZIO_COLORS[servizio.toLowerCase()] ?? { bg: '#ede9fe', text: '#5b21b6', dot: '#8b5cf6' };
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfWeek(year: number, month: number) { const d = new Date(year, month, 1).getDay(); return d === 0 ? 6 : d - 1; }
function formatOra(iso: string) { return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); }
function formatDataBreve(iso: string) { return new Date(iso).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }); }
function isSameDay(iso: string, year: number, month: number, day: number) {
  const d = new Date(iso);
  return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
}
// Numero settimana ISO dell'anno
function getWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
// Settimana corrente dell'utente (lun-dom che contiene oggi o la data selezionata)
function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay(); // 0=dom
  const diffToMon = (day === 0 ? -6 : 1 - day);
  const mon = new Date(d); mon.setDate(d.getDate() + diffToMon); mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999);
  return { start: mon, end: sun };
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function CalendarView({ isAdmin = false, filtroServizio, onBookingConfirmata }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [slots, setSlots] = useState<CalendarSlot[]>([]);
  const [myBookings, setMyBookings] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<CalendarSlot | null>(null);
  const [bookings, setBookings] = useState<CalendarBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Vista lista: 'giorno' | 'settimana' | 'mese'
  const [vistaLista, setVistaLista] = useState<'giorno' | 'settimana' | 'mese'>('mese');

  // Form nuovo slot (solo admin)
  const [showNewSlotForm, setShowNewSlotForm] = useState(false);
  const [newSlotOra, setNewSlotOra] = useState('09:00');
  const [newSlotServiziCompatibili, setNewSlotServiziCompatibili] = useState<string[]>(filtroServizio ? [filtroServizio] : []);
  const [newSlotDurata, setNewSlotDurata] = useState(50);
  const [newSlotPosti, setNewSlotPosti] = useState(1);
  const [newSlotNote, setNewSlotNote] = useState('');
  const [newSlotOreAnticipo, setNewSlotOreAnticipo] = useState(24);
  const [newSlotMinitiRiserva, setNewSlotMinitiRiserva] = useState(30);
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotMsg, setSlotMsg] = useState('');

  // Prenotazione (solo utente)
  const [bookingMsg, setBookingMsg] = useState('');
  const [savingBooking, setSavingBooking] = useState(false);

  const loadSlots = useCallback(async () => {
    const from = new Date(year, month - 1, 1).toISOString();
    const to = new Date(year, month + 2, 0).toISOString();
    let query = supabase
      .from('calendar_slots')
      .select('*')
      .gte('data_ora', from)
      .lte('data_ora', to)
      .neq('stato', 'annullato')
      .order('data_ora');
    if (filtroServizio) query = query.contains('servizi_compatibili', [filtroServizio]);
    const { data } = await query;
    if (data) setSlots(data);
  }, [year, month, filtroServizio]);

  const loadMyBookings = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('calendar_bookings')
      .select('slot_id')
      .eq('user_id', session.user.id)
      .eq('stato', 'confermata');
    if (data) setMyBookings(data.map(b => b.slot_id));
  }, []);

  useEffect(() => { loadSlots(); }, [loadSlots]);
  useEffect(() => { if (!isAdmin) loadMyBookings(); }, [isAdmin, loadMyBookings]);

  // Slot del giorno selezionato
  const slotsDelGiorno = selectedDay !== null
    ? slots.filter(s => isSameDay(s.data_ora, year, month, selectedDay))
    : [];

  function getSlotsPerDay(day: number) {
    return slots.filter(s => isSameDay(s.data_ora, year, month, day));
  }

  // ─── Slot filtrati per la lista ──────────────────────────────────────────────

  function getSlotsPerLista(): CalendarSlot[] {
    const slotsDelMese = slots.filter(s => {
      const d = new Date(s.data_ora);
      return d.getFullYear() === year && d.getMonth() === month;
    });

    if (vistaLista === 'mese') return slotsDelMese;

    if (vistaLista === 'giorno') {
      const refDay = selectedDay ?? now.getDate();
      return slots.filter(s => isSameDay(s.data_ora, year, month, refDay));
    }

    if (vistaLista === 'settimana') {
      // Settimana che contiene il giorno selezionato (o oggi se nessun giorno sel.)
      const refDate = selectedDay
        ? new Date(year, month, selectedDay)
        : new Date(year, month, now.getMonth() === month && now.getFullYear() === year ? now.getDate() : 1);
      const { start, end } = getWeekRange(refDate);
      return slots.filter(s => {
        const d = new Date(s.data_ora);
        return d >= start && d <= end;
      });
    }

    return slotsDelMese;
  }

  const slotsLista = getSlotsPerLista();

  // ─── Navigazione mese ────────────────────────────────────────────────────────

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDay(null); setSelectedSlot(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDay(null); setSelectedSlot(null);
  }

  function handleDayClick(day: number) {
    setSelectedDay(prev => prev === day ? null : day);
    setSelectedSlot(null);
    setBookingMsg('');
    if (isAdmin) setShowNewSlotForm(false);
    // Quando si clicca un giorno, switch automatico a vista giorno nella lista
    setVistaLista('giorno');
  }

  function handleNewSlot() { setShowNewSlotForm(true); setSlotMsg(''); }

  async function handleSaveSlot() {
    if (newSlotServiziCompatibili.length === 0 || !newSlotOra || selectedDay === null) {
      setSlotMsg("⚠️ Seleziona il servizio e l'ora");
      return;
    }
    setSavingSlot(true); setSlotMsg('');
    try {
      const data_ora = new Date(year, month, selectedDay,
        parseInt(newSlotOra.split(':')[0]),
        parseInt(newSlotOra.split(':')[1])
      ).toISOString();
      const { error } = await supabase.from('calendar_slots').insert({
        servizio: newSlotServiziCompatibili[0],
        servizi_compatibili: newSlotServiziCompatibili,
        data_ora,
        durata_minuti: newSlotDurata,
        posti_max: newSlotPosti,
        note: newSlotNote || null,
        ore_min_anticipo: newSlotOreAnticipo,
        minuti_riserva: newSlotMinitiRiserva,
      });
      if (error) throw error;
      setSlotMsg('✅ Slot creato!');
      setNewSlotOra('09:00'); setNewSlotNote('');
      setNewSlotOreAnticipo(24); setNewSlotMinitiRiserva(30);
      setNewSlotServiziCompatibili([]);
      setShowNewSlotForm(false);
      await loadSlots();
    } catch (err: any) {
      setSlotMsg(`❌ ${err.message}`);
    } finally {
      setSavingSlot(false);
    }
  }

  async function handleAnnullaSlot(slotId: string) {
    if (!confirm('Annullare questo slot?')) return;
    await supabase.from('calendar_slots').update({ stato: 'annullato' }).eq('id', slotId);
    setSelectedSlot(null);
    await loadSlots();
  }

  async function handleEliminaSlot(slotId: string) {
    if (!confirm('Eliminare definitivamente questo slot? Questa azione non è reversibile.')) return;
    await supabase.from('calendar_bookings').delete().eq('slot_id', slotId);
    await supabase.from('calendar_slots').delete().eq('id', slotId);
    setSelectedSlot(null);
    await loadSlots();
  }

  async function handleViewBookings(slot: CalendarSlot) {
    setSelectedSlot(prev => prev?.id === slot.id ? null : slot);
    if (selectedSlot?.id === slot.id) { setBookings([]); return; }
    setLoadingBookings(true);
    const { data } = await supabase.rpc('get_booking_utenti', { p_slot_id: slot.id });
    if (data) setBookings(data);
    setLoadingBookings(false);
  }

  async function handlePrenota(slot: CalendarSlot) {
    setSavingBooking(true); setBookingMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Non autenticato');
      const { error } = await supabase.from('calendar_bookings').insert({
        slot_id: slot.id,
        user_id: session.user.id,
        servizio: slot.servizio,
        stato: 'confermata',
      });
      if (error) throw error;
      setBookingMsg('✅ Prenotazione confermata!');
      await loadMyBookings();
      await loadSlots();
      if (onBookingConfirmata) onBookingConfirmata();
    } catch (err: any) {
      setBookingMsg(`❌ ${err.message}`);
    } finally {
      setSavingBooking(false);
    }
  }

  async function handleAnnullaPrenotazione(slot: CalendarSlot) {
    if (!confirm('Annullare la tua prenotazione?')) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('calendar_bookings')
      .update({ stato: 'annullata' })
      .eq('slot_id', slot.id)
      .eq('user_id', session.user.id);
    setBookingMsg('Prenotazione annullata.');
    await loadMyBookings();
    await loadSlots();
  }

  // ─── Griglia mese ────────────────────────────────────────────────────────────

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const navy = '#1a2332';
  const bordeaux = '#6b1f3d';

  // Label intestazione lista
  const listaLabel = () => {
    if (vistaLista === 'giorno') {
      const d = selectedDay ?? (isCurrentMonth ? today.getDate() : 1);
      return `${d} ${MESI_SHORT[month]}`;
    }
    if (vistaLista === 'settimana') {
      const refDate = selectedDay
        ? new Date(year, month, selectedDay)
        : new Date(year, month, isCurrentMonth ? today.getDate() : 1);
      const { start, end } = getWeekRange(refDate);
      return `Sett. ${getWeekNumber(start)} · ${start.getDate()} ${MESI_SHORT[start.getMonth()]} – ${end.getDate()} ${MESI_SHORT[end.getMonth()]}`;
    }
    return `${MESI[month]} ${year}`;
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* ── Layout a due colonne: calendario | lista ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>

        {/* ══ COLONNA SINISTRA: Calendario compatto ══ */}
        <div>
          {/* Header mese */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 10, padding: '8px 14px',
            background: `linear-gradient(135deg, ${navy} 0%, #2d3e50 100%)`,
            borderRadius: 10, color: 'white',
            boxShadow: '0 2px 10px rgba(26,35,50,0.14)'
          }}>
            <button onClick={prevMonth} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', width: 26, height: 26, borderRadius: '50%', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)') as any}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)') as any}>‹</button>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>{MESI[month]}</div>
              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 1 }}>{year}</div>
            </div>
            <button onClick={nextMonth} style={{ background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white', width: 26, height: 26, borderRadius: '50%', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)') as any}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)') as any}>›</button>
          </div>

          {/* Griglia — celle più compatte */}
          <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(26,35,50,0.06)' }}>
            {/* Intestazione giorni */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e2e8f0' }}>
              {GIORNI.map(g => (
                <div key={g} style={{ padding: '4px 0', textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{g}</div>
              ))}
            </div>

            {/* Celle giorni — minHeight ridotto */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {cells.map((day, idx) => {
                if (day === null) return <div key={`e-${idx}`} style={{ minHeight: 38, borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }} />;
                const daySlots = getSlotsPerDay(day);
                const isToday = isCurrentMonth && today.getDate() === day;
                const isSelected = selectedDay === day;
                const isPast = new Date(year, month, day) < new Date(today.getFullYear(), today.getMonth(), today.getDate());
                return (
                  <div key={day} onClick={() => handleDayClick(day)}
                    style={{ minHeight: 38, padding: '4px 3px', borderRight: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', cursor: daySlots.length > 0 || (isAdmin && !isPast) ? 'pointer' : 'default', background: isSelected ? '#eff6ff' : isToday ? '#fff7ed' : 'white', transition: 'background 0.12s', position: 'relative' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = isToday ? '#fff0e0' : '#f8faff'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSelected ? '#eff6ff' : isToday ? '#fff7ed' : 'white'; }}
                  >
                    <div style={{ width: 18, height: 18, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2, background: isToday ? bordeaux : isSelected ? navy : 'transparent', color: isToday || isSelected ? 'white' : isPast ? '#cbd5e1' : '#1e293b', fontSize: 10, fontWeight: isToday ? 700 : 500 }}>
                      {day}
                    </div>
                    {/* Pallini slot — max 2 */}
                    <div style={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {daySlots.slice(0, 2).map(slot => {
                        const col = getServizioColor(slot.servizi_compatibili?.[0] ?? slot.servizio);
                        const pieno = slot.posti_occupati >= slot.posti_max;
                        const mioSlot = myBookings.includes(slot.id);
                        return (
                          <div key={slot.id} style={{ width: 5, height: 5, borderRadius: '50%', background: mioSlot ? navy : pieno ? '#e2e8f0' : col.dot, opacity: pieno && !mioSlot ? 0.5 : 1 }} />
                        );
                      })}
                      {daySlots.length > 2 && <div style={{ fontSize: 7, color: '#94a3b8', lineHeight: '5px' }}>+{daySlots.length - 2}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legenda compatta */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {Object.entries(SERVIZIO_COLORS).map(([s, col]) => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#94a3b8' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: col.dot }} />{s}
              </div>
            ))}
          </div>

          {/* Form nuovo slot (admin) — sotto calendario, sopra lista */}
          {isAdmin && selectedDay !== null && (
            <div style={{ marginTop: 12, background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', background: `${navy}06` }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: navy }}>
                  {selectedDay} {MESI_SHORT[month]}
                  <span style={{ fontWeight: 400, color: '#94a3b8', marginLeft: 6, fontSize: 11 }}>{slotsDelGiorno.length} slot</span>
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {!showNewSlotForm && (
                    <button onClick={handleNewSlot} style={{ padding: '5px 12px', background: navy, color: 'white', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+ Nuovo slot</button>
                  )}
                  <button onClick={() => { setSelectedDay(null); setSelectedSlot(null); setShowNewSlotForm(false); }} style={{ background: '#f1f5f9', border: 'none', borderRadius: 7, width: 26, height: 26, cursor: 'pointer', fontSize: 14, color: '#64748b' }}>✕</button>
                </div>
              </div>

              {showNewSlotForm && (
                <div style={{ padding: '12px 14px', background: '#f0f7ff', borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={labelSt}>Servizio *</label>
                      <select style={inputSt} value={newSlotServiziCompatibili[0] ?? ''} onChange={e => setNewSlotServiziCompatibili(e.target.value ? [e.target.value] : [])}>
                        <option value="">— Seleziona —</option>
                        <option value="streamath">StreaMath (One + Crew)</option>
                        <option value="go">StreaMathGo</option>
                        <option value="conoscitiva">Conoscitiva</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelSt}>Ora *</label>
                      <input type="time" style={inputSt} value={newSlotOra} onChange={e => setNewSlotOra(e.target.value)} />
                    </div>
                    <div>
                      <label style={labelSt}>Durata (min)</label>
                      <input type="number" style={inputSt} value={newSlotDurata} min={15} max={180} onChange={e => setNewSlotDurata(Number(e.target.value))} />
                    </div>
                    <div>
                      <label style={labelSt}>Posti</label>
                      <input type="number" style={inputSt} value={newSlotPosti} min={1} max={20} onChange={e => setNewSlotPosti(Number(e.target.value))} />
                    </div>
                    <div>
                      <label style={labelSt}>Anticipo min (ore)</label>
                      <input type="number" style={inputSt} value={newSlotOreAnticipo} min={0} max={168} onChange={e => setNewSlotOreAnticipo(Number(e.target.value))} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={labelSt}>Note</label>
                      <input style={inputSt} value={newSlotNote} onChange={e => setNewSlotNote(e.target.value)} placeholder="Argomento..." />
                    </div>
                  </div>
                  {slotMsg && <div style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: slotMsg.startsWith('✅') ? '#059669' : '#dc2626' }}>{slotMsg}</div>}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handleSaveSlot} disabled={savingSlot} style={{ flex: 1, padding: '7px', background: savingSlot ? '#94a3b8' : navy, color: 'white', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: savingSlot ? 'not-allowed' : 'pointer' }}>
                      {savingSlot ? '...' : 'Salva slot'}
                    </button>
                    <button onClick={() => setShowNewSlotForm(false)} style={{ padding: '7px 14px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Annulla</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ══ COLONNA DESTRA: Lista impegni ══ */}
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 2px 10px rgba(26,35,50,0.06)' }}>

          {/* Header lista con toggle */}
          <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', background: `${navy}04` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: navy }}>📋 Impegni</span>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{listaLabel()}</span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 20, background: `${navy}10`, color: navy }}>
                {slotsLista.length}
              </span>
            </div>
            {/* Toggle giorno / settimana / mese */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 2, gap: 1 }}>
              {(['giorno', 'settimana', 'mese'] as const).map(v => (
                <button key={v} onClick={() => setVistaLista(v)} style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  fontSize: 11, fontWeight: 700,
                  background: vistaLista === v ? navy : 'transparent',
                  color: vistaLista === v ? 'white' : '#64748b',
                  transition: 'all 0.12s',
                  textTransform: 'capitalize',
                }}>
                  {v}
                </button>
              ))}
            </div>
          </div>

          {/* Tabella impegni */}
          <div style={{ overflowY: 'auto', maxHeight: 520 }}>
            {slotsLista.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Nessun impegno {vistaLista === 'giorno' ? 'oggi' : vistaLista === 'settimana' ? 'questa settimana' : 'questo mese'}.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: '#fafafa' }}>
                    {['Data', 'Ora', 'Servizio', 'Durata', 'Posti', 'Note', ...(isAdmin ? ['Azioni'] : [])].map(h => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slotsLista.map((slot, idx) => {
                    const col = getServizioColor(slot.servizi_compatibili?.[0] ?? slot.servizio);
                    const pieno = slot.posti_occupati >= slot.posti_max;
                    const mioSlot = myBookings.includes(slot.id);
                    const isSelectedSlot = selectedSlot?.id === slot.id;
                    const liberi = slot.posti_max - slot.posti_occupati;
                    return (
                      <>
                        <tr key={slot.id} style={{ borderBottom: '1px solid #f1f5f9', background: isSelectedSlot ? `${navy}05` : idx % 2 === 0 ? 'white' : '#fafafa', transition: 'background 0.1s' }}>
                          <td style={{ padding: '8px 12px', color: '#1e293b', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {formatDataBreve(slot.data_ora)}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: navy, whiteSpace: 'nowrap' }}>
                            {formatOra(slot.data_ora)}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: col.bg, color: col.text, whiteSpace: 'nowrap' }}>
                              {slot.servizi_compatibili?.length > 0 ? slot.servizi_compatibili.join('+') : slot.servizio}
                            </span>
                            {mioSlot && !isAdmin && (
                              <span style={{ marginLeft: 4, fontSize: 9, padding: '1px 5px', borderRadius: 10, background: '#dcfce7', color: '#166534', fontWeight: 700 }}>✓ mio</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#64748b', whiteSpace: 'nowrap' }}>{slot.durata_minuti} min</td>
                          <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontWeight: 600, color: pieno ? '#dc2626' : '#059669', fontSize: 12 }}>
                              {pieno ? '● pieno' : `${liberi}/${slot.posti_max}`}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', color: '#94a3b8', fontSize: 11, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {slot.note || '—'}
                          </td>
                          {isAdmin && (
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {slot.posti_occupati > 0 && (
                                  <button onClick={() => handleViewBookings(slot)} style={{ padding: '3px 8px', border: 'none', borderRadius: 5, fontWeight: 700, fontSize: 10, cursor: 'pointer', background: isSelectedSlot ? navy : '#dbeafe', color: isSelectedSlot ? 'white' : '#1d4ed8' }}>
                                    👥 {slot.posti_occupati}
                                  </button>
                                )}
                                <button onClick={() => handleAnnullaSlot(slot.id)} style={{ padding: '3px 8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>
                                  Annulla
                                </button>
                                <button onClick={() => handleEliminaSlot(slot.id)} style={{ padding: '3px 8px', background: '#7f1d1d', color: 'white', border: 'none', borderRadius: 5, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>
                                  🗑
                                </button>
                              </div>
                            </td>
                          )}
                          {!isAdmin && (
                            <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                              {mioSlot ? (
                                <button onClick={() => handleAnnullaPrenotazione(slot)} style={{ padding: '3px 8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, fontWeight: 700, fontSize: 10, cursor: 'pointer' }}>Annulla</button>
                              ) : (
                                <button onClick={() => !pieno && handlePrenota(slot)} disabled={pieno || savingBooking} style={{ padding: '3px 8px', border: 'none', borderRadius: 5, fontWeight: 700, fontSize: 10, cursor: pieno ? 'not-allowed' : 'pointer', background: pieno ? '#f1f5f9' : navy, color: pieno ? '#94a3b8' : 'white', opacity: pieno ? 0.6 : 1 }}>
                                  {pieno ? 'Pieno' : 'Prenota'}
                                </button>
                              )}
                            </td>
                          )}
                        </tr>

                        {/* Riga espansa: prenotazioni dello slot (solo admin) */}
                        {isAdmin && isSelectedSlot && selectedSlot?.id === slot.id && (
                          <tr key={`${slot.id}-bookings`}>
                            <td colSpan={7} style={{ padding: '0 12px 10px 28px', background: `${navy}04` }}>
                              {loadingBookings ? (
                                <div style={{ fontSize: 11, color: '#94a3b8', padding: '6px 0' }}>Caricamento...</div>
                              ) : bookings.length === 0 ? (
                                <div style={{ fontSize: 11, color: '#94a3b8', padding: '6px 0' }}>Nessuna prenotazione confermata.</div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6 }}>
                                  {bookings.map((b, i) => (
                                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: navy, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{i + 1}</div>
                                      <span style={{ fontWeight: 600, color: '#1e293b' }}>{b.nome ?? b.email ?? 'Utente sconosciuto'}</span>
                                      {b.nome && b.email && <span style={{ color: '#94a3b8', fontSize: 10 }}>{b.email}</span>}
                                      <span style={{ color: '#64748b', fontSize: 10, marginLeft: 'auto' }}>{b.servizio}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}

                        {/* Feedback prenotazione utente */}
                        {!isAdmin && bookingMsg && selectedSlot?.id === slot.id && (
                          <tr key={`${slot.id}-msg`}>
                            <td colSpan={6} style={{ padding: '4px 12px 8px', fontSize: 11, fontWeight: 600, color: bookingMsg.startsWith('✅') ? '#059669' : '#dc2626' }}>
                              {bookingMsg}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <style>{`@media (max-width: 800px) { div[style*="grid-template-columns: 320px"] { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// ─── Stili locali ─────────────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  width: '100%', padding: '6px 9px', border: '1px solid #e2e8f0',
  borderRadius: 7, fontSize: 12, outline: 'none', background: 'white',
  boxSizing: 'border-box', fontFamily: 'system-ui'
};

const labelSt: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: '#64748b',
  marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em',
  fontFamily: 'system-ui'
};