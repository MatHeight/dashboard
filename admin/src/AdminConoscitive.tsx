import { useState, useEffect } from 'react';
import { supabase } from '../../src/lib/supabase.js';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface Conoscitiva {
  id: string;
  user_id: string;
  servizio_interessato: string;
  difficolta_percepita: string;
  aspettative: string;
  modalita: 'sincrona' | 'asincrona';
  stato: 'in_attesa' | 'completata';
  slot_id: string | null;
  created_at: string;
  calendar_slots?: {
    data_ora: string;
  } | null;
}

interface Messaggio {
  id: string;
  conoscitiva_id: string;
  autore: 'utente' | 'admin';
  testo: string | null;
  media_url: string | null;
  created_at: string;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const navy = '#1a2332';
const bordeaux = '#6b1f3d';

const SERVIZIO_LABEL: Record<string, string> = {
  one: 'StreaMathOne', crew2: 'StreaMathCrew 2',
  crew3: 'StreaMathCrew 3', crew4: 'StreaMathCrew 4', go: 'StreaMathGo',
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AdminConoscitive() {
  const [conoscitive, setConoscitive] = useState<Conoscitiva[]>([]);
  const [selected, setSelected] = useState<Conoscitiva | null>(null);
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtri
  const [filtroStato, setFiltroStato] = useState<'tutti' | 'in_attesa' | 'completata'>('tutti');
  const [filtroModalita, setFiltroModalita] = useState<'tutti' | 'sincrona' | 'asincrona'>('tutti');

  // Form risposta
  const [testoRisposta, setTestoRisposta] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { loadConoscitive(); }, []);

  async function loadConoscitive() {
    setLoading(true);
    const { data } = await supabase
      .from('conoscitive')
      .select(`
        *,
        calendar_slots ( data_ora )
      `)
      .order('created_at', { ascending: false });
    if (data) setConoscitive(data);
    setLoading(false);
  }

  async function loadMessaggi(conoscitivaId: string) {
    const { data } = await supabase
      .from('conoscitive_messaggi')
      .select('*')
      .eq('conoscitiva_id', conoscitivaId)
      .order('created_at', { ascending: true });
    if (data) setMessaggi(data);
  }

  async function handleSelect(c: Conoscitiva) {
    if (selected?.id === c.id) {
      setSelected(null); setMessaggi([]); return;
    }
    setSelected(c);
    setTestoRisposta(''); setMediaUrl(''); setMsg('');
    await loadMessaggi(c.id);
  }

  async function handleRispondi() {
    if (!selected) return;
    if (!testoRisposta.trim() && !mediaUrl.trim()) {
      setMsg('⚠️ Inserisci un testo o un link media'); return;
    }
    setSaving(true); setMsg('');
    try {
      const { error } = await supabase.from('conoscitive_messaggi').insert({
        conoscitiva_id: selected.id,
        autore: 'admin',
        testo: testoRisposta.trim() || null,
        media_url: mediaUrl.trim() || null,
      });
      if (error) throw error;

      // Segna come completata
      await supabase.from('conoscitive')
        .update({ stato: 'completata' })
        .eq('id', selected.id);

      setMsg('✅ Risposta inviata!');
      setTestoRisposta(''); setMediaUrl('');
      await loadMessaggi(selected.id);
      await loadConoscitive();
      setSelected(prev => prev ? { ...prev, stato: 'completata' } : null);
    } catch (err: any) {
      setMsg(`❌ ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleElimina(c: Conoscitiva) {
    if (!confirm(`Eliminare definitivamente la conoscitiva di ${SERVIZIO_LABEL[c.servizio_interessato] ?? c.servizio_interessato}? L'azione non è reversibile.`)) return;
    await supabase.from('conoscitive_messaggi').delete().eq('conoscitiva_id', c.id);
    await supabase.from('conoscitive').delete().eq('id', c.id);
    setSelected(null);
    setMessaggi([]);
    await loadConoscitive();
  }

  // Filtro applicato
  const conoscitiveFiltrate = conoscitive.filter(c => {
    if (filtroStato !== 'tutti' && c.stato !== filtroStato) return false;
    if (filtroModalita !== 'tutti' && c.modalita !== filtroModalita) return false;
    return true;
  });

  const inAttesa = conoscitive.filter(c => c.stato === 'in_attesa').length;

  // ─── Stili ─────────────────────────────────────────────────────────────────

  const card: React.CSSProperties = {
    background: 'white', borderRadius: 12,
    border: '1px solid #e2e8f0', padding: '1.25rem',
    marginBottom: '0.75rem',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: '#64748b', marginBottom: 4,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    fontFamily: 'system-ui',
  };
  const inp: React.CSSProperties = {
    width: '100%', padding: '8px 12px',
    border: '1px solid #e2e8f0', borderRadius: 8,
    fontSize: 13, outline: 'none', background: 'white',
    boxSizing: 'border-box', fontFamily: 'system-ui',
  };

  if (loading) return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontFamily: 'system-ui' }}>
      Caricamento...
    </div>
  );

  return (
    <div>
      {/* Header con contatore */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: navy, fontFamily: 'system-ui' }}>
            Conoscitive
          </h2>
          {inAttesa > 0 && (
            <span style={{
              padding: '2px 10px', borderRadius: 20,
              background: bordeaux, color: 'white',
              fontSize: 11, fontWeight: 700, fontFamily: 'system-ui'
            }}>
              {inAttesa} in attesa
            </span>
          )}
        </div>

        {/* Filtri */}
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            style={{ ...inp, width: 'auto' }}
            value={filtroStato}
            onChange={e => setFiltroStato(e.target.value as any)}
          >
            <option value="tutti">Tutti gli stati</option>
            <option value="in_attesa">In attesa</option>
            <option value="completata">Completata</option>
          </select>
          <select
            style={{ ...inp, width: 'auto' }}
            value={filtroModalita}
            onChange={e => setFiltroModalita(e.target.value as any)}
          >
            <option value="tutti">Tutte le modalità</option>
            <option value="sincrona">Sincrona</option>
            <option value="asincrona">Asincrona</option>
          </select>
        </div>
      </div>

      {conoscitiveFiltrate.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#94a3b8', fontSize: 14, fontFamily: 'system-ui' }}>
          Nessuna conoscitiva trovata.
        </div>
      ) : (
        conoscitiveFiltrate.map(c => {
          const isSelected = selected?.id === c.id;
          const dataRichiesta = new Date(c.created_at).toLocaleDateString('it-IT', {
            day: '2-digit', month: '2-digit', year: 'numeric'
          });
          const slotData = c.calendar_slots?.data_ora
            ? new Date(c.calendar_slots.data_ora).toLocaleString('it-IT', {
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit'
              })
            : null;

          return (
            <div key={c.id}>
              {/* Card conoscitiva */}
              <div
                onClick={() => handleSelect(c)}
                style={{
                  ...card,
                  cursor: 'pointer',
                  border: `1.5px solid ${isSelected ? navy : c.stato === 'in_attesa' ? '#fbbf24' : '#e2e8f0'}`,
                  background: isSelected ? `${navy}05` : 'white',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>

                  {/* Info utente + servizio */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: navy, fontFamily: 'system-ui' }}>
                        Utente {c.user_id.substring(0, 8)}...
                      </span>
                      <span style={{
                        padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: '#eff6ff', color: '#1d4ed8', fontFamily: 'system-ui'
                      }}>
                        {SERVIZIO_LABEL[c.servizio_interessato] ?? c.servizio_interessato}
                      </span>
                      <span style={{
                        padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: c.modalita === 'sincrona' ? '#dcfce7' : '#fef3c7',
                        color: c.modalita === 'sincrona' ? '#166534' : '#92400e',
                        fontFamily: 'system-ui'
                      }}>
                        {c.modalita === 'sincrona' ? '📅 Sincrona' : '💬 Asincrona'}
                      </span>
                      <span style={{
                        padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: c.stato === 'in_attesa' ? '#fef3c7' : '#dcfce7',
                        color: c.stato === 'in_attesa' ? '#92400e' : '#166534',
                        fontFamily: 'system-ui'
                      }}>
                        {c.stato === 'in_attesa' ? '⏳ In attesa' : '✓ Completata'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#64748b', fontFamily: 'system-ui', flexWrap: 'wrap' }}>
                      {slotData && <span>📅 Slot: {slotData}</span>}
                      <span>Ricevuta il {dataRichiesta}</span>
                    </div>
                  </div>

                  {/* Freccia */}
                  <div style={{
                    fontSize: 16, color: '#94a3b8', transition: 'transform 0.15s',
                    transform: isSelected ? 'rotate(180deg)' : 'none'
                  }}>
                    ▾
                  </div>
                </div>
              </div>

              {/* Pannello dettaglio espanso */}
              {isSelected && (
                <div style={{
                  marginTop: -8, marginBottom: '0.75rem',
                  background: '#f8fafc', borderRadius: '0 0 12px 12px',
                  border: `1.5px solid ${navy}`, borderTop: 'none',
                  padding: '1.25rem',
                }}>

                  {/* Dati conoscitiva */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: '1.25rem' }}>
                    <div>
                      <label style={lbl}>Difficoltà percepita</label>
                      <div style={{
                        padding: '10px 12px', background: 'white', borderRadius: 8,
                        border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b',
                        fontFamily: 'system-ui', lineHeight: 1.6
                      }}>
                        {c.difficolta_percepita}
                      </div>
                    </div>
                    <div>
                      <label style={lbl}>Aspettative</label>
                      <div style={{
                        padding: '10px 12px', background: 'white', borderRadius: 8,
                        border: '1px solid #e2e8f0', fontSize: 13, color: '#1e293b',
                        fontFamily: 'system-ui', lineHeight: 1.6
                      }}>
                        {c.aspettative}
                      </div>
                    </div>
                  </div>

                  {/* Messaggi esistenti */}
                  {messaggi.length > 0 && (
                    <div style={{ marginBottom: '1.25rem' }}>
                      <label style={lbl}>Conversazione</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {messaggi.map(m => (
                          <div key={m.id} style={{
                            padding: '10px 14px', borderRadius: 10,
                            background: m.autore === 'admin' ? `${navy}10` : 'white',
                            border: `1px solid ${m.autore === 'admin' ? `${navy}30` : '#e2e8f0'}`,
                            alignSelf: m.autore === 'admin' ? 'flex-end' : 'flex-start',
                            maxWidth: '85%',
                          }}>
                            <div style={{
                              fontSize: 10, fontWeight: 700, color: m.autore === 'admin' ? navy : '#64748b',
                              marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em',
                              fontFamily: 'system-ui'
                            }}>
                              {m.autore === 'admin' ? 'Tu' : 'Studente'} · {new Date(m.created_at).toLocaleDateString('it-IT')}
                            </div>
                            {m.testo && (
                              <div style={{ fontSize: 13, color: '#1e293b', fontFamily: 'system-ui', lineHeight: 1.6 }}>
                                {m.testo}
                              </div>
                            )}
                            {m.media_url && (
                              <a
                                href={m.media_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  marginTop: m.testo ? 6 : 0,
                                  fontSize: 12, color: navy, fontFamily: 'system-ui',
                                  fontWeight: 600, textDecoration: 'none',
                                  padding: '4px 10px', background: `${navy}15`,
                                  borderRadius: 6
                                }}
                              >
                                🎬 Guarda il video/audio
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Form risposta (solo per asincrone o se vuoi aggiungere messaggi) */}
                  <div>
                    <label style={lbl}>
                      {c.modalita === 'asincrona' ? 'Invia risposta' : 'Aggiungi nota'}
                    </label>
                    <textarea
                      style={{ ...inp, minHeight: 80, resize: 'vertical', marginBottom: 8 } as React.CSSProperties}
                      value={testoRisposta}
                      onChange={e => setTestoRisposta(e.target.value)}
                      placeholder={
                        c.modalita === 'asincrona'
                          ? 'Scrivi la tua risposta allo studente...'
                          : 'Note post-sessione...'
                      }
                    />
                    <div style={{ marginBottom: 10 }}>
                      <label style={lbl}>Link video/audio (opzionale)</label>
                      <input
                        style={inp}
                        value={mediaUrl}
                        onChange={e => setMediaUrl(e.target.value)}
                        placeholder="https://... (YouTube, Loom, Drive...)"
                      />
                    </div>

                    {msg && (
                      <div style={{
                        padding: '8px 12px', borderRadius: 8, marginBottom: 10,
                        fontSize: 12, fontWeight: 600, fontFamily: 'system-ui',
                        background: msg.startsWith('✅') ? '#dcfce7' : msg.startsWith('⚠️') ? '#fef3c7' : '#fee2e2',
                        color: msg.startsWith('✅') ? '#166534' : msg.startsWith('⚠️') ? '#92400e' : '#dc2626',
                      }}>
                        {msg}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleRispondi}
                        disabled={saving}
                        style={{
                          padding: '8px 20px', background: saving ? '#94a3b8' : navy,
                          color: 'white', border: 'none', borderRadius: 8,
                          fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
                          fontFamily: 'system-ui'
                        }}
                      >
                        {saving ? 'Invio...' : c.modalita === 'asincrona' ? '↩ Rispondi' : '+ Aggiungi nota'}
                      </button>
                      {c.stato === 'in_attesa' && (
                        <button
                          onClick={async () => {
                            await supabase.from('conoscitive').update({ stato: 'completata' }).eq('id', c.id);
                            await loadConoscitive();
                            setSelected(prev => prev ? { ...prev, stato: 'completata' } : null);
                          }}
                          style={{
                            padding: '8px 20px', background: '#dcfce7', color: '#166534',
                            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
                            cursor: 'pointer', fontFamily: 'system-ui'
                          }}
                        >
                          ✓ Segna completata
                        </button>
                      )}
                      <button
                        onClick={() => handleElimina(c)}
                        style={{
                          padding: '8px 20px', background: '#7f1d1d', color: 'white',
                          border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
                          cursor: 'pointer', fontFamily: 'system-ui', marginLeft: 'auto'
                        }}
                      >
                        🗑 Elimina
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}