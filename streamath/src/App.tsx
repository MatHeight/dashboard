import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../src/lib/supabase.js';
import SessionRoom from './components/SessionRoom';

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || '/';
const WORKER_URL = import.meta.env.VITE_CALLS_WORKER_URL || 'https://streamath-calls.matheightlearing.workers.dev';

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface Sessione {
  id: string;
  codice: string;
  nome: string;
  tipo: 'one' | 'crew';
  data_ora: string;
  durata_minuti: number;
  stato: 'programmata' | 'attiva' | 'conclusa';
  created_at: string;
}

interface Partecipante {
  id: string;
  sessione_id: string;
  email: string;
  user_id: string | null;
  entrata_alle: string | null;
}

interface Documento {
  id: string;
  student_user_id: string;
  nome: string;
  url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  created_at: string;
}

interface StudentiMap {
  [user_id: string]: string; // user_id -> email
}

type View = 'LOADING' | 'LISTA' | 'CREA' | 'STANZA' | 'DASHBOARD_STUDENTE';

// ─── Brand ───────────────────────────────────────────────────────────────────

const B = {
  navy: '#1a2332',
  navyLight: '#2d3e50',
  bordeaux: '#6b1f3d',
  bgPage: '#F5F4F1',
  bgCard: '#FFFFFF',
  bgWarm: '#FAF9F7',
  border: '#E4E2DD',
  text: '#1a2332',
  muted: '#4f5d75',
  faint: '#8d99ae',
  green: '#16a34a',
  red: '#dc2626',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDataOra(iso: string) {
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(iso));
}

function minutiToOre(min: number) {
  return min >= 60
    ? `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ''}`
    : `${min} min`;
}

function formatFileSize(bytes: number) {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function statoColor(stato: string) {
  switch (stato) {
    case 'programmata': return { bg: '#dbeafe', color: '#1d4ed8' };
    case 'attiva':      return { bg: '#dcfce7', color: '#16a34a' };
    case 'conclusa':    return { bg: '#f1f5f9', color: '#94a3b8' };
    default:            return { bg: '#f1f5f9', color: '#94a3b8' };
  }
}

// ─── Brand Header ─────────────────────────────────────────────────────────────

function BrandHeader({ subtitle, right }: { subtitle?: string; right?: React.ReactNode }) {
  return (
    <header style={{
      background: B.bgCard,
      borderBottom: `1px solid ${B.border}`,
      padding: '0 2rem',
      height: 64,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 1px 8px rgba(26,35,50,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <a href={DASHBOARD_URL} style={{ fontSize: 11, fontWeight: 500, color: B.faint, textDecoration: 'none', letterSpacing: '0.3px' }}>
          ← Dashboard
        </a>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ height: '1.5px', width: 110, background: 'linear-gradient(90deg, transparent, #4a90d9 40%, #4a90d9 60%, transparent)' }} />
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: "'Georgia', serif", fontSize: '1.1rem', fontWeight: 400, letterSpacing: '5px', color: '#1a2332' }}>MatHeight</span>
            {subtitle && <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '3px', color: B.faint, textTransform: 'uppercase' }}>{subtitle}</span>}
          </div>
          <div style={{ height: '1.5px', width: 110, background: 'linear-gradient(90deg, transparent, #8B0000 40%, #8B0000 60%, transparent)' }} />
        </div>
      </div>
      {right}
    </header>
  )
}

// ─── Dashboard Studente ───────────────────────────────────────────────────────

function DashboardStudente({
  sessioni,
  documenti,
  userEmail,
  onEntra,
}: {
  sessioni: Sessione[];
  documenti: Documento[];
  userEmail: string;
  onEntra: (s: Sessione) => void;
}) {
  const sessioneAttiva = sessioni.find(s => s.stato === 'attiva');
  const prossime = sessioni
    .filter(s => s.stato === 'programmata')
    .sort((a, b) => new Date(a.data_ora).getTime() - new Date(b.data_ora).getTime());
  const concluse = sessioni
    .filter(s => s.stato === 'conclusa')
    .sort((a, b) => new Date(b.data_ora).getTime() - new Date(a.data_ora).getTime());

  const cardStyle: React.CSSProperties = {
    background: B.bgCard,
    borderRadius: 12,
    border: `1px solid ${B.border}`,
    padding: '1.25rem 1.5rem',
    marginBottom: '0.75rem',
  };

  const sectionTitle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    color: B.faint,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '0.75rem',
    marginTop: '1.5rem',
  };

  return (
    <div style={{ minHeight: '100vh', background: B.bgPage, fontFamily: 'system-ui, sans-serif' }}>
      <BrandHeader
        subtitle="StreaMath"
        right={
          <span style={{ fontSize: 12, color: B.faint }}>{userEmail}</span>
        }
      />

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* Benvenuto */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: B.text, margin: 0, letterSpacing: '-0.02em' }}>
            Ciao, {userEmail.split('@')[0]}
          </h1>
          <p style={{ color: B.muted, fontSize: 13, marginTop: 4 }}>
            Le tue ripetizioni di matematica
          </p>
        </div>

        {/* Sessione attiva */}
        {sessioneAttiva && (
          <>
            <p style={sectionTitle}>● In corso ora</p>
            <div style={{
              ...cardStyle,
              borderLeft: `4px solid ${B.green}`,
              background: 'linear-gradient(135deg, #f0fdf4, white)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: B.text, marginBottom: 4 }}>
                    {sessioneAttiva.nome}
                  </div>
                  <div style={{ fontSize: 13, color: B.muted }}>
                    ⏱ {minutiToOre(sessioneAttiva.durata_minuti)} · {sessioneAttiva.tipo === 'one' ? '1:1' : 'Gruppo'}
                  </div>
                </div>
                <button
                  onClick={() => onEntra(sessioneAttiva)}
                  style={{
                    padding: '10px 28px', background: B.green, color: 'white',
                    border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 14,
                    cursor: 'pointer', letterSpacing: '0.2px',
                  }}
                >
                  Entra ora
                </button>
              </div>
            </div>
          </>
        )}

        {/* Prossime sessioni */}
        {prossime.length > 0 && (
          <>
            <p style={sectionTitle}>Prossime lezioni</p>
            {prossime.map(s => (
              <div key={s.id} style={{ ...cardStyle, borderLeft: `3px solid ${B.navy}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: B.text, marginBottom: 3 }}>{s.nome}</div>
                    <div style={{ fontSize: 12, color: B.muted }}>
                      📅 {formatDataOra(s.data_ora)} · ⏱ {minutiToOre(s.durata_minuti)}
                    </div>
                  </div>
                  <span style={{ padding: '4px 12px', background: '#dbeafe', color: '#1d4ed8', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                    Programmata
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Nessuna sessione */}
        {!sessioneAttiva && prossime.length === 0 && (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '2.5rem', color: B.faint }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📅</div>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Nessuna lezione in programma</p>
            <p style={{ fontSize: 12, marginTop: 4 }}>Il tuo docente ti contatterà per la prossima sessione</p>
          </div>
        )}

        {/* Documenti */}
        {documenti.length > 0 && (
          <>
            <p style={sectionTitle}>Documenti</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {documenti.map(doc => (
                <a
                  key={doc.id}
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    ...cardStyle,
                    display: 'flex', alignItems: 'center', gap: 12,
                    textDecoration: 'none', color: B.text, marginBottom: 0,
                    transition: 'border-color 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = B.navy)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = B.border)}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{doc.nome}</div>
                    <div style={{ fontSize: 11, color: B.faint, marginTop: 2 }}>
                      {new Date(doc.created_at).toLocaleDateString('it-IT')}
                      {doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.faint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </a>
              ))}
            </div>
          </>
        )}

        {/* Storico */}
        {concluse.length > 0 && (
          <>
            <p style={sectionTitle}>Lezioni passate</p>
            {concluse.map(s => (
              <div key={s.id} style={{ ...cardStyle, opacity: 0.65, marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: B.text }}>{s.nome}</div>
                    <div style={{ fontSize: 11, color: B.faint, marginTop: 2 }}>
                      📅 {formatDataOra(s.data_ora)} · ⏱ {minutiToOre(s.durata_minuti)}
                    </div>
                  </div>
                  <span style={{ padding: '3px 10px', background: '#f1f5f9', color: '#94a3b8', borderRadius: 20, fontSize: 10, fontWeight: 600 }}>
                    Conclusa
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

      </div>
    </div>
  );
}

// ─── Card Sessione Admin ──────────────────────────────────────────────────────

function SessioneCard({
  sessione, partecipanti, studenti, studentiMap, documentiAdmin,
  onEntra, onConcludi, onElimina,
  onUploadDoc, onDeleteDoc,
}: {
  sessione: Sessione;
  partecipanti: Partecipante[];
  documenti: Documento[];
  onEntra: () => void;
  onConcludi: () => void;
  onElimina: () => void;
  studenti: Partecipante[];
  studentiMap: StudentiMap;
  documentiAdmin: Documento[];
  onUploadDoc: (studentUserId: string, file: File, nome: string) => Promise<void>;
  onDeleteDoc: (doc: Documento) => Promise<void>;
}) {
  const [showDocs, setShowDocs] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colors = statoColor(sessione.stato);

  // Studenti con user_id (già loggati almeno una volta)
  const studentiConId = studenti.filter(p => p.user_id);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const targetId = selectedStudentId || studentiConId[0]?.user_id;
    if (!targetId) { setUploadMsg('⚠️ Nessuno studente disponibile'); return; }
    setUploading(true);
    setUploadMsg('');
    try {
      const nome = prompt('Nome documento:', file.name.replace(/\.[^.]+$/, '')) || file.name;
      await onUploadDoc(targetId, file, nome);
      setUploadMsg('✅ Caricato');
    } catch {
      setUploadMsg('❌ Errore upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div style={{
      background: B.bgCard, borderRadius: 12, border: `1px solid ${B.border}`,
      padding: '1.25rem', marginBottom: '0.75rem',
      borderLeft: sessione.stato === 'attiva' ? `4px solid ${B.green}` : `4px solid transparent`,
    }}>
      {/* Riga principale */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: B.text }}>{sessione.nome}</span>
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: sessione.tipo === 'one' ? '#dbeafe' : '#fef3c7', color: sessione.tipo === 'one' ? '#1d4ed8' : '#92400e' }}>
              {sessione.tipo === 'one' ? 'ONE' : 'CREW'}
            </span>
            <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: colors.bg, color: colors.color }}>
              {sessione.stato.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: 12, color: B.muted }}>
            📅 {formatDataOra(sessione.data_ora)} · ⏱ {sessione.durata_minuti} min
          </div>
          {partecipanti.length > 0 && (
            <div style={{ fontSize: 11, color: B.faint, marginTop: 3 }}>
              👥 {partecipanti.map(p => p.email).join(', ')}
            </div>
          )}
        </div>

        {/* Azioni */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 0 }}>
          {/* Documenti toggle */}
          <button
            onClick={() => setShowDocs(d => !d)}
            style={{
              padding: '6px 12px', background: showDocs ? B.navy : B.bgWarm,
              color: showDocs ? 'white' : B.muted, border: `1px solid ${B.border}`,
              borderRadius: 7, fontSize: 11, cursor: 'pointer', fontWeight: 600,
            }}
          >
            📎 Doc {documentiAdmin.filter(d => studenti.filter(p => p.user_id).map(p => p.user_id!).includes(d.student_user_id)).length > 0 ? `(${documentiAdmin.filter(d => studenti.filter(p => p.user_id).map(p => p.user_id!).includes(d.student_user_id)).length})` : ''}
          </button>

          {sessione.stato !== 'conclusa' && (
            <button onClick={onEntra} style={{ padding: '6px 16px', background: sessione.stato === 'attiva' ? B.green : B.navy, color: 'white', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {sessione.stato === 'attiva' ? '● Entra' : 'Avvia'}
            </button>
          )}
          {sessione.stato === 'attiva' && (
            <button onClick={onConcludi} style={{ padding: '6px 12px', background: '#fee2e2', color: B.red, border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Concludi
            </button>
          )}
          {sessione.stato !== 'attiva' && (
            <button onClick={onElimina} style={{ padding: '6px 12px', background: B.bgWarm, color: B.faint, border: `1px solid ${B.border}`, borderRadius: 7, fontSize: 12, cursor: 'pointer' }}>
              Elimina
            </button>
          )}
        </div>
      </div>

      {/* Sezione documenti */}
      {showDocs && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: B.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Documenti per lo studente
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {studentiConId.length > 1 && (
                <select
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  style={{ padding: '4px 8px', border: `1px solid ${B.border}`, borderRadius: 6, fontSize: 11, color: B.text, background: B.bgWarm }}
                >
                  {studentiConId.map(p => (
                    <option key={p.user_id!} value={p.user_id!}>{p.email}</option>
                  ))}
                </select>
              )}
              <label style={{
                padding: '5px 12px', background: B.navy, color: 'white',
                borderRadius: 6, fontSize: 11, cursor: uploading ? 'not-allowed' : 'pointer', fontWeight: 600,
                opacity: uploading ? 0.6 : 1,
              }}>
                {uploading ? 'Caricamento...' : '+ Carica file'}
                <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
              </label>
            </div>
          </div>

          {uploadMsg && (
            <div style={{ fontSize: 11, marginBottom: 8, color: uploadMsg.startsWith('✅') ? B.green : B.red }}>
              {uploadMsg}
            </div>
          )}

          {(() => {
            const sessioneStudentIds = studenti.filter(p => p.user_id).map(p => p.user_id!);
            const docsFiltered = documentiAdmin.filter(d => sessioneStudentIds.includes(d.student_user_id));
            return docsFiltered.length === 0 ? (
              <div style={{ fontSize: 12, color: B.faint, textAlign: 'center', padding: '12px 0' }}>
                Nessun documento caricato
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {docsFiltered.map(doc => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: B.bgWarm, borderRadius: 7, border: `1px solid ${B.border}` }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={B.navy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: B.text }}>{doc.nome}</div>
                    <div style={{ fontSize: 10, color: B.faint }}>{formatFileSize(doc.file_size)}</div>
                  </div>
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: B.navy, textDecoration: 'none', fontWeight: 600, padding: '3px 8px', border: `1px solid ${B.border}`, borderRadius: 4 }}>
                    Apri
                  </a>
                  <button onClick={() => onDeleteDoc(doc)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: B.faint, padding: 4 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              ))}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  );
}

// ─── App principale ───────────────────────────────────────────────────────────

export default function StreaMathApp() {
  const [view, setView] = useState<View>('LOADING');
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessioni, setSessioni] = useState<Sessione[]>([]);
  const [partecipanti, setPartecipanti] = useState<Partecipante[]>([]);
  const [documenti, setDocumenti] = useState<Documento[]>([]);
  const [documentiAdmin, setDocumentiAdmin] = useState<Documento[]>([]);
  const [studentiMap, setStudentiMap] = useState<StudentiMap>({});
  const [sessioneAttiva, setSessioneAttiva] = useState<Sessione | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userId, setUserId] = useState('');

  // Form nuova sessione
  const [formNome, setFormNome] = useState('');
  const [formTipo, setFormTipo] = useState<'one' | 'crew'>('one');
  const [formDataOra, setFormDataOra] = useState('');
  const [formDurata, setFormDurata] = useState(50);
  const [formEmails, setFormEmails] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');

  useEffect(() => { init(); }, []);

  async function init() {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session;
    }
    if (!session) { window.location.href = DASHBOARD_URL; return; }

    const email = session.user.email || '';
    setUserEmail(email);
    setUserId(session.user.id);

    const { data: profile } = await supabase
      .from('profili_utenti').select('is_admin').eq('id', session.user.id).single();
    const admin = profile?.is_admin || false;
    setIsAdmin(admin);

    // Controlla codice sessione nell'URL
    const match = window.location.pathname.match(/\/streamath\/([a-z0-9]+)/);
    if (match) {
      const codice = match[1];
      const { data: sess } = await supabase.from('sessioni_streamath').select('*').eq('codice', codice).single();
      if (sess) {
        await supabase.from('partecipanti_sessione')
          .update({ user_id: session.user.id, entrata_alle: new Date().toISOString() })
          .eq('sessione_id', sess.id).eq('email', email);
        setSessioneAttiva(sess);
        setView('STANZA');
        return;
      }
    }

    await loadSessioni(session.user.id, admin, email);
    setView(admin ? 'LISTA' : 'DASHBOARD_STUDENTE');
  }

  async function loadSessioni(uid: string, admin: boolean, email: string) {
    if (admin) {
      const { data } = await supabase.from('sessioni_streamath').select('*').order('data_ora', { ascending: true });
      if (data) setSessioni(data);

      const { data: parts } = await supabase.from('partecipanti_sessione').select('*');
      if (parts) setPartecipanti(parts);

      // Carica tutti i documenti
      const { data: docs } = await supabase.from('documenti_streamath').select('*').order('created_at', { ascending: false });
      if (docs) setDocumentiAdmin(docs);

      // Costruisce mappa user_id -> email dai partecipanti
      if (parts) {
        const map: StudentiMap = {};
        parts.forEach((p: Partecipante) => {
          if (p.user_id) map[p.user_id] = p.email;
          else map[p.email] = p.email; // fallback se non ancora loggato
        });
        setStudentiMap(map);
      }
    } else {
      const { data: parts } = await supabase
        .from('partecipanti_sessione').select('*, sessioni_streamath(*)').eq('email', email);
      if (parts) {
        const sess = parts.map((p: any) => p.sessioni_streamath).filter(Boolean);
        setSessioni(sess);
        setPartecipanti(parts);

        // Carica i documenti dello studente (per user_id)
        const { data: docs } = await supabase
          .from('documenti_streamath').select('*')
          .eq('student_user_id', uid)
          .order('created_at', { ascending: false });
        if (docs) setDocumenti(docs);
      }
    }
  }

  async function handleUploadDoc(studentUserId: string, file: File, nome: string) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Non autenticato');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('student_user_id', studentUserId);
    formData.append('nome', nome);

    const res = await fetch(`${WORKER_URL}/upload-doc`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Upload fallito');
    }
    await loadSessioni(userId, isAdmin, userEmail);
  }

  async function handleDeleteDoc(doc: Documento) {
    if (!confirm(`Eliminare "${doc.nome}"?`)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    await fetch(`${WORKER_URL}/delete-doc`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ doc_id: doc.id, file_name: doc.file_name, student_user_id: doc.student_user_id }),
    });
    await loadSessioni(userId, isAdmin, userEmail);
  }

  async function handleEntraSessione(sessione: Sessione) {
    if (sessione.stato === 'programmata' && isAdmin) {
      await supabase.from('sessioni_streamath').update({ stato: 'attiva' }).eq('id', sessione.id);
      sessione.stato = 'attiva';
    }
    setSessioneAttiva(sessione);
    setView('STANZA');
    window.history.pushState({}, '', `/streamath/${sessione.codice}`);
  }

  async function handleConcludi(sessione: Sessione) {
    if (!confirm('Concludere la sessione?')) return;
    await supabase.from('sessioni_streamath').update({ stato: 'conclusa' }).eq('id', sessione.id);
    setView(isAdmin ? 'LISTA' : 'DASHBOARD_STUDENTE');
    setSessioneAttiva(null);
    window.history.pushState({}, '', '/streamath/');
    await loadSessioni(userId, isAdmin, userEmail);
  }

  async function handleElimina(sessione: Sessione) {
    if (!confirm(`Eliminare "${sessione.nome}"?`)) return;
    await supabase.from('sessioni_streamath').delete().eq('id', sessione.id);
    await loadSessioni(userId, isAdmin, userEmail);
  }

  async function handleCreaSessione() {
    if (!formNome || !formDataOra || !formEmails) { setFormMsg('⚠️ Compila tutti i campi'); return; }
    const emails = formEmails.split(/[\n,;]/).map(e => e.trim()).filter(e => e.includes('@'));
    if (emails.length === 0) { setFormMsg('⚠️ Inserisci almeno un\'email valida'); return; }
    if (formTipo === 'one' && emails.length > 1) { setFormMsg('⚠️ StreaMathOne accetta un solo studente'); return; }

    setFormSaving(true); setFormMsg('');
    try {
      const codice = Math.random().toString(36).substring(2, 10);
      const { data: sessione, error } = await supabase
        .from('sessioni_streamath')
        .insert({ codice, nome: formNome, tipo: formTipo, data_ora: new Date(formDataOra).toISOString(), durata_minuti: formDurata, stato: 'programmata' })
        .select().single();
      if (error) throw error;

      await supabase.from('partecipanti_sessione').insert(emails.map(email => ({ sessione_id: sessione.id, email })));

      setFormMsg(`✅ Sessione creata! Link promemoria: ${window.location.origin}/streamath/`);
      setFormNome(''); setFormTipo('one'); setFormDataOra(''); setFormDurata(50); setFormEmails('');
      await loadSessioni(userId, isAdmin, userEmail);
    } catch (err: any) {
      setFormMsg(`❌ Errore: ${err.message}`);
    } finally {
      setFormSaving(false);
    }
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (view === 'LOADING') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: B.bgPage }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${B.border}`, borderTopColor: B.navy, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem' }} />
          <p style={{ color: B.muted, fontSize: 13, fontWeight: 500 }}>Caricamento...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── STANZA ────────────────────────────────────────────────────────────────
  if (view === 'STANZA' && sessioneAttiva) {
    return (
      <SessionRoom
        sessioneId={sessioneAttiva.id}
        sessioneCodice={sessioneAttiva.codice}
        sessioneNome={sessioneAttiva.nome}
        userId={userId}
        userEmail={userEmail}
        isAdmin={isAdmin}
        onEsci={() => {
          setView(isAdmin ? 'LISTA' : 'DASHBOARD_STUDENTE');
          setSessioneAttiva(null);
          window.history.pushState({}, '', '/streamath/');
        }}
        onConcludi={() => handleConcludi(sessioneAttiva)}
      />
    );
  }

  // ── DASHBOARD STUDENTE ────────────────────────────────────────────────────
  if (view === 'DASHBOARD_STUDENTE') {
    return (
      <DashboardStudente
        sessioni={sessioni}
        documenti={documenti}
        userEmail={userEmail}
        onEntra={handleEntraSessione}
      />
    );
  }

  // ── LISTA / CREA (admin) ──────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 12px', border: `1px solid ${B.border}`,
    borderRadius: 8, fontSize: 14, outline: 'none', background: B.bgCard, boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: B.muted,
    marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
  };

  return (
    <div style={{ minHeight: '100vh', background: B.bgPage, fontFamily: 'system-ui, sans-serif' }}>

      <BrandHeader
        subtitle="StreaMath"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: B.faint }}>{userEmail}</span>
            <button
              onClick={() => setView(view === 'CREA' ? 'LISTA' : 'CREA')}
              style={{
                padding: '8px 18px',
                background: view === 'CREA' ? 'transparent' : `linear-gradient(135deg, ${B.navy}, ${B.bordeaux})`,
                color: view === 'CREA' ? B.muted : 'white',
                border: view === 'CREA' ? `1px solid ${B.border}` : 'none',
                borderRadius: 7, fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}
            >
              {view === 'CREA' ? '← Lista' : '+ Crea Sessione'}
            </button>
          </div>
        }
      />

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>

        {/* Form crea sessione */}
        {view === 'CREA' && (
          <div style={{ background: B.bgCard, borderRadius: 14, border: `1px solid ${B.border}`, padding: '1.5rem' }}>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: 15, fontWeight: 700, color: B.text }}>Crea nuova sessione</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Nome sessione *</label>
                <input style={inputStyle} value={formNome} onChange={e => setFormNome(e.target.value)} placeholder="Es. Ripetizione Mario - Analisi" />
              </div>
              <div>
                <label style={labelStyle}>Tipo *</label>
                <select style={inputStyle} value={formTipo} onChange={e => setFormTipo(e.target.value as 'one' | 'crew')}>
                  <option value="one">StreaMathOne (1:1)</option>
                  <option value="crew">StreaMathCrew (1:N)</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Data e ora *</label>
                <input type="datetime-local" style={inputStyle} value={formDataOra} onChange={e => setFormDataOra(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Durata (minuti)</label>
                <input type="number" style={inputStyle} value={formDurata} onChange={e => setFormDurata(Number(e.target.value))} min={10} max={180} />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>{formTipo === 'one' ? 'Email studente *' : 'Email studenti *'}</label>
              <textarea
                style={{ ...inputStyle, height: formTipo === 'crew' ? 100 : 44, resize: 'vertical' }}
                value={formEmails}
                onChange={e => setFormEmails(e.target.value)}
                placeholder={formTipo === 'one' ? 'studente@email.com' : 'studente1@email.com\nstudente2@email.com'}
              />
            </div>
            {formMsg && (
              <div style={{
                marginBottom: 12, fontSize: 12, fontWeight: 600, padding: '10px 12px', borderRadius: 8, wordBreak: 'break-all',
                background: formMsg.startsWith('✅') ? '#dcfce7' : formMsg.startsWith('⚠️') ? '#fef9c3' : '#fee2e2',
                color: formMsg.startsWith('✅') ? B.green : formMsg.startsWith('⚠️') ? '#854d0e' : B.red,
              }}>{formMsg}</div>
            )}
            <button
              onClick={handleCreaSessione} disabled={formSaving}
              style={{ padding: '10px 24px', background: formSaving ? B.faint : `linear-gradient(135deg, ${B.navy}, ${B.bordeaux})`, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: formSaving ? 'not-allowed' : 'pointer' }}
            >
              {formSaving ? 'Creazione...' : 'Crea sessione'}
            </button>
          </div>
        )}

        {/* Lista sessioni */}
        {view === 'LISTA' && (
          <div>
            <h2 style={{ margin: '0 0 1.5rem', fontSize: 18, fontWeight: 700, color: B.text, letterSpacing: '-0.02em' }}>Le tue sessioni</h2>
            {sessioni.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: B.faint, background: B.bgCard, borderRadius: 14, border: `1px solid ${B.border}` }}>
                <p style={{ fontSize: 28, marginBottom: '0.75rem' }}>📅</p>
                <p style={{ fontSize: 14, fontWeight: 600 }}>Nessuna sessione programmata</p>
                <p style={{ fontSize: 12, marginTop: 6 }}>Clicca "+ Crea Sessione" per iniziare</p>
              </div>
            ) : (
              <>
                {(['attiva', 'programmata', 'conclusa'] as const).map(stato => {
                  const filtered = sessioni.filter(s => s.stato === stato);
                  if (filtered.length === 0) return null;
                  const labels = { attiva: '● In corso', programmata: 'Programmate', conclusa: 'Concluse' };
                  const colors = { attiva: B.green, programmata: B.muted, conclusa: B.faint };
                  return (
                    <div key={stato} style={{ marginBottom: '1.5rem' }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: colors[stato], textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                        {labels[stato]}
                      </p>
                      {filtered.map(s => (
                        <SessioneCard
                          key={s.id}
                          sessione={s}
                          partecipanti={partecipanti.filter(p => p.sessione_id === s.id)}
                          studenti={partecipanti.filter(p => p.sessione_id === s.id)}
                          studentiMap={studentiMap}
                          documentiAdmin={documentiAdmin}
                          onEntra={() => handleEntraSessione(s)}
                          onConcludi={() => handleConcludi(s)}
                          onElimina={() => handleElimina(s)}
                          onUploadDoc={handleUploadDoc}
                          onDeleteDoc={handleDeleteDoc}
                        />
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}