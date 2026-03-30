import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../src/lib/supabase.js';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import CalendarView from '../../src/components/CalendarView';
import AdminConoscitive from './AdminConoscitive';

// ─── AdminWWM ─────────────────────────────────────────────────────────────────

interface IscrizioneWWM {
  id: string;
  user_id: string;
  stato: 'attivo' | 'concluso' | 'annullato';
  note: string | null;
  created_at: string;
}

function AdminWWM() {
  const [iscrizioni, setIscrizioni] = useState<IscrizioneWWM[]>([]);
  const [utentiMax, setUtentiMax] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadDati(); }, []);

  async function loadDati() {
    const [{ data: isc }, { data: prezzo }] = await Promise.all([
      supabase.from('iscrizioni_wwm').select('*').order('created_at', { ascending: false }),
      supabase.from('prezzi_servizi')
        .select('utenti_max')
        .or('servizio.ilike.%wwm%,servizio.ilike.%whywhat%')
        .eq('attivo', true)
        .order('utenti_max', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (isc) setIscrizioni(isc);
    if (prezzo) setUtentiMax(prezzo.utenti_max);
    setLoading(false);
  }

  async function handleCambiaStato(id: string, stato: 'attivo' | 'concluso' | 'annullato') {
    await supabase.from('iscrizioni_wwm').update({ stato, updated_at: new Date().toISOString() }).eq('id', id);
    setMsg('✅ Stato aggiornato');
    await loadDati();
  }

  const attivi = iscrizioni.filter(i => i.stato === 'attivo').length;
  const card: React.CSSProperties = { background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1rem' };
  const STATO_COLORS: Record<string, { bg: string; text: string }> = {
    attivo:    { bg: '#dcfce7', text: '#166534' },
    concluso:  { bg: '#f1f5f9', text: '#64748b' },
    annullato: { bg: '#fee2e2', text: '#dc2626' },
  };

  if (loading) return <div style={{ padding: '2rem', color: '#94a3b8', fontFamily: 'system-ui' }}>Caricamento...</div>;

  return (
    <div>
      {/* Header con contatori */}
      <div style={{ display: 'flex', gap: 16, marginBottom: '1.5rem' }}>
        <div style={{ ...card, flex: 1, marginBottom: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#0B3C5D', fontFamily: 'system-ui' }}>{attivi}</div>
          <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Iscritti attivi</div>
        </div>
        <div style={{ ...card, flex: 1, marginBottom: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: utentiMax && attivi >= utentiMax ? '#dc2626' : '#0B3C5D', fontFamily: 'system-ui' }}>
            {utentiMax ?? '∞'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posti massimi</div>
        </div>
        <div style={{ ...card, flex: 1, marginBottom: 0, textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#0B3C5D', fontFamily: 'system-ui' }}>
            {utentiMax ? Math.max(0, utentiMax - attivi) : '∞'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posti liberi</div>
        </div>
      </div>

      {msg && (
        <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13, fontWeight: 600, fontFamily: 'system-ui', background: '#dcfce7', color: '#166534' }}>
          {msg}
        </div>
      )}

      {/* Lista iscrizioni */}
      <div style={card}>
        <h2 style={{ margin: '0 0 1rem', fontSize: 16, fontWeight: 800, color: '#0B3C5D', fontFamily: 'system-ui' }}>
          Iscrizioni ({iscrizioni.length})
        </h2>
        {iscrizioni.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: 14, fontFamily: 'system-ui' }}>Nessuna iscrizione ancora.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                {['Utente', 'Iscritto il', 'Stato', 'Note', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'system-ui' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {iscrizioni.map((i, idx) => (
                <tr key={i.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'system-ui', color: '#1e293b', fontWeight: 600 }}>
                    {i.user_id.substring(0, 8)}...
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'system-ui', color: '#64748b' }}>
                    {new Date(i.created_at).toLocaleDateString('it-IT')}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                      fontFamily: 'system-ui',
                      background: STATO_COLORS[i.stato].bg,
                      color: STATO_COLORS[i.stato].text,
                    }}>
                      {i.stato}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'system-ui', color: '#64748b', fontSize: 12 }}>
                    {i.note || '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <select
                      value={i.stato}
                      onChange={e => handleCambiaStato(i.id, e.target.value as any)}
                      style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, fontFamily: 'system-ui', outline: 'none' }}
                    >
                      <option value="attivo">Attivo</option>
                      <option value="concluso">Concluso</option>
                      <option value="annullato">Annullato</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── AdminPrezzi ─────────────────────────────────────────────────────────────

interface PrezzoServizio {
  id: string;
  servizio: string;
  nome_visualizzato: string | null;
  prezzo_centesimi: number;
  descrizione: string;
  attivo: boolean;
  pacchetto: string | null;
  durata: string | null;
  utenti_max: number | null;
}

const SERVIZIO_NOMI: Record<string, string> = {
  one: 'StreaMathOne',
  go: 'StreaMathGo',
  crew2: 'StreaMathCrew 2',
  crew3: 'StreaMathCrew 3',
  crew4: 'StreaMathCrew 4',
};

function AdminPrezzi() {
  const [prezzi, setPrezzi] = useState<PrezzoServizio[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Form nuovo / modifica
  const [editing, setEditing] = useState<PrezzoServizio | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fServizio, setFServizio] = useState('');
  const [fNomeVisualizzato, setFNomeVisualizzato] = useState('');
  const [fPrezzo, setFPrezzo] = useState('');
  const [fDescrizione, setFDescrizione] = useState('');
  const [fPacchetto, setFPacchetto] = useState('');
  const [fDurata, setFDurata] = useState('');
  const [fUtentiMax, setFUtentiMax] = useState('');

  useEffect(() => { loadPrezzi(); }, []);

  async function loadPrezzi() {
    const { data } = await supabase.from('prezzi_servizi').select('*').order('servizio');
    if (data) setPrezzi(data);
    setLoading(false);
  }

  function apriNuovo() {
    setEditing(null);
    setFServizio(''); setFPrezzo(''); setFDescrizione('');
    setFPacchetto(''); setFDurata(''); setFUtentiMax('');
    setShowForm(true); setMsg('');
  }

  function apriModifica(p: PrezzoServizio) {
    setEditing(p);
    setFServizio(p.servizio);
    setFNomeVisualizzato(p.nome_visualizzato ?? '');
    setFPrezzo(String(p.prezzo_centesimi / 100));
    setFDescrizione(p.descrizione ?? '');
    setFPacchetto(p.pacchetto ?? '');
    setFDurata(p.durata ?? '');
    setFUtentiMax(p.utenti_max != null ? String(p.utenti_max) : '');
    setShowForm(true); setMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function annullaForm() {
    setShowForm(false); setEditing(null); setMsg('');
  }

  async function handleSalva() {
    if (!fServizio.trim() || !fPrezzo) { setMsg('⚠️ Compila nome servizio e prezzo'); return; }
    setSaving(true); setMsg('');
    const payload = {
      servizio: fServizio.trim().toLowerCase().replace(/\s+/g, '_'),
      nome_visualizzato: fNomeVisualizzato.trim() || null,
      prezzo_centesimi: Math.round(parseFloat(fPrezzo) * 100),
      descrizione: fDescrizione.trim() || null,
      pacchetto: fPacchetto.trim() || null,
      durata: fDurata || null,
      utenti_max: fUtentiMax ? parseInt(fUtentiMax) : null,
      attivo: true,
      updated_at: new Date().toISOString(),
    };
    const { error } = editing
      ? await supabase.from('prezzi_servizi').update(payload).eq('id', editing.id)
      : await supabase.from('prezzi_servizi').insert(payload);
    if (error) setMsg(`❌ ${error.message}`);
    else {
      setMsg(editing ? '✅ Modificato!' : '✅ Aggiunto!');
      annullaForm();
      await loadPrezzi();
    }
    setSaving(false);
  }

  async function handleElimina(id: string) {
    if (!confirm('Eliminare questo prezzo?')) return;
    await supabase.from('prezzi_servizi').delete().eq('id', id);
    await loadPrezzi();
  }

  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'system-ui' };
  const card: React.CSSProperties = { background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1rem' };
  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'system-ui', boxSizing: 'border-box' as const };
  const DURATA_LABEL: Record<string, string> = { sessione: 'A sessione', mensile: 'Mensile', annuale: 'Annuale', una_tantum: 'Una tantum' };

  if (loading) return <div style={{ padding: '2rem', color: '#94a3b8', fontFamily: 'system-ui' }}>Caricamento...</div>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0B3C5D', fontFamily: 'system-ui' }}>
          Prezzi servizi ({prezzi.length})
        </h2>
        {!showForm && (
          <button onClick={apriNuovo}
            style={{ padding: '8px 16px', background: '#0B3C5D', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'system-ui' }}>
            + Aggiungi
          </button>
        )}
      </div>

      {/* Form nuovo / modifica */}
      {showForm && (
        <div style={{ ...card, borderLeft: editing ? '4px solid #800020' : '4px solid #0B3C5D', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: 15, fontWeight: 800, color: editing ? '#800020' : '#0B3C5D', fontFamily: 'system-ui' }}>
            {editing ? `Modifica: ${editing.nome_visualizzato ?? editing.servizio}` : 'Nuovo prezzo'}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
            <div>
              <label style={lbl}>ID servizio * <span style={{ fontWeight: 400, textTransform: 'none', fontSize: 10 }}>(univoco, es. wwm_mensile)</span></label>
              <input style={inp} value={fServizio} onChange={e => setFServizio(e.target.value)} placeholder="es. whywhatmath_mensile" />
            </div>
            <div>
              <label style={lbl}>Nome visualizzato</label>
              <input style={inp} value={fNomeVisualizzato} onChange={e => setFNomeVisualizzato(e.target.value)} placeholder="es. WhyWhatMath" />
            </div>
            <div>
              <label style={lbl}>Prezzo (€) *</label>
              <input type="number" min="0" step="0.01" style={inp} value={fPrezzo} onChange={e => setFPrezzo(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label style={lbl}>Durata</label>
              <select style={inp} value={fDurata} onChange={e => setFDurata(e.target.value)}>
                <option value="">— Nessuna —</option>
                <option value="sessione">A sessione</option>
                <option value="mensile">Mensile</option>
                <option value="annuale">Annuale</option>
                <option value="una_tantum">Una tantum</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Pacchetto</label>
              <input style={inp} value={fPacchetto} onChange={e => setFPacchetto(e.target.value)} placeholder="es. Starter, Pro, Premium..." />
            </div>
            <div>
              <label style={lbl}>Utenti massimi</label>
              <input type="number" min="1" style={inp} value={fUtentiMax} onChange={e => setFUtentiMax(e.target.value)} placeholder="es. 20" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Descrizione</label>
            <input style={inp} value={fDescrizione} onChange={e => setFDescrizione(e.target.value)} placeholder="es. Servizio laboratorio matematica" />
          </div>
          {msg && (
            <div style={{ padding: '8px 12px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600, fontFamily: 'system-ui', background: msg.startsWith('✅') ? '#dcfce7' : msg.startsWith('⚠️') ? '#fef3c7' : '#fee2e2', color: msg.startsWith('✅') ? '#166534' : msg.startsWith('⚠️') ? '#92400e' : '#dc2626' }}>
              {msg}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSalva} disabled={saving}
              style={{ padding: '10px 24px', background: saving ? '#94a3b8' : '#0B3C5D', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'system-ui' }}>
              {saving ? 'Salvataggio...' : editing ? 'Salva modifiche' : '+ Aggiungi'}
            </button>
            <button onClick={annullaForm}
              style={{ padding: '10px 24px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'system-ui' }}>
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* Lista in tabella */}
      {prezzi.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 14, fontFamily: 'system-ui' }}>Nessun prezzo inserito.</p>
      ) : (
        <div style={card}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                {['Servizio', 'Prezzo', 'Durata', 'Pacchetto', 'Utenti max', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'system-ui' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prezzi.map((p, idx) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 12px', fontFamily: 'system-ui', fontWeight: 600, color: '#1e293b' }}>
                    <div>{p.nome_visualizzato ?? SERVIZIO_NOMI[p.servizio] ?? p.servizio}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: 400 }}>{p.servizio}</div>
                    {p.descrizione && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{p.descrizione}</div>}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'system-ui', color: '#1e293b' }}>
                    {p.prezzo_centesimi === 0 ? <span style={{ color: '#94a3b8' }}>—</span> : `€${(p.prezzo_centesimi / 100).toFixed(2)}`}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'system-ui', color: '#64748b' }}>
                    {p.durata ? DURATA_LABEL[p.durata] : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'system-ui', color: '#64748b' }}>
                    {p.pacchetto || <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px', fontFamily: 'system-ui', color: '#64748b', textAlign: 'center' }}>
                    {p.utenti_max != null ? p.utenti_max : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => apriModifica(p)}
                        style={{ padding: '4px 12px', background: '#e0f2fe', color: '#0369a1', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'system-ui' }}>
                        Modifica
                      </button>
                      <button onClick={() => handleElimina(p.id)}
                        style={{ padding: '4px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'system-ui' }}>
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── App Admin principale ─────────────────────────────────────────────────────

const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'http://localhost:8787';
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || '/';

type Tab = 'risorse' | 'flashcard' | 'calendario' | 'conoscitive' | 'prezzi' | 'wwm';
type Categoria = 'teoria' | 'video' | 'esercizi';

interface IndLogico {
  id: number;
  nome_logico: string;
}

interface Risorsa {
  id: string;
  nome: string;
  categoria: string;
  url: string;
  ordine: string | number;
}

interface SingleFlashcard {
  fronte: string;
  retro: string;
  nota: string | null;
}

interface FlashcardSet {
  id: string;
  argomento: string;
  classe: number;
  ind_logico: number;
  ordine?: string | number;
  flashcards: SingleFlashcard[];
}

// ─── LaTeX renderer ───────────────────────────────────────────────────────────

function renderLatex(text: string) {
  if (!text) return null;
  const parts: JSX.Element[] = [];
  const allParts: Array<{ type: 'text' | 'inline' | 'block'; content: string; start: number; end: number }> = [];
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  let match;
  while ((match = blockRegex.exec(text)) !== null) {
    allParts.push({ type: 'block', content: match[1], start: match.index, end: match.index + match[0].length });
  }
  const inlineRegex = /\$([^\$]+?)\$/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    const inside = allParts.some(p => p.type === 'block' && match!.index >= p.start && match!.index < p.end);
    if (!inside) allParts.push({ type: 'inline', content: match[1], start: match.index, end: match.index + match[0].length });
  }
  allParts.sort((a, b) => a.start - b.start);
  let lastIndex = 0;
  allParts.forEach((part, idx) => {
    if (part.start > lastIndex) parts.push(<span key={`t${idx}`}>{text.substring(lastIndex, part.start)}</span>);
    try {
      if (part.type === 'block') parts.push(<div key={`b${idx}`} style={{ margin: '12px 0' }}><BlockMath math={part.content} /></div>);
      else parts.push(<span key={`i${idx}`}><InlineMath math={part.content} /></span>);
    } catch {
      parts.push(<span key={`e${idx}`} style={{ color: '#dc2626', fontFamily: 'monospace' }}>{part.type === 'block' ? `$$${part.content}$$` : `$${part.content}$`}</span>);
    }
    lastIndex = part.end;
  });
  if (lastIndex < text.length) parts.push(<span key="tf">{text.substring(lastIndex)}</span>);
  return <>{parts}</>;
}

// ─── Componente principale ────────────────────────────────────────────────────

export default function AdminApp() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>('risorse');
  const [indirizzi, setIndirizzi] = useState<IndLogico[]>([]);

  // Risorse
  const [risorse, setRisorse] = useState<Risorsa[]>([]);
  const [visibilita, setVisibilita] = useState<{ id_risorsa: string; id_logico: number; classe: number }[]>([]);
  const [filtroIndirizzo, setFiltroIndirizzo] = useState<number | null>(null);
  const [editingRisorsa, setEditingRisorsa] = useState<Risorsa | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editOrdine, setEditOrdine] = useState('');
  const [editCombinazioni, setEditCombinazioni] = useState<Array<{ classe: number; indirizzi: number[] }>>([]);
  const [nomeRisorsa, setNomeRisorsa] = useState('');
  const [categoriaRisorsa, setCategoriaRisorsa] = useState<Categoria>('teoria');
  const [fileRisorsa, setFileRisorsa] = useState<File | null>(null);
  const [urlVideo, setUrlVideo] = useState('');
  const [combinazioniRisorsa, setCombinazioniRisorsa] = useState<Array<{ classe: number; indirizzi: number[] }>>([{ classe: 1, indirizzi: [] }]);
  const [ordineRisorsa, setOrdineRisorsa] = useState<string>('0');
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Flashcard
  const [flashcardSets, setFlashcardSets] = useState<FlashcardSet[]>([]);
  const [editingSet, setEditingSet] = useState<FlashcardSet | null>(null);
  const [fcArgomento, setFcArgomento] = useState('');
  const [fcClasse, setFcClasse] = useState<number>(1);
  const [fcIndLog, setFcIndLog] = useState<number[]>([]);
  const [fcOrdine, setFcOrdine] = useState<string>('0');
  const [fcCards, setFcCards] = useState<SingleFlashcard[]>([{ fronte: '', retro: '', nota: null }]);
  const [fcMsg, setFcMsg] = useState('');
  const [fcSaving, setFcSaving] = useState(false);

  useEffect(() => { init(); }, []);

  async function init() {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session;
    }
    if (!session) { window.location.href = DASHBOARD_URL; return; }
    const { data: profile } = await supabase.from('profili_utenti').select('is_admin').eq('id', session.user.id).single();
    if (!profile?.is_admin) { window.location.href = DASHBOARD_URL; return; }
    setIsAdmin(true);
    const { data: ind } = await supabase.from('ind_logico_lookup').select('*');
    if (ind) setIndirizzi(ind);
    await loadRisorse();
    await loadFlashcards();
    setLoading(false);
  }

  async function loadRisorse() {
    const { data } = await supabase.from('risorse').select('*').order('data_caricamento', { ascending: false });
    if (data) setRisorse(data);
    const { data: vis } = await supabase.from('visibilita').select('*');
    if (vis) setVisibilita(vis);
  }

  async function loadFlashcards() {
    const { data } = await supabase.from('flashcard').select('*').order('argomento');
    if (data) setFlashcardSets(data);
  }

  // ─── Risorse helpers ─────────────────────────────────────────────────────────

  function addCombinazione() { setCombinazioniRisorsa([...combinazioniRisorsa, { classe: 1, indirizzi: [] }]); }
  function removeCombinazione(i: number) { setCombinazioniRisorsa(combinazioniRisorsa.filter((_, idx) => idx !== i)); }
  function updateCombinazione(i: number, value: number) {
    const u = [...combinazioniRisorsa]; u[i] = { ...u[i], classe: value }; setCombinazioniRisorsa(u);
  }
  function toggleIndirizzoInCombinazione(ci: number, id: number) {
    const u = [...combinazioniRisorsa];
    u[ci].indirizzi = u[ci].indirizzi.includes(id) ? u[ci].indirizzi.filter(x => x !== id) : [...u[ci].indirizzi, id];
    setCombinazioniRisorsa(u);
  }
  function addEditCombinazione() { setEditCombinazioni([...editCombinazioni, { classe: 1, indirizzi: [] }]); }
  function removeEditCombinazione(i: number) { setEditCombinazioni(editCombinazioni.filter((_, idx) => idx !== i)); }
  function updateEditCombinazione(i: number, value: number) {
    const u = [...editCombinazioni]; u[i] = { ...u[i], classe: value }; setEditCombinazioni(u);
  }
  function toggleIndirizzoInEditCombinazione(ci: number, id: number) {
    const u = [...editCombinazioni];
    u[ci].indirizzi = u[ci].indirizzi.includes(id) ? u[ci].indirizzi.filter(x => x !== id) : [...u[ci].indirizzi, id];
    setEditCombinazioni(u);
  }

  async function handleUploadRisorsa() {
    if (!nomeRisorsa || combinazioniRisorsa.length === 0) { setUploadMsg('⚠️ Compila tutti i campi e aggiungi almeno una combinazione classe/indirizzo'); return; }
    if (combinazioniRisorsa.some(c => c.indirizzi.length === 0)) { setUploadMsg('⚠️ Seleziona almeno un indirizzo per ogni classe'); return; }
    if (categoriaRisorsa === 'video' && !urlVideo) { setUploadMsg('⚠️ Inserisci URL video'); return; }
    if (categoriaRisorsa !== 'video' && !fileRisorsa) { setUploadMsg('⚠️ Seleziona un file PDF'); return; }
    setUploading(true); setUploadMsg('');
    try {
      let url = '';
      if (categoriaRisorsa === 'video') {
        url = urlVideo;
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        const form = new FormData(); form.append('file', fileRisorsa!);
        const res = await fetch(`${WORKER_URL}/upload`, { method: 'POST', headers: { Authorization: `Bearer ${session!.access_token}` }, body: form });
        if (!res.ok) throw new Error(await res.text());
        url = (await res.json()).url;
      }
      const { data: risorsa, error: rErr } = await supabase.from('risorse').insert({ nome: nomeRisorsa, categoria: categoriaRisorsa, url, ordine: ordineRisorsa }).select().single();
      if (rErr) throw rErr;
      const rows = combinazioniRisorsa.flatMap(c => c.indirizzi.map(id => ({ id_risorsa: risorsa.id, id_logico: id, classe: c.classe })));
      const { error: vErr } = await supabase.from('visibilita').insert(rows);
      if (vErr) throw vErr;
      setUploadMsg('✅ Risorsa salvata!');
      setNomeRisorsa(''); setFileRisorsa(null); setUrlVideo(''); setCombinazioniRisorsa([{ classe: 1, indirizzi: [] }]); setOrdineRisorsa('0');
      if (fileRef.current) fileRef.current.value = '';
      await loadRisorse();
    } catch (err: any) { setUploadMsg(`❌ ${err.message}`); }
    finally { setUploading(false); }
  }

  async function handleDeleteRisorsa(id: string) {
    if (!confirm('Eliminare questa risorsa?')) return;
    await supabase.from('visibilita').delete().eq('id_risorsa', id);
    await supabase.from('risorse').delete().eq('id', id);
    await loadRisorse();
  }

  function startEditRisorsa(r: Risorsa) {
    setEditingRisorsa(r); setEditNome(r.nome); setEditOrdine(r.ordine?.toString() ?? '0');
    const vis = visibilita.filter(v => v.id_risorsa === r.id);
    const grouped = vis.reduce((acc, v) => {
      const ex = acc.find(c => c.classe === v.classe);
      if (ex) ex.indirizzi.push(v.id_logico); else acc.push({ classe: v.classe, indirizzi: [v.id_logico] });
      return acc;
    }, [] as Array<{ classe: number; indirizzi: number[] }>);
    setEditCombinazioni(grouped);
  }
  function cancelEditRisorsa() { setEditingRisorsa(null); setEditNome(''); setEditOrdine(''); setEditCombinazioni([]); }

  async function saveEditRisorsa() {
    if (!editingRisorsa || !editNome || editCombinazioni.length === 0) { alert('Compila tutti i campi'); return; }
    if (editCombinazioni.some(c => c.indirizzi.length === 0)) { alert('Seleziona almeno un indirizzo per ogni classe'); return; }
    try {
      const { error: rErr } = await supabase.from('risorse').update({ nome: editNome, ordine: editOrdine }).eq('id', editingRisorsa.id);
      if (rErr) throw rErr;
      await supabase.from('visibilita').delete().eq('id_risorsa', editingRisorsa.id);
      const rows = editCombinazioni.flatMap(c => c.indirizzi.map(id => ({ id_risorsa: editingRisorsa.id, id_logico: id, classe: c.classe })));
      const { error: vErr } = await supabase.from('visibilita').insert(rows);
      if (vErr) throw vErr;
      await loadRisorse(); cancelEditRisorsa();
    } catch (err: any) { alert(`Errore: ${err.message}`); }
  }

  // ─── Flashcard helpers ───────────────────────────────────────────────────────

  function addNewCard() { setFcCards([...fcCards, { fronte: '', retro: '', nota: null }]); }
  function removeCard(i: number) {
    if (fcCards.length === 1) { setFcMsg('⚠️ Almeno una flashcard'); return; }
    setFcCards(fcCards.filter((_, idx) => idx !== i));
  }
  function updateCard(i: number, field: keyof SingleFlashcard, value: string) {
    const u = [...fcCards]; u[i] = { ...u[i], [field]: value || null }; setFcCards(u);
  }
  function toggleInd(id: number) { setFcIndLog(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }
  function startNewSet() { setEditingSet(null); setFcArgomento(''); setFcClasse(1); setFcIndLog([]); setFcOrdine('0'); setFcCards([{ fronte: '', retro: '', nota: null }]); setFcMsg(''); }
  function editSet(set: FlashcardSet) { setEditingSet(set); setFcArgomento(set.argomento); setFcClasse(set.classe); setFcIndLog([set.ind_logico]); setFcOrdine(set.ordine?.toString() ?? '0'); setFcCards(set.flashcards); setFcMsg(''); }

  async function handleSaveFlashcardSet() {
    if (!fcArgomento || fcIndLog.length === 0) { setFcMsg('⚠️ Inserisci argomento e seleziona almeno un indirizzo'); return; }
    const valid = fcCards.filter(c => c.fronte && c.retro);
    if (valid.length === 0) { setFcMsg('⚠️ Aggiungi almeno una flashcard completa'); return; }
    setFcSaving(true); setFcMsg('');
    try {
      if (editingSet) {
        const { error } = await supabase.from('flashcard').update({ argomento: fcArgomento, classe: fcClasse, ind_logico: fcIndLog[0], ordine: fcOrdine, flashcards: valid }).eq('id', editingSet.id);
        if (error) throw error;
        await supabase.from('visibilita_flashcard').delete().eq('id_flashcard', editingSet.id);
        await supabase.from('visibilita_flashcard').insert(fcIndLog.map(id => ({ id_flashcard: editingSet.id, id_logico: id, classe: fcClasse })));
        setFcMsg('✅ Set aggiornato!');
      } else {
        const { data: fc, error } = await supabase.from('flashcard').insert({ argomento: fcArgomento, classe: fcClasse, ind_logico: fcIndLog[0], ordine: fcOrdine, flashcards: valid }).select().single();
        if (error) throw error;
        await supabase.from('visibilita_flashcard').insert(fcIndLog.map(id => ({ id_flashcard: fc.id, id_logico: id, classe: fcClasse })));
        setFcMsg('✅ Set salvato!');
      }
      startNewSet(); await loadFlashcards();
    } catch (err: any) { setFcMsg(`❌ ${err.message}`); }
    finally { setFcSaving(false); }
  }

  async function handleDeleteFlashcardSet(id: string) {
    if (!confirm('Eliminare questo set?')) return;
    await supabase.from('visibilita_flashcard').delete().eq('id_flashcard', id);
    await supabase.from('flashcard').delete().eq('id', id);
    await loadFlashcards();
  }

  // ─── Loading / guard ─────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTopColor: '#0B3C5D', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
        <p style={{ color: '#64748b', fontWeight: 600 }}>Caricamento...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!isAdmin) return null;

  // ─── Stili condivisi ─────────────────────────────────────────────────────────

  const inp: React.CSSProperties = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, outline: 'none', background: 'white', boxSizing: 'border-box' };
  const lbl: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' };
  const card: React.CSSProperties = { background: 'white', borderRadius: 12, border: '1px solid #e2e8f0', padding: '1.5rem', marginBottom: '1rem' };
  const cbxGroup: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px 12px', marginTop: 4, padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: 8, background: 'white' };
  const cbxLbl: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', color: '#1e293b' };
  const btnPrimary = (disabled = false): React.CSSProperties => ({ padding: '10px 24px', background: disabled ? '#94a3b8' : '#0B3C5D', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: disabled ? 'not-allowed' : 'pointer' });

  const TAB_LABELS: Record<Tab, string> = {
    risorse: '📄 Risorse',
    flashcard: '🃏 Flashcard',
    calendario: '📅 Calendario',
    conoscitive: '💬 Conoscitive',
    prezzi: '💶 Prezzi',
    wwm: '🔬 WWM',
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      {/* HEADER */}
      <header style={{ background: 'white', borderBottom: '1px solid #e2e8f0', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href={DASHBOARD_URL} style={{ fontSize: 12, fontWeight: 800, color: '#94a3b8', textDecoration: 'none', textTransform: 'uppercase' }}>← Dashboard</a>
          <div style={{ fontWeight: 900, fontSize: 16, letterSpacing: '-0.05em' }}>
            <span style={{ color: '#0B3C5D' }}>MATHEIGHT</span>
            <span style={{ color: '#800020' }}> ADMIN</span>
          </div>
        </div>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
      </header>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* TAB NAV */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '2rem' }}>
          {(['risorse', 'flashcard', 'calendario', 'conoscitive', 'prezzi', 'wwm'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 20px', borderRadius: 8, border: '1px solid #e2e8f0',
              background: tab === t ? '#0B3C5D' : 'white',
              color: tab === t ? 'white' : '#64748b',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ══════════════════ TAB WWM ══════════════════ */}
        {tab === 'wwm' && <AdminWWM />}

        {/* ══════════════════ TAB PREZZI ══════════════════ */}
        {tab === 'prezzi' && <AdminPrezzi />}

        {/* ══════════════════ TAB CONOSCITIVE ══════════════════ */}
        {tab === 'conoscitive' && (
          <AdminConoscitive />
        )}

        {/* ══════════════════ TAB CALENDARIO ══════════════════ */}
        {tab === 'calendario' && (
          <CalendarView isAdmin={true} />
        )}

        {/* ══════════════════ TAB RISORSE ══════════════════ */}
        {tab === 'risorse' && (
          <div>

            {/* FORM UPLOAD */}
            <div style={card}>
              <h2 style={{ margin: '0 0 1.5rem', fontSize: 16, fontWeight: 800, color: '#0B3C5D' }}>Carica nuova risorsa</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={lbl}>Nome risorsa *</label>
                  <input style={inp} value={nomeRisorsa} onChange={e => setNomeRisorsa(e.target.value)} placeholder="Es. Equazioni di primo grado" />
                </div>
                <div>
                  <label style={lbl}>Categoria *</label>
                  <select style={inp} value={categoriaRisorsa} onChange={e => { setCategoriaRisorsa(e.target.value as Categoria); setFileRisorsa(null); setUrlVideo(''); if (fileRef.current) fileRef.current.value = ''; }}>
                    <option value="teoria">Teoria</option>
                    <option value="video">Video</option>
                    <option value="esercizi">Esercizi</option>
                  </select>
                </div>
                <div>
                  <label style={lbl}>Ordine di visualizzazione</label>
                  <input style={inp} value={ordineRisorsa} onChange={e => setOrdineRisorsa(e.target.value)} placeholder="Es: 1, 1.5, 2a..." />
                </div>
              </div>

              {/* Combinazioni */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <label style={lbl}>Combinazioni Classe + Indirizzi *</label>
                  <button onClick={addCombinazione} style={{ padding: '4px 12px', background: '#0B3C5D', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+ Aggiungi classe</button>
                </div>
                {combinazioniRisorsa.map((comb, idx) => (
                  <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8, background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <label style={{ ...lbl, marginBottom: 0 }}>Classe:</label>
                        <input type="number" min={1} max={5} value={comb.classe} onChange={e => updateCombinazione(idx, Number(e.target.value))} style={{ ...inp, width: 60 }} />
                      </div>
                      {combinazioniRisorsa.length > 1 && (
                        <button onClick={() => removeCombinazione(idx)} style={{ padding: '3px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Rimuovi</button>
                      )}
                    </div>
                    <div style={cbxGroup}>
                      {indirizzi.map(ind => (
                        <label key={ind.id} style={cbxLbl}>
                          <input type="checkbox" checked={comb.indirizzi.includes(ind.id)} onChange={() => toggleIndirizzoInCombinazione(idx, ind.id)} />
                          <span style={{ fontSize: 12 }}>{ind.nome_logico}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* File / URL */}
              {categoriaRisorsa === 'video' ? (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>URL Video YouTube *</label>
                  <input style={inp} value={urlVideo} onChange={e => setUrlVideo(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
                </div>
              ) : (
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>File PDF *</label>
                  <input ref={fileRef} type="file" accept=".pdf" onChange={e => setFileRisorsa(e.target.files?.[0] ?? null)} style={{ fontSize: 13 }} />
                  {fileRisorsa && (
                    <div style={{
                      marginTop: 6, padding: '6px 10px',
                      background: '#f0f9ff', borderRadius: 6,
                      border: '1px solid #bae6fd',
                      fontSize: 12, color: '#0369a1',
                      fontWeight: 600, fontFamily: 'system-ui',
                      display: 'flex', alignItems: 'center', gap: 6
                    }}>
                      📄 {fileRisorsa.name}
                    </div>
                  )}
                </div>
              )}

              {uploadMsg && <p style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: uploadMsg.startsWith('✅') ? '#059669' : uploadMsg.startsWith('⚠️') ? '#d97706' : '#dc2626' }}>{uploadMsg}</p>}
              <button onClick={handleUploadRisorsa} disabled={uploading} style={btnPrimary(uploading)}>
                {uploading ? 'Caricamento...' : '+ Carica risorsa'}
              </button>
            </div>

            {/* EDIT RISORSA */}
            {editingRisorsa && (
              <div style={{ ...card, borderLeft: '4px solid #800020' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: 15, fontWeight: 800, color: '#800020' }}>Modifica: {editingRisorsa.nome}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div><label style={lbl}>Nome</label><input style={inp} value={editNome} onChange={e => setEditNome(e.target.value)} /></div>
                  <div><label style={lbl}>Ordine</label><input style={inp} value={editOrdine} onChange={e => setEditOrdine(e.target.value)} /></div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <label style={lbl}>Combinazioni</label>
                    <button onClick={addEditCombinazione} style={{ padding: '4px 12px', background: '#0B3C5D', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>+ Aggiungi</button>
                  </div>
                  {editCombinazioni.map((comb, idx) => (
                    <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, marginBottom: 8, background: '#f8fafc' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <label style={{ ...lbl, marginBottom: 0 }}>Classe:</label>
                          <input type="number" min={1} max={5} value={comb.classe} onChange={e => updateEditCombinazione(idx, Number(e.target.value))} style={{ ...inp, width: 60 }} />
                        </div>
                        {editCombinazioni.length > 1 && (
                          <button onClick={() => removeEditCombinazione(idx)} style={{ padding: '3px 10px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Rimuovi</button>
                        )}
                      </div>
                      <div style={cbxGroup}>
                        {indirizzi.map(ind => (
                          <label key={ind.id} style={cbxLbl}>
                            <input type="checkbox" checked={comb.indirizzi.includes(ind.id)} onChange={() => toggleIndirizzoInEditCombinazione(idx, ind.id)} />
                            <span style={{ fontSize: 12 }}>{ind.nome_logico}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={saveEditRisorsa} style={btnPrimary()}>Salva modifiche</button>
                  <button onClick={cancelEditRisorsa} style={{ padding: '10px 24px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Annulla</button>
                </div>
              </div>
            )}

            {/* LISTA RISORSE */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0B3C5D' }}>Risorse ({risorse.length})</h2>
                <select style={{ ...inp, width: 'auto' }} value={filtroIndirizzo ?? ''} onChange={e => setFiltroIndirizzo(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Tutti gli indirizzi</option>
                  {indirizzi.map(i => <option key={i.id} value={i.id}>{i.nome_logico}</option>)}
                </select>
              </div>
              {risorse.filter(r => !filtroIndirizzo || visibilita.some(v => v.id_risorsa === r.id && v.id_logico === filtroIndirizzo)).length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 14 }}>Nessuna risorsa.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      {['Nome', 'Categoria', 'Ordine', 'Azioni'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {risorse.filter(r => !filtroIndirizzo || visibilita.some(v => v.id_risorsa === r.id && v.id_logico === filtroIndirizzo)).map(r => (
                      <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>{r.nome}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: r.categoria === 'video' ? '#fef3c7' : r.categoria === 'teoria' ? '#dbeafe' : '#dcfce7', color: r.categoria === 'video' ? '#92400e' : r.categoria === 'teoria' ? '#1d4ed8' : '#166534' }}>
                            {r.categoria}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.ordine}</td>
                        <td style={{ padding: '10px 12px', display: 'flex', gap: 8 }}>
                          <button onClick={() => startEditRisorsa(r)} style={{ padding: '4px 12px', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Modifica</button>
                          <button onClick={() => handleDeleteRisorsa(r.id)} style={{ padding: '4px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Elimina</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ TAB FLASHCARD ══════════════════ */}
        {tab === 'flashcard' && (
          <div>
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#d97706' }}>
                  {editingSet ? `Modifica: ${editingSet.argomento}` : 'Crea nuovo set di flashcard'}
                </h2>
                {editingSet && (
                  <button onClick={startNewSet} style={{ padding: '6px 16px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Nuovo set</button>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div><label style={lbl}>Argomento *</label><input style={inp} value={fcArgomento} onChange={e => setFcArgomento(e.target.value)} placeholder="Es. Equazioni di secondo grado" /></div>
                <div><label style={lbl}>Classe *</label><input type="number" min={1} max={5} style={inp} value={fcClasse} onChange={e => setFcClasse(Number(e.target.value))} /></div>
                <div><label style={lbl}>Ordine</label><input style={inp} value={fcOrdine} onChange={e => setFcOrdine(e.target.value)} placeholder="Es: 1, 1.5..." /></div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>Indirizzi *</label>
                <div style={cbxGroup}>
                  {indirizzi.map(ind => (
                    <label key={ind.id} style={cbxLbl}>
                      <input type="checkbox" checked={fcIndLog.includes(ind.id)} onChange={() => toggleInd(ind.id)} />
                      <span style={{ fontSize: 12 }}>{ind.nome_logico}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <label style={{ ...lbl, marginBottom: 0 }}>Flashcard ({fcCards.length})</label>
                  <button onClick={addNewCard} style={{ padding: '6px 16px', background: '#d97706', color: 'white', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>+ Aggiungi flashcard</button>
                </div>
                {fcCards.map((card, idx) => (
                  <div key={idx} style={{ border: '2px solid #f59e0b', borderRadius: 12, padding: 16, marginBottom: 16, background: '#fffbeb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h4 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#92400e' }}>Flashcard #{idx + 1}</h4>
                      {fcCards.length > 1 && (
                        <button onClick={() => removeCard(idx)} style={{ padding: '4px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Rimuovi</button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      {(['fronte', 'retro'] as const).map(side => (
                        <div key={side}>
                          <label style={{ ...lbl, color: '#92400e' }}>{side === 'fronte' ? 'Fronte (domanda) *' : 'Retro (risposta) *'}</label>
                          <textarea style={{ ...inp, height: 80, resize: 'vertical', fontFamily: 'monospace', fontSize: 13, background: 'white' } as React.CSSProperties}
                            value={card[side]} onChange={e => updateCard(idx, side, e.target.value)} placeholder={side === 'fronte' ? 'Scrivi la domanda...' : 'Scrivi la risposta...'} />
                          {card[side] && (
                            <div style={{ marginTop: 8, padding: 10, background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, minHeight: 40 }}>
                              <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Preview:</div>
                              {renderLatex(card[side])}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div>
                      <label style={{ ...lbl, color: '#92400e' }}>Nota (opzionale)</label>
                      <input style={{ ...inp, background: 'white' }} value={card.nota ?? ''} onChange={e => updateCard(idx, 'nota', e.target.value)} placeholder="Es. Ricorda che..." />
                      {card.nota && (
                        <div style={{ marginTop: 8, padding: 10, background: 'white', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12 }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: '#64748b', marginBottom: 4, textTransform: 'uppercase' }}>Preview:</div>
                          {renderLatex(card.nota)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {fcMsg && <p style={{ marginBottom: 12, fontSize: 13, fontWeight: 600, color: fcMsg.startsWith('✅') ? '#059669' : fcMsg.startsWith('⚠️') ? '#d97706' : '#dc2626' }}>{fcMsg}</p>}
              <button onClick={handleSaveFlashcardSet} disabled={fcSaving} style={{ ...btnPrimary(fcSaving), background: fcSaving ? '#94a3b8' : '#d97706' }}>
                {fcSaving ? 'Salvataggio...' : editingSet ? 'Aggiorna set' : 'Salva set'}
              </button>
            </div>

            {/* LISTA SET */}
            <div style={card}>
              <h2 style={{ margin: '0 0 1rem', fontSize: 16, fontWeight: 800, color: '#d97706' }}>Set di flashcard ({flashcardSets.length})</h2>
              {flashcardSets.length === 0 ? (
                <p style={{ color: '#94a3b8', fontSize: 14 }}>Nessun set ancora creato.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                      {['Argomento', 'N° Flashcard', 'Classe', 'Azioni'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {flashcardSets.map(set => (
                      <tr key={set.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600, color: '#1e293b' }}>{set.argomento}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#92400e' }}>{set.flashcards.length} card</span>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{set.classe}°</td>
                        <td style={{ padding: '10px 12px', display: 'flex', gap: 8 }}>
                          <button onClick={() => editSet(set)} style={{ padding: '4px 12px', background: '#dbeafe', color: '#1d4ed8', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Modifica</button>
                          <button onClick={() => handleDeleteFlashcardSet(set.id)} style={{ padding: '4px 12px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>Elimina</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}