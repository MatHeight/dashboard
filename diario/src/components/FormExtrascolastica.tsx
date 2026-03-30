import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface FormExtrascolasticaProps {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export default function FormExtrascolastica({ userId, onClose, onSuccess }: FormExtrascolasticaProps) {
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [competenze, setCompetenze] = useState<any[]>([])
  const [selectedCompetenze, setSelectedCompetenze] = useState<string[]>([])
  
  const [formData, setFormData] = useState({
    titolo_attivita: '',
    descrizione_attivita: '',
    data_ora: new Date().toISOString().slice(0, 16),
  })

  useEffect(() => {
    loadCompetenze()
  }, [])

  const loadCompetenze = async () => {
    try {
      const { data: profilo } = await supabase
        .from('profili_utenti')
        .select('id_logico')
        .eq('id', userId)
        .single()

      if (profilo) {
        const { data } = await supabase
          .from('competenze')
          .select('*')
          .eq('ind_logico', profilo.id_logico)
          .order('categoria')
          .order('nome')

        setCompetenze(data || [])
      }
    } catch (error) {
      console.error('Errore:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const toggleCompetenza = (id: string) => {
    setSelectedCompetenze(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedCompetenze.length === 0) {
      alert('Seleziona almeno una competenza')
      return
    }

    setLoading(true)

    try {
      const { data: attivita, error: attivitaError } = await supabase
        .from('diario_attivita')
        .insert({
          user_id: userId,
          tipo_attivita: 'extrascolastica',
          data_ora: formData.data_ora,
        })
        .select()
        .single()

      if (attivitaError) throw attivitaError

      const { error: extraError } = await supabase
        .from('diario_extrascolastiche')
        .insert({
          id: attivita.id,
          titolo_attivita: formData.titolo_attivita,
          descrizione_attivita: formData.descrizione_attivita || null,
          competenze_ids: selectedCompetenze,
        })

      if (extraError) throw extraError

      onSuccess()
    } catch (error) {
      console.error('Errore:', error)
      alert('Errore nel salvataggio')
    } finally {
      setLoading(false)
    }
  }

  const competenzePerCategoria = competenze.reduce((acc, comp) => {
    const cat = comp.categoria || 'Generale'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(comp)
    return acc
  }, {} as Record<string, any[]>)

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
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
          background: 'linear-gradient(to right, #a855f7, #9333ea)',
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: 0 }}>
            ⭐ Attività Extrascolastiche
          </h2>
          <button onClick={onClose} style={{ 
            background: 'rgba(255,255,255,0.2)', 
            border: 'none', 
            borderRadius: '6px',
            cursor: 'pointer', 
            color: 'white', 
            padding: '8px',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {loadingData ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
            Caricamento competenze...
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                📅 Data e Ora
              </label>
              <input
                type="datetime-local"
                value={formData.data_ora}
                onChange={(e) => setFormData({ ...formData, data_ora: e.target.value })}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  border: '2px solid #e5e7eb', 
                  borderRadius: '8px', 
                  fontSize: '14px',
                  outline: 'none',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#a855f7'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                🎯 Titolo Attività *
              </label>
              <input
                type="text"
                value={formData.titolo_attivita}
                onChange={(e) => setFormData({ ...formData, titolo_attivita: e.target.value })}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  border: '2px solid #e5e7eb', 
                  borderRadius: '8px', 
                  fontSize: '14px',
                  outline: 'none',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#a855f7'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                placeholder="Es: Volontariato, Teatro, Sport..."
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                💬 Descrizione
              </label>
              <textarea
                value={formData.descrizione_attivita}
                onChange={(e) => setFormData({ ...formData, descrizione_attivita: e.target.value })}
                rows={3}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  border: '2px solid #e5e7eb', 
                  borderRadius: '8px', 
                  fontSize: '14px', 
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#a855f7'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                placeholder="Cosa hai fatto, imparato, vissuto..."
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                ✨ Competenze Acquisite * (minimo 1)
              </label>
              
              {competenze.length === 0 ? (
                <div style={{ 
                  backgroundColor: '#fef2f2', 
                  border: '1px solid #fecaca', 
                  borderRadius: '8px', 
                  padding: '16px',
                  color: '#991b1b',
                  fontSize: '14px',
                }}>
                  ⚠️ Nessuna competenza disponibile. Contatta l'amministratore.
                </div>
              ) : (
                <div style={{ 
                  border: '2px solid #e5e7eb', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  maxHeight: '240px', 
                  overflow: 'auto',
                  backgroundColor: '#fafafa',
                }}>
                  {Object.entries(competenzePerCategoria).map(([categoria, comps]) => (
                    <div key={categoria} style={{ marginBottom: '16px' }}>
                      <h4 style={{ 
                        fontSize: '12px', 
                        fontWeight: '700', 
                        color: '#6b7280', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.5px',
                        marginBottom: '8px',
                      }}>
                        {categoria}
                      </h4>
                      {comps.map((comp) => (
                        <label
                          key={comp.id}
                          style={{
                            display: 'flex',
                            alignItems: 'start',
                            padding: '8px',
                            cursor: 'pointer',
                            borderRadius: '6px',
                            marginBottom: '4px',
                            backgroundColor: selectedCompetenze.includes(comp.id) ? '#f3e8ff' : 'transparent',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => !selectedCompetenze.includes(comp.id) && (e.currentTarget.style.backgroundColor = '#f9fafb')}
                          onMouseLeave={(e) => !selectedCompetenze.includes(comp.id) && (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          <input
                            type="checkbox"
                            checked={selectedCompetenze.includes(comp.id)}
                            onChange={() => toggleCompetenza(comp.id)}
                            style={{
                              marginTop: '2px',
                              marginRight: '10px',
                              width: '16px',
                              height: '16px',
                              accentColor: '#a855f7',
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: '#1f2937' }}>
                              {comp.nome}
                            </div>
                            {comp.descrizione && (
                              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>
                                {comp.descrizione}
                              </div>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              )}
              
              {selectedCompetenze.length > 0 && (
                <p style={{ fontSize: '12px', color: '#a855f7', marginTop: '8px', fontWeight: '600' }}>
                  ✓ {selectedCompetenze.length} competenza{selectedCompetenze.length > 1 ? 'e' : ''} selezionata{selectedCompetenze.length > 1 ? 'e' : ''}
                </p>
              )}
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '12px', 
              paddingTop: '20px',
              borderTop: '1px solid #e5e7eb',
            }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{ 
                  padding: '10px 20px', 
                  border: '2px solid #e5e7eb', 
                  borderRadius: '8px', 
                  backgroundColor: 'white', 
                  color: '#374151', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#f9fafb')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = 'white')}
              >
                Annulla
              </button>
              <button
                type="submit"
                disabled={loading || competenze.length === 0}
                style={{ 
                  padding: '10px 20px', 
                  border: 'none', 
                  borderRadius: '8px', 
                  backgroundColor: loading || competenze.length === 0 ? '#9ca3af' : '#a855f7', 
                  color: 'white', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  cursor: loading || competenze.length === 0 ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => !loading && competenze.length > 0 && (e.currentTarget.style.backgroundColor = '#9333ea')}
                onMouseLeave={(e) => !loading && competenze.length > 0 && (e.currentTarget.style.backgroundColor = '#a855f7')}
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