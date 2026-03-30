import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface FormStudioProps {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export default function FormStudio({ userId, onClose, onSuccess }: FormStudioProps) {
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [materie, setMaterie] = useState<string[]>([])
  const [argomenti, setArgomenti] = useState<string[]>([])
  const profiloRef = useRef<{ classe: number; id_logico: number } | null>(null)

  const [formData, setFormData] = useState({
    materia: '',
    argomento: '',
    dettagli: '',
    data_ora: new Date().toISOString().slice(0, 16),
  })

  useEffect(() => {
    loadMaterie()
  }, [])

  useEffect(() => {
    if (formData.materia) {
      loadArgomenti(formData.materia)
    } else {
      setArgomenti([])
    }
  }, [formData.materia])

  const loadMaterie = async () => {
    try {
      const { data: profilo, error: profiloError } = await supabase
        .from('profili_utenti')
        .select('classe, id_logico')
        .eq('id', userId)
        .single()

      if (profiloError) throw profiloError
      profiloRef.current = profilo

      // Query diretta su programmi_didattici_base per classe e indirizzo logico
      const { data: programmiBase, error: baseError } = await supabase
        .from('programmi_didattici_base')
        .select('materia')
        .eq('classe', profilo.classe)
        .eq('ind_logico', profilo.id_logico)

      if (baseError) throw baseError

      const materieList = [...new Set((programmiBase || []).map((p: any) => p.materia))]
      setMaterie(materieList.sort())
    } catch (error) {
      console.error('Errore caricamento materie:', error)
      alert('Errore nel caricamento delle materie')
    } finally {
      setLoadingData(false)
    }
  }

  const loadArgomenti = async (materia: string) => {
    try {
      const profilo = profiloRef.current
      if (!profilo) return

      // Prima controlla programmi_didattici personalizzati
      const { data: programmiPers } = await supabase
        .from('programmi_didattici')
        .select('dati')
        .eq('utente_id', userId)
        .maybeSingle()

      if (programmiPers?.dati?.discipline) {
        const disciplina = programmiPers.dati.discipline.find(
          (d: any) => d.materia?.trim().toUpperCase() === materia.trim().toUpperCase()
        )
        if (disciplina?.argomenti && disciplina.argomenti.trim() !== '') {
          const argomentiList = disciplina.argomenti
            .split(',')
            .map((a: string) => a.trim())
            .filter((a: string) => a !== '')
          setArgomenti(argomentiList)
          return
        }
      }

      // Fallback: programmi_didattici_base
      const { data: programmaBase } = await supabase
        .from('programmi_didattici_base')
        .select('programma_json')
        .eq('classe', profilo.classe)
        .eq('ind_logico', profilo.id_logico)
        .eq('materia', materia)
        .maybeSingle()

      if (programmaBase?.programma_json) {
        const argomentiList = Array.isArray(programmaBase.programma_json)
          ? programmaBase.programma_json.map((arg: any) =>
              typeof arg === 'string' ? arg : arg.titolo
            )
          : []
        setArgomenti(argomentiList)
      } else {
        setArgomenti([])
      }
    } catch (error) {
      console.error('Errore caricamento argomenti:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: attivita, error: attivitaError } = await supabase
        .from('diario_attivita')
        .insert({
          user_id: userId,
          tipo_attivita: 'studio',
          data_ora: formData.data_ora,
        })
        .select()
        .single()

      if (attivitaError) throw attivitaError

      const { error: studioError } = await supabase
        .from('diario_studio')
        .insert({
          id: attivita.id,
          materia: formData.materia,
          argomento: formData.argomento,
          dettagli: formData.dettagli || null,
        })

      if (studioError) throw studioError

      onSuccess()
    } catch (error) {
      console.error('Errore salvataggio:', error)
      alert('Errore nel salvataggio. Riprova.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px',
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px',
          borderBottom: '2px solid #e5e7eb',
          background: 'linear-gradient(to right, #3b82f6, #2563eb)',
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: 'white', margin: 0 }}>
            📚 Attività di Studio
          </h2>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', cursor: 'pointer', color: 'white', padding: '8px' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.35)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {loadingData ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>⏳</div>
            Caricamento materie...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>

            {/* Data e Ora */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                📅 Data e Ora
              </label>
              <input
                type="datetime-local"
                value={formData.data_ora}
                onChange={(e) => setFormData({ ...formData, data_ora: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                required
              />
            </div>

            {/* Materia */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                📖 Materia *
              </label>
              {materie.length > 0 ? (
                <select
                  value={formData.materia}
                  onChange={(e) => setFormData({ ...formData, materia: e.target.value, argomento: '' })}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box' }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                  required
                >
                  <option value="">-- Seleziona materia --</option>
                  {materie.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <div>
                  <input
                    type="text"
                    placeholder="Scrivi la materia"
                    value={formData.materia}
                    onChange={(e) => setFormData({ ...formData, materia: e.target.value, argomento: '' })}
                    style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                    required
                  />
                  <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px', fontStyle: 'italic' }}>
                    ⚠️ Nessuna materia trovata per la tua classe e indirizzo
                  </p>
                </div>
              )}
            </div>

            {/* Argomento */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                📝 Argomento *
              </label>
              {argomenti.length > 0 && (
                <select
                  value={formData.argomento}
                  onChange={(e) => setFormData({ ...formData, argomento: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', marginBottom: '8px', outline: 'none', backgroundColor: 'white', boxSizing: 'border-box' }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                >
                  <option value="">-- Seleziona argomento --</option>
                  {argomenti.map((arg, i) => (
                    <option key={i} value={arg}>{arg}</option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder={argomenti.length > 0 ? '...oppure scrivi un argomento personalizzato' : "Scrivi l'argomento"}
                value={formData.argomento}
                onChange={(e) => setFormData({ ...formData, argomento: e.target.value })}
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', backgroundColor: !formData.materia ? '#f9fafb' : 'white' }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                required
                disabled={!formData.materia}
              />
              {!formData.materia && (
                <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px', fontStyle: 'italic' }}>
                  ⚠️ Seleziona prima una materia
                </p>
              )}
            </div>

            {/* Dettagli */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                💬 Dettagli
              </label>
              <textarea
                value={formData.dettagli}
                onChange={(e) => setFormData({ ...formData, dettagli: e.target.value })}
                rows={4}
                style={{ width: '100%', padding: '10px 12px', border: '2px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                placeholder="Aggiungi note, appunti o riflessioni..."
              />
            </div>

            {/* Bottoni */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{ padding: '10px 20px', border: '2px solid #e5e7eb', borderRadius: '8px', backgroundColor: 'white', color: '#374151', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{ padding: '10px 20px', border: 'none', borderRadius: '8px', backgroundColor: loading ? '#9ca3af' : '#3b82f6', color: 'white', fontSize: '14px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer' }}
              >
                {loading ? '⏳ Salvataggio...' : '✅ Salva'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}