import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface FormUdaProps {
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export default function FormUda({ userId, onClose, onSuccess }: FormUdaProps) {
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [udaList, setUdaList] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    uda_id: '',
    titolo_uda: '',
    descrizione_attivita: '',
    data_ora: new Date().toISOString().slice(0, 16),
  })

  useEffect(() => {
    loadUda()
  }, [])

  const loadUda = async () => {
    try {
      const { data } = await supabase
        .from('uda_documenti')
        .select('id, titolo')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      setUdaList(data || [])
    } catch (error) {
      console.error('Errore:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleUdaSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value
    const selectedUda = udaList.find(u => u.id === selectedId)
    
    setFormData({
      ...formData,
      uda_id: selectedId,
      titolo_uda: selectedUda ? selectedUda.titolo : '',
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: attivita, error: attivitaError } = await supabase
        .from('diario_attivita')
        .insert({
          user_id: userId,
          tipo_attivita: 'uda',
          data_ora: formData.data_ora,
        })
        .select()
        .single()

      if (attivitaError) throw attivitaError

      const { error: udaError } = await supabase
        .from('diario_uda')
        .insert({
          id: attivita.id,
          uda_id: formData.uda_id || null,
          titolo_uda: formData.titolo_uda,
          descrizione_attivita: formData.descrizione_attivita || null,
        })

      if (udaError) throw udaError

      onSuccess()
    } catch (error) {
      console.error('Errore:', error)
      alert('Errore nel salvataggio')
    } finally {
      setLoading(false)
    }
  }

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
          background: 'linear-gradient(to right, #10b981, #059669)',
        }}>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: 'white', margin: 0 }}>
            📄 Attività UDA
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
            Caricamento UDA...
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
                onFocus={(e) => e.currentTarget.style.borderColor = '#10b981'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                required
              />
            </div>

            {udaList.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                  📚 Seleziona UDA (opzionale)
                </label>
                <select
                  value={formData.uda_id}
                  onChange={handleUdaSelect}
                  style={{ 
                    width: '100%', 
                    padding: '10px 12px', 
                    border: '2px solid #e5e7eb', 
                    borderRadius: '8px', 
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: 'white',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#10b981'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                >
                  <option value="">-- Nuova UDA o scrivi sotto --</option>
                  {udaList.map((uda) => (
                    <option key={uda.id} value={uda.id}>{uda.titolo}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                📝 Titolo UDA *
              </label>
              <input
                type="text"
                value={formData.titolo_uda}
                onChange={(e) => setFormData({ ...formData, titolo_uda: e.target.value })}
                style={{ 
                  width: '100%', 
                  padding: '10px 12px', 
                  border: '2px solid #e5e7eb', 
                  borderRadius: '8px', 
                  fontSize: '14px',
                  outline: 'none',
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#10b981'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                placeholder="Es: Cittadinanza e Costituzione"
                required
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                💬 Descrizione Attività
              </label>
              <textarea
                value={formData.descrizione_attivita}
                onChange={(e) => setFormData({ ...formData, descrizione_attivita: e.target.value })}
                rows={4}
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
                onFocus={(e) => e.currentTarget.style.borderColor = '#10b981'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#e5e7eb'}
                placeholder="Cosa hai fatto? Quali obiettivi? Difficoltà?"
              />
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
                disabled={loading}
                style={{ 
                  padding: '10px 20px', 
                  border: 'none', 
                  borderRadius: '8px', 
                  backgroundColor: loading ? '#9ca3af' : '#10b981', 
                  color: 'white', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = '#059669')}
                onMouseLeave={(e) => !loading && (e.currentTarget.style.backgroundColor = '#10b981')}
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