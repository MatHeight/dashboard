import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import styles from './RegistrationForm.module.css'

const ID_LOGICO_MAP = {
  LICEO6: 1,
  LICEO5: 2,
  AFM: 3,
  CAT: 4,
  ITT: 5,
  AGRARIO: 6,
  PROFESSIONALE: 7,
  MEDIE: 8,
  MEDIE_FRANCESE: 9,
  MEDIE_SPAGNOLO: 10,
  MEDIE_TEDESCO: 11,
  ELEMENTARI: 12
}

const INDIRIZZI = {
  liceo: [
    { label: 'Liceo classico', value: 'LICEO5' },
    {
      label: 'Liceo scientifico',
      sottocategorie: [
        { label: 'Liceo scientifico tradizionale', value: 'LICEO6' },
        { label: 'Liceo scientifico sportivo', value: 'LICEO6' },
        { label: 'Liceo Scienze Applicate', value: 'LICEO6' }
      ]
    },
    { label: 'Liceo linguistico', value: 'LICEO5' },
    {
      label: 'Liceo delle scienze umane',
      sottocategorie: [
        { label: 'Liceo delle scienze umane', value: 'LICEO5' },
        { label: 'Opzione economico-sociale', value: 'LICEO5' }
      ]
    },
    { label: 'Liceo artistico', value: 'LICEO5' },
    { label: 'Liceo musicale e coreutico', value: 'LICEO5' },
    { label: 'Made in Italy', value: 'LICEO5' }
  ],
  tecnico: [
    {
      label: 'Amministrazione, Finanza e Marketing',
      sottocategorie: [
        { label: 'Amministrazione, Finanza e Marketing (AFM)', value: 'AFM' },
        { label: 'Relazioni Internazionali per il Marketing (RIM)', value: 'AFM' },
        { label: 'Sistemi Informativi Aziendali (SIA)', value: 'AFM' }
      ]
    },
    { label: 'Turismo', value: 'ITT' },
    { label: 'Meccanica, Meccatronica ed Energia', value: 'ITT' },
    { label: 'Trasporti e Logistica', value: 'ITT' },
    { label: 'Elettronica ed Elettrotecnica', value: 'ITT' },
    { label: 'Informatica e Telecomunicazioni', value: 'ITT' },
    { label: 'Grafica e Comunicazione', value: 'ITT' },
    { label: 'Chimica, Materiali e Biotecnologie', value: 'ITT' },
    { label: 'Costruzioni, Ambiente e Territorio', value: 'CAT' },
    { label: 'Agraria, Agroalimentare e Agroindustria', value: 'AGRARIO' },
    { label: 'Sistema Moda', value: 'ITT' }
  ],
  professionale: [
    { label: 'Agricoltura, sviluppo rurale e valorizzazione prodotti', value: 'PROFESSIONALE' },
    { label: 'Pesca commerciale e produzioni ittiche', value: 'PROFESSIONALE' },
    { label: 'Industria e artigianato per il Made in Italy', value: 'PROFESSIONALE' },
    { label: 'Manutenzione e assistenza tecnica', value: 'PROFESSIONALE' },
    { label: 'Gestione delle acque e risanamento ambientale', value: 'PROFESSIONALE' },
    { label: "Servizi per l'agricoltura e lo sviluppo rurale", value: 'PROFESSIONALE' },
    { label: 'Servizi commerciali', value: 'PROFESSIONALE' },
    { label: 'Enogastronomia e ospitalità alberghiera', value: 'PROFESSIONALE' },
    { label: 'Servizi di sala e vendita', value: 'PROFESSIONALE' },
    { label: 'Produzioni industriali e artigianali', value: 'PROFESSIONALE' },
    { label: 'Abbigliamento e moda', value: 'PROFESSIONALE' }
  ],
  medie: [
    { label: 'Medie', value: 'MEDIE' },
    { label: 'Medie con seconda lingua comunitaria Francese', value: 'MEDIE_FRANCESE' },
    { label: 'Medie con seconda lingua comunitaria Spagnolo', value: 'MEDIE_SPAGNOLO' },
    { label: 'Medie con seconda lingua comunitaria Tedesco', value: 'MEDIE_TEDESCO' }
  ]
}

const STEP_LABELS = ['Dati personali', 'Tipo di scuola', 'Indirizzo', 'Conferma']

export default function RegistrationForm() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    nome: '',
    classe: '',
    macroCategoria: '',
    indirizzoLabel: '',
    sottocategoriaLabel: '',
    indirizzo_reale: '',
    id_logico: null
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showSottocategorie, setShowSottocategorie] = useState(false)

  useEffect(() => {
    loadSession()
  }, [])

  async function loadSession() {
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      navigate('/')
      return
    }

    try {
      const { data: profilo } = await supabase
        .from('profili_utenti')
        .select('nome')
        .eq('id', session.user.id)
        .single()
      
      if (profilo?.nome) {
        setForm(f => ({ ...f, nome: profilo.nome }))
      }
    } catch (err) {
      console.log('Nome non disponibile:', err)
    }

    setSession(session)
    setLoading(false)
  }

  const currentSottocategorie = INDIRIZZI[form.macroCategoria]
    ?.find(i => i.label === form.indirizzoLabel)
    ?.sottocategorie || []

  const handleDatiPersonali = () => {
    if (!form.nome.trim()) return setError('Inserisci il tuo nome')
    if (!form.classe || form.classe < 1) return setError('Inserisci un numero di classe valido')
    setError('')
    setStep(2)
  }

  const handleMacroCategoria = (cat) => {
    setForm(f => ({ ...f, macroCategoria: cat, indirizzoLabel: '', sottocategoriaLabel: '', indirizzo_reale: '', id_logico: null }))
    if (cat === 'elementari') {
      setForm(f => ({ 
        ...f, 
        macroCategoria: 'elementari', 
        indirizzoLabel: 'Scuola elementare', 
        indirizzo_reale: 'Scuola elementare', 
        id_logico: 12 
      }))
      setStep(4)
    } else {
      setStep(3)
    }
  }

  const handleIndirizzo = (indirizzo) => {
    if (indirizzo.sottocategorie) {
      setForm(f => ({ ...f, indirizzoLabel: indirizzo.label, indirizzo_reale: '', id_logico: null }))
      setShowSottocategorie(true)
    } else {
      setForm(f => ({
        ...f,
        indirizzoLabel: indirizzo.label,
        sottocategoriaLabel: '',
        indirizzo_reale: indirizzo.label,
        id_logico: ID_LOGICO_MAP[indirizzo.value]
      }))
      setShowSottocategorie(false)
      setStep(4)
    }
  }

  const handleSottocategoria = (sotto) => {
    setForm(f => ({
      ...f,
      sottocategoriaLabel: sotto.label,
      indirizzo_reale: sotto.label,
      id_logico: ID_LOGICO_MAP[sotto.value]
    }))
    setShowSottocategorie(false)
    setStep(4)
  }

  const handleSubmit = async () => {
    if (!session) {
      setError('Sessione non trovata')
      return
    }

    setSaving(true)
    setError('')
    
    try {
      console.log('Dati da salvare:', {
        nome: form.nome.trim(),
        classe: parseInt(form.classe),
        indirizzo_reale: form.indirizzo_reale,
        id_logico: form.id_logico
      })

      const { error: updateError } = await supabase
        .from('profili_utenti')
        .update({
          nome: form.nome.trim(),
          classe: parseInt(form.classe),
          indirizzo_reale: form.indirizzo_reale,
          id_logico: form.id_logico
        })
        .eq('id', session.user.id)

      if (updateError) throw updateError

      navigate('/dashboard')
    } catch (err) {
      console.error('Errore salvataggio:', err)
      setError(err.message || 'Errore durante il salvataggio. Riprova.')
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.stepContent}>
            <h2 className={styles.title}>Caricamento...</h2>
            <p className={styles.subtitle}>Verifica sessione in corso</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${(step / 4) * 100}%` }} />
          </div>
          <div className={styles.stepLabels}>
            {STEP_LABELS.map((label, i) => (
              <span key={i} className={`${styles.stepLabel} ${i + 1 === step ? styles.stepLabelActive : ''}`}>
                {label}
              </span>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className={styles.stepContent}>
            <h2 className={styles.title}>Dati personali</h2>
            <p className={styles.subtitle}>Inserisci le tue informazioni di base</p>

            <div className={styles.field}>
              <label className={styles.label}>Nome</label>
              <input
                className={styles.input}
                type="text"
                placeholder="Es. Mario"
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Classe</label>
              <input
                className={styles.input}
                type="number"
                placeholder="Es. 3"
                min="1"
                max="5"
                value={form.classe}
                onChange={e => setForm(f => ({ ...f, classe: e.target.value }))}
              />
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button className={styles.btnPrimary} onClick={handleDatiPersonali}>
              Continua →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className={styles.stepContent}>
            <h2 className={styles.title}>Tipo di scuola</h2>
            <p className={styles.subtitle}>Seleziona la categoria che ti appartiene</p>

            <div className={styles.optionList}>
              {['Liceo', 'Tecnico', 'Professionale', 'Medie', 'Elementari'].map(cat => (
                <button
                  key={cat}
                  className={styles.optionBtn}
                  onClick={() => handleMacroCategoria(cat.toLowerCase())}
                >
                  {cat}
                </button>
              ))}
            </div>

            <button className={styles.btnBack} onClick={() => setStep(1)}>← Indietro</button>
          </div>
        )}

        {step === 3 && (
          <div className={styles.stepContent}>
            <h2 className={styles.title}>
              {!showSottocategorie ? 'Indirizzo di studio' : form.indirizzoLabel}
            </h2>
            <p className={styles.subtitle}>
              {!showSottocategorie ? 'Seleziona il tuo indirizzo' : 'Seleziona la tua articolazione'}
            </p>

            <div className={styles.optionList}>
              {!showSottocategorie
                ? INDIRIZZI[form.macroCategoria]?.map((ind, i) => (
                    <button key={i} className={styles.optionBtn} onClick={() => handleIndirizzo(ind)}>
                      {ind.label}
                      {ind.sottocategorie && <span className={styles.arrow}> ›</span>}
                    </button>
                  ))
                : currentSottocategorie.map((sotto, i) => (
                    <button key={i} className={styles.optionBtn} onClick={() => handleSottocategoria(sotto)}>
                      {sotto.label}
                    </button>
                  ))
              }
            </div>

            <button
              className={styles.btnBack}
              onClick={() => {
                if (showSottocategorie) {
                  setShowSottocategorie(false)
                } else {
                  setStep(2)
                }
              }}
            >
              ← Indietro
            </button>
          </div>
        )}

        {step === 4 && (
          <div className={styles.stepContent}>
            <h2 className={styles.title}>Conferma i tuoi dati</h2>
            <p className={styles.subtitle}>Verifica prima di completare l'iscrizione</p>

            <div className={styles.recap}>
              <div className={styles.recapRow}>
                <span className={styles.recapLabel}>Nome</span>
                <span className={styles.recapValue}>{form.nome}</span>
              </div>
              <div className={styles.recapRow}>
                <span className={styles.recapLabel}>Classe</span>
                <span className={styles.recapValue}>{form.classe}</span>
              </div>
              <div className={styles.recapRow}>
                <span className={styles.recapLabel}>Indirizzo</span>
                <span className={styles.recapValue}>
                  {form.sottocategoriaLabel || form.indirizzoLabel}
                </span>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button className={styles.btnPrimary} onClick={handleSubmit} disabled={saving}>
              {saving ? 'Salvataggio...' : 'Completa iscrizione ✓'}
            </button>

            <button className={styles.btnBack} onClick={() => {
              if (form.macroCategoria === 'elementari') setStep(2)
              else setStep(3)
            }}>
              ← Modifica
            </button>
          </div>
        )}
      </div>
    </div>
  )
}