import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface Conoscitiva {
  id: string;
  servizio_interessato: string;
  difficolta_percepita: string;
  aspettative: string;
  modalita: 'sincrona' | 'asincrona';
  stato: 'in_attesa' | 'completata';
  slot_id: string | null;
  created_at: string;
  calendar_slots?: { data_ora: string } | null;
}

interface Messaggio {
  id: string;
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

export default function MieConoscitive() {
  const [conoscitive, setConoscitive] = useState<Conoscitiva[]>([]);
  const [selected, setSelected] = useState<Conoscitiva | null>(null);
  const [messaggi, setMessaggi] = useState<Messaggio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadConoscitive(); }, []);

  async function loadConoscitive() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('conoscitive')
      .select('*, calendar_slots ( data_ora )')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (data) setConoscitive(data);
    setLoading(false);
  }

  async function handleSelect(c: Conoscitiva) {
    if (selected?.id === c.id) { setSelected(null); setMessaggi([]); return; }
    setSelected(c);
    const { data } = await supabase
      .from('conoscitive_messaggi')
      .select('*')
      .eq('conoscitiva_id', c.id)
      .order('created_at', { ascending: true });
    if (data) setMessaggi(data);
  }

  if (loading) return null;

  if (conoscitive.length === 0) return null;

  return (
    <div>
      <h3 style={{
        fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
        fontFamily: 'system-ui', margin: '0 0 1rem',
        letterSpacing: '-0.01em'
      }}>
        Le mie conoscitive
      </h3>

      {conoscitive.map(c => {
        const isSelected = selected?.id === c.id;
        const dataRichiesta = new Date(c.created_at).toLocaleDateString('it-IT', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
        const slotData = c.calendar_slots?.data_ora
          ? new Date(c.calendar_slots.data_ora).toLocaleString('it-IT', {
              day: '2-digit', month: '2-digit',
              hour: '2-digit', minute: '2-digit'
            })
          : null;

        const haRisposta = messaggi.some(m => m.autore === 'admin') && isSelected;
        const nuovaRisposta = c.stato === 'completata' && c.modalita === 'asincrona';

        return (
          <div key={c.id} style={{ marginBottom: 8 }}>
            {/* Card */}
            <div
              onClick={() => handleSelect(c)}
              style={{
                padding: '14px 16px', borderRadius: isSelected ? '12px 12px 0 0' : 12,
                background: isSelected
                  ? 'rgba(255,255,255,0.15)'
                  : 'rgba(255,255,255,0.07)',
                border: `1.5px solid ${isSelected ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                cursor: 'pointer', transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: 'rgba(255,255,255,0.95)', fontFamily: 'system-ui'
                    }}>
                      {SERVIZIO_LABEL[c.servizio_interessato] ?? c.servizio_interessato}
                    </span>
                    <span style={{
                      padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                      background: c.modalita === 'sincrona' ? 'rgba(34,197,94,0.2)' : 'rgba(251,191,36,0.2)',
                      color: c.modalita === 'sincrona' ? '#86efac' : '#fde68a',
                      fontFamily: 'system-ui'
                    }}>
                      {c.modalita === 'sincrona' ? '📅 Dal vivo' : '💬 In differita'}
                    </span>
                    {nuovaRisposta && !isSelected && (
                      <span style={{
                        padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                        background: 'rgba(107,31,61,0.4)', color: '#fda4af',
                        fontFamily: 'system-ui', animation: 'pulse 2s infinite'
                      }}>
                        🔔 Risposta ricevuta
                      </span>
                    )}
                    {c.stato === 'completata' && (
                      <span style={{
                        padding: '1px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                        background: 'rgba(34,197,94,0.15)', color: '#86efac',
                        fontFamily: 'system-ui'
                      }}>
                        ✓ Completata
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'system-ui' }}>
                    {slotData ? `Slot: ${slotData} · ` : ''}
                    Richiesta il {dataRichiesta}
                  </div>
                </div>
                <div style={{
                  fontSize: 14, color: 'rgba(255,255,255,0.4)',
                  transition: 'transform 0.15s',
                  transform: isSelected ? 'rotate(180deg)' : 'none'
                }}>
                  ▾
                </div>
              </div>
            </div>

            {/* Dettaglio espanso */}
            {isSelected && (
              <div style={{
                padding: '1.25rem',
                background: 'rgba(255,255,255,0.05)',
                border: '1.5px solid rgba(255,255,255,0.3)',
                borderTop: 'none',
                borderRadius: '0 0 12px 12px',
              }}>

                {/* Riepilogo richiesta */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1.25rem' }}>
                  {[
                    { label: 'La tua difficoltà', value: c.difficolta_percepita },
                    { label: 'Le tue aspettative', value: c.aspettative },
                  ].map(item => (
                    <div key={item.label}>
                      <div style={{
                        fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        fontFamily: 'system-ui', marginBottom: 4
                      }}>
                        {item.label}
                      </div>
                      <div style={{
                        fontSize: 13, color: 'rgba(255,255,255,0.8)',
                        fontFamily: 'system-ui', lineHeight: 1.6
                      }}>
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Messaggi */}
                {messaggi.length === 0 ? (
                  <div style={{
                    padding: '1rem', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px dashed rgba(255,255,255,0.15)',
                    textAlign: 'center',
                  }}>
                    {c.modalita === 'asincrona' ? (
                      <div>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'system-ui' }}>
                          La tua risposta arriverà entro <strong style={{ color: 'rgba(255,255,255,0.85)' }}>72 ore</strong>
                        </div>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: 'system-ui' }}>
                        Nessun messaggio per questa conoscitiva.
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      fontFamily: 'system-ui', marginBottom: 8
                    }}>
                      Risposta
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {messaggi.map(m => (
                        <div key={m.id} style={{
                          padding: '12px 14px', borderRadius: 10,
                          background: m.autore === 'admin'
                            ? `linear-gradient(135deg, ${navy}cc, ${bordeaux}44)`
                            : 'rgba(255,255,255,0.08)',
                          border: `1px solid ${m.autore === 'admin' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'}`,
                        }}>
                          <div style={{
                            fontSize: 10, fontWeight: 700,
                            color: m.autore === 'admin' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.35)',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                            fontFamily: 'system-ui', marginBottom: 6
                          }}>
                            {m.autore === 'admin' ? '👨‍🏫 Risposta del docente' : 'Tu'} · {new Date(m.created_at).toLocaleDateString('it-IT')}
                          </div>
                          {m.testo && (
                            <div style={{
                              fontSize: 13, color: 'rgba(255,255,255,0.88)',
                              fontFamily: 'system-ui', lineHeight: 1.7
                            }}>
                              {m.testo}
                            </div>
                          )}
                          {m.media_url && (
                            <a
                              href={m.media_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                marginTop: m.testo ? 10 : 0,
                                padding: '7px 14px',
                                background: 'rgba(255,255,255,0.15)',
                                borderRadius: 8, fontSize: 12, fontWeight: 700,
                                color: 'white', textDecoration: 'none',
                                fontFamily: 'system-ui', transition: 'background 0.15s'
                              }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.25)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
                            >
                              🎬 Guarda il video/audio
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}