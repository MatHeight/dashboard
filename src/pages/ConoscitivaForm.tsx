import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import CalendarView from '../components/CalendarView';

// ─── Tipi ─────────────────────────────────────────────────────────────────────

interface Props {
  servizio: string;
  onComplete: () => void;
}

// ─── Costanti ─────────────────────────────────────────────────────────────────

const navy    = '#1a2332';
const bordeaux = '#6b1f3d';

const SERVIZIO_LABEL: Record<string, string> = {
  one:   'StreaMathOne',
  crew2: 'StreaMathCrew',
  crew3: 'StreaMathCrew',
  crew4: 'StreaMathCrew',
  go:    'StreaMathGo',
};

// ─── Stili ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    background: `linear-gradient(160deg, ${navy} 0%, #2d3e50 60%, ${bordeaux}33 100%)`,
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '3rem 1rem',
    fontFamily: "'Georgia', 'Times New Roman', serif",
  } as React.CSSProperties,

  card: {
    background: 'rgba(255,255,255,0.97)',
    borderRadius: 20,
    padding: '2.5rem 2rem',
    width: '100%',
    boxShadow: '0 20px 60px rgba(26,35,50,0.35)',
    position: 'relative' as const,
    overflow: 'hidden',
  } as React.CSSProperties,

  accent: {
    position: 'absolute' as const,
    top: 0, left: 0, right: 0,
    height: 4,
    background: `linear-gradient(90deg, ${navy}, ${bordeaux})`,
  } as React.CSSProperties,

  label: {
    display: 'block',
    fontSize: 11, fontWeight: 700, color: '#64748b',
    marginBottom: 6, textTransform: 'uppercase' as const,
    letterSpacing: '0.07em', fontFamily: 'system-ui',
  } as React.CSSProperties,

  textarea: {
    width: '100%', padding: '10px 14px',
    border: '1.5px solid #e2e8f0', borderRadius: 10,
    fontSize: 14, outline: 'none', background: 'white',
    boxSizing: 'border-box' as const, resize: 'vertical' as const,
    fontFamily: 'system-ui', lineHeight: 1.6, minHeight: 90,
    transition: 'border-color 0.15s',
  } as React.CSSProperties,

  btnPrimary: {
    width: '100%', padding: '13px',
    background: `linear-gradient(135deg, ${navy}, #2d3e50)`,
    color: 'white', border: 'none', borderRadius: 12,
    fontWeight: 700, fontSize: 15, cursor: 'pointer',
    fontFamily: 'system-ui', letterSpacing: '0.02em',
    marginTop: 8,
  } as React.CSSProperties,
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function ConoscitivaForm({ servizio, onComplete }: Props) {
  const [difficolta, setDifficolta] = useState('');
  const [aspettative, setAspettative] = useState('');
  const [modalita, setModalita] = useState<'sincrona' | 'asincrona' | ''>('');
  const [domande, setDomande] = useState('');
  const [conoscitivaId, setConoscitivaId] = useState<string | null>(null);
  const [mostraCalendario, setMostraCalendario] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errore, setErrore] = useState('');

  const nomeServizio = SERVIZIO_LABEL[servizio] ?? servizio;

  useEffect(() => { checkEsistente(); }, [servizio]);

  async function checkEsistente() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase
      .from('conoscitive')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('servizio_interessato', servizio)
      .maybeSingle();
    if (data) onComplete();
  }

  async function handleSubmit() {
    if (!difficolta.trim() || !aspettative.trim() || !modalita) {
      setErrore('Compila tutti i campi prima di continuare.');
      return;
    }
    if (modalita === 'asincrona' && !domande.trim()) {
      setErrore('Scrivi almeno una domanda per la modalità in differita.');
      return;
    }

    setSaving(true); setErrore('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sessione non trovata');

      // Salva conoscitiva
      const { data, error } = await supabase
        .from('conoscitive')
        .insert({
          user_id: session.user.id,
          servizio_interessato: servizio,
          difficolta_percepita: difficolta.trim(),
          aspettative: aspettative.trim(),
          modalita,
          stato: 'in_attesa',
        })
        .select('id')
        .single();

      if (error) throw error;
      setConoscitivaId(data.id);

      if (modalita === 'asincrona') {
        // Salva le domande come primo messaggio
        await supabase.from('conoscitive_messaggi').insert({
          conoscitiva_id: data.id,
          autore: 'utente',
          testo: domande.trim(),
        });
        onComplete();
      } else {
        // Sincrona → mostra calendario sotto
        setMostraCalendario(true);
      }
    } catch (err: any) {
      setErrore(`Errore: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleSlotPrenotato() {
    if (conoscitivaId) {
      await supabase
        .from('conoscitive')
        .update({ stato: 'completata' })
        .eq('id', conoscitivaId);
    }
    onComplete();
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={s.page}>
      <div style={{
        ...s.card,
        maxWidth: mostraCalendario ? 820 : 600,
        transition: 'max-width 0.3s ease',
      }}>
        <div style={s.accent} />

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-block', padding: '3px 12px',
            background: `${bordeaux}15`, borderRadius: 20,
            fontSize: 11, fontWeight: 700, color: bordeaux,
            fontFamily: 'system-ui', letterSpacing: '0.06em',
            textTransform: 'uppercase', marginBottom: 12
          }}>
            {nomeServizio}
          </div>
          <h1 style={{
            fontSize: 22, fontWeight: 700, color: navy,
            margin: '0 0 8px', lineHeight: 1.2, letterSpacing: '-0.02em'
          }}>
            {mostraCalendario ? 'Scegli una data per il tuo incontro' : 'Prima di iniziare'}
          </h1>
          <p style={{
            fontSize: 14, color: '#64748b', margin: 0,
            fontFamily: 'system-ui', lineHeight: 1.6
          }}>
            {mostraCalendario
              ? 'Seleziona uno slot disponibile — l\'incontro è gratuito e senza impegno'
              : 'Raccontaci la tua situazione per prepararci al meglio.'
            }
          </p>
        </div>

        {/* Calendario (solo sincrona dopo submit) */}
        {mostraCalendario ? (
          <CalendarView
            isAdmin={false}
            filtroServizio="conoscitiva"
            onBookingConfirmata={handleSlotPrenotato}
          />
        ) : (
          <>
            {/* Difficoltà */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={s.label}>Qual è la tua difficoltà principale? *</label>
              <textarea
                style={{ ...s.textarea, borderColor: difficolta ? '#cbd5e1' : '#e2e8f0' }}
                value={difficolta}
                onChange={e => setDifficolta(e.target.value)}
                placeholder="Es. Faccio fatica con le equazioni, non capisco i passaggi logici..."
                onFocus={e => (e.currentTarget.style.borderColor = navy)}
                onBlur={e => (e.currentTarget.style.borderColor = difficolta ? '#cbd5e1' : '#e2e8f0')}
              />
            </div>

            {/* Aspettative */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={s.label}>Cosa ti aspetti da questo percorso? *</label>
              <textarea
                style={{ ...s.textarea, borderColor: aspettative ? '#cbd5e1' : '#e2e8f0' }}
                value={aspettative}
                onChange={e => setAspettative(e.target.value)}
                placeholder="Es. Voglio capire i concetti, non solo memorizzare le formule..."
                onFocus={e => (e.currentTarget.style.borderColor = navy)}
                onBlur={e => (e.currentTarget.style.borderColor = aspettative ? '#cbd5e1' : '#e2e8f0')}
              />
            </div>

            {/* Modalità */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={s.label}>Come preferisci fare l'incontro conoscitivo? *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                {[
                  {
                    value: 'sincrona',
                    titolo: '📅 Dal vivo',
                    desc: 'Prenoti uno slot e ci incontriamo in videochiamata'
                  },
                  {
                    value: 'asincrona',
                    titolo: '💬 In differita',
                    desc: 'Scrivi le tue domande, rispondo entro 72h con un video/audio'
                  }
                ].map(opt => (
                  <div
                    key={opt.value}
                    onClick={() => { setModalita(opt.value as 'sincrona' | 'asincrona'); setErrore(''); }}
                    style={{
                      padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${modalita === opt.value ? navy : '#e2e8f0'}`,
                      background: modalita === opt.value ? `${navy}08` : 'white',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 700, color: navy, fontFamily: 'system-ui', marginBottom: 4 }}>
                      {opt.titolo}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'system-ui', lineHeight: 1.4 }}>
                      {opt.desc}
                    </div>
                    {modalita === opt.value && (
                      <div style={{
                        marginTop: 8, display: 'flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 700, color: navy, fontFamily: 'system-ui'
                      }}>
                        <div style={{
                          width: 14, height: 14, borderRadius: '50%',
                          background: navy, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 8, color: 'white'
                        }}>✓</div>
                        Selezionato
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Domande — appare solo se asincrona */}
            {modalita === 'asincrona' && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '16px',
                background: `${navy}05`,
                borderRadius: 12,
                border: `1.5px solid ${navy}20`,
                animation: 'fadeIn 0.2s ease'
              }}>
                <label style={s.label}>Le tue domande *</label>
                <textarea
                  style={{ ...s.textarea, minHeight: 120, borderColor: domande ? '#cbd5e1' : '#e2e8f0' }}
                  value={domande}
                  onChange={e => setDomande(e.target.value)}
                  placeholder="Scrivi qui le tue domande o dubbi specifici. Risponderò con un video o audio entro 72 ore..."
                  onFocus={e => (e.currentTarget.style.borderColor = navy)}
                  onBlur={e => (e.currentTarget.style.borderColor = domande ? '#cbd5e1' : '#e2e8f0')}
                />
                <p style={{ fontSize: 12, color: '#94a3b8', fontFamily: 'system-ui', margin: '6px 0 0', lineHeight: 1.5 }}>
                  La risposta apparirà nella tua dashboard entro 72 ore.
                </p>
              </div>
            )}

            {/* Errore */}
            {errore && (
              <div style={{
                padding: '10px 14px', background: '#fef2f2', borderRadius: 8,
                fontSize: 13, color: '#dc2626', fontFamily: 'system-ui',
                marginBottom: 12, border: '1px solid #fecaca'
              }}>
                {errore}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={saving || !modalita}
              style={{
                ...s.btnPrimary,
                opacity: saving || !modalita ? 0.6 : 1,
                cursor: saving || !modalita ? 'not-allowed' : 'pointer'
              }}
            >
              {saving
                ? 'Salvataggio...'
                : modalita === 'sincrona'
                  ? 'Scegli la data →'
                  : modalita === 'asincrona'
                    ? 'Invia le domande →'
                    : 'Continua →'
              }
            </button>

            <p style={{
              textAlign: 'center', fontSize: 12, color: '#94a3b8',
              fontFamily: 'system-ui', marginTop: 12, marginBottom: 0
            }}>
              Puoi fare una sola conoscitiva per servizio
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}