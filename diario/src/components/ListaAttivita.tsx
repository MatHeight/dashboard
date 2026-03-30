import { useState, useEffect } from 'react'
import { BookOpen, FileText, Star, Trash2, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface ListaAttivitaProps {
  userId: string
  refreshTrigger: number
}

interface AttivitaItem {
  id: string
  tipo_attivita: 'studio' | 'uda' | 'extrascolastica'
  data_ora: string
  dettagli?: {
    materia?: string
    argomento?: string
    dettagli?: string
    titolo_uda?: string
    descrizione_attivita?: string
    titolo_attivita?: string
    competenze?: string[]
  }
}

export default function ListaAttivita({ userId, refreshTrigger }: ListaAttivitaProps) {
  const [attivita, setAttivita] = useState<AttivitaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'studio' | 'uda' | 'extrascolastica'>('all')

  useEffect(() => {
    loadAttivita()
  }, [userId, refreshTrigger])

  const loadAttivita = async () => {
    try {
      setLoading(true)

      // 1. Carica tutte le attività principali
      const { data: attivitaPrincipali, error: mainError } = await supabase
        .from('diario_attivita')
        .select('id, tipo_attivita, data_ora')
        .eq('user_id', userId)
        .order('data_ora', { ascending: false })

      if (mainError) throw mainError
      if (!attivitaPrincipali || attivitaPrincipali.length === 0) {
        setAttivita([])
        return
      }

      const ids = attivitaPrincipali.map(a => a.id)
      const studioIds = attivitaPrincipali.filter(a => a.tipo_attivita === 'studio').map(a => a.id)
      const udaIds = attivitaPrincipali.filter(a => a.tipo_attivita === 'uda').map(a => a.id)
      const extraIds = attivitaPrincipali.filter(a => a.tipo_attivita === 'extrascolastica').map(a => a.id)

      // 2. Query batch per ogni tipo (3 query totali invece di N*3)
      const [studioRes, udaRes, extraRes] = await Promise.all([
        studioIds.length > 0
          ? supabase.from('diario_studio').select('id, materia, argomento, dettagli').in('id', studioIds)
          : Promise.resolve({ data: [] }),
        udaIds.length > 0
          ? supabase.from('diario_uda').select('id, titolo_uda, descrizione_attivita').in('id', udaIds)
          : Promise.resolve({ data: [] }),
        extraIds.length > 0
          ? supabase.from('diario_extrascolastiche').select('id, titolo_attivita, descrizione_attivita, competenze_ids').in('id', extraIds)
          : Promise.resolve({ data: [] }),
      ])

      // 3. Raccoglie tutti gli id competenze per 1 sola query
      const tuttiCompIds: string[] = []
      ;(extraRes.data || []).forEach((ex: any) => {
        if (ex.competenze_ids?.length > 0) tuttiCompIds.push(...ex.competenze_ids)
      })

      let compeMap: Record<string, string> = {}
      if (tuttiCompIds.length > 0) {
        const { data: comps } = await supabase
          .from('competenze')
          .select('id, nome')
          .in('id', [...new Set(tuttiCompIds)])

        ;(comps || []).forEach((c: any) => { compeMap[c.id] = c.nome })
      }

      // 4. Costruisce mappe per lookup O(1)
      const studioMap: Record<string, any> = {}
      ;(studioRes.data || []).forEach((s: any) => { studioMap[s.id] = s })

      const udaMap: Record<string, any> = {}
      ;(udaRes.data || []).forEach((u: any) => { udaMap[u.id] = u })

      const extraMap: Record<string, any> = {}
      ;(extraRes.data || []).forEach((ex: any) => {
        extraMap[ex.id] = {
          ...ex,
          competenze: (ex.competenze_ids || []).map((cid: string) => compeMap[cid]).filter(Boolean),
        }
      })

      // 5. Unisce tutto
      const result: AttivitaItem[] = attivitaPrincipali.map(att => ({
        id: att.id,
        tipo_attivita: att.tipo_attivita,
        data_ora: att.data_ora,
        dettagli:
          att.tipo_attivita === 'studio'
            ? studioMap[att.id] || {}
            : att.tipo_attivita === 'uda'
            ? udaMap[att.id] || {}
            : extraMap[att.id] || {},
      }))

      setAttivita(result)
    } catch (error) {
      console.error('Errore caricamento attività:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa attività?')) return

    try {
      // La FK con CASCADE elimina automaticamente le righe figlio
      const { error } = await supabase
        .from('diario_attivita')
        .delete()
        .eq('id', id)
        .eq('user_id', userId) // sicurezza: solo le proprie

      if (error) throw error
      setAttivita(prev => prev.filter(a => a.id !== id))
    } catch (error) {
      console.error("Errore nell'eliminazione:", error)
      alert("Errore nell'eliminazione dell'attività")
    }
  }

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString))
  }

  const getIcon = (tipo: string) => {
    switch (tipo) {
      case 'studio': return <BookOpen style={{ width: '20px', height: '20px', color: '#2563eb' }} />
      case 'uda': return <FileText style={{ width: '20px', height: '20px', color: '#059669' }} />
      case 'extrascolastica': return <Star style={{ width: '20px', height: '20px', color: '#9333ea' }} />
      default: return null
    }
  }

  const getBorderColor = (tipo: string) => {
    switch (tipo) {
      case 'studio': return '#bfdbfe'
      case 'uda': return '#a7f3d0'
      case 'extrascolastica': return '#e9d5ff'
      default: return '#e5e7eb'
    }
  }

  const getBgColor = (tipo: string) => {
    switch (tipo) {
      case 'studio': return '#eff6ff'
      case 'uda': return '#f0fdf4'
      case 'extrascolastica': return '#faf5ff'
      default: return '#f9fafb'
    }
  }

  const filteredAttivita = filter === 'all' ? attivita : attivita.filter(a => a.tipo_attivita === filter)

  const btnFilter = (active: boolean, color: string) => ({
    padding: '6px 14px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    backgroundColor: active ? color : '#f3f4f6',
    color: active ? 'white' : '#374151',
    transition: 'all 0.2s',
  })

  if (loading) {
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', padding: '40px', textAlign: 'center', color: '#6b7280' }}>
        <div style={{ fontSize: '36px', marginBottom: '12px' }}>⏳</div>
        Caricamento attività...
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 4px rgba(0,0,0,0.1)', padding: '24px' }}>
      {/* Header + filtri */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1f2937', margin: 0 }}>
          Le Mie Attività {attivita.length > 0 && <span style={{ fontSize: '16px', color: '#6b7280', fontWeight: 'normal' }}>({attivita.length})</span>}
        </h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button style={btnFilter(filter === 'all', '#1f2937')} onClick={() => setFilter('all')}>Tutte</button>
          <button style={btnFilter(filter === 'studio', '#2563eb')} onClick={() => setFilter('studio')}>📚 Studio</button>
          <button style={btnFilter(filter === 'uda', '#059669')} onClick={() => setFilter('uda')}>📄 UDA</button>
          <button style={btnFilter(filter === 'extrascolastica', '#9333ea')} onClick={() => setFilter('extrascolastica')}>⭐ Extra</button>
        </div>
      </div>

      {/* Lista */}
      {filteredAttivita.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#9ca3af' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📋</div>
          <p style={{ fontSize: '16px', fontWeight: '500' }}>Nessuna attività registrata</p>
          <p style={{ fontSize: '14px', marginTop: '4px' }}>Usa i pulsanti sopra per aggiungere la prima attività</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredAttivita.map((item) => (
            <div
              key={item.id}
              style={{
                border: `1px solid ${getBorderColor(item.tipo_attivita)}`,
                borderRadius: '10px',
                padding: '16px',
                backgroundColor: getBgColor(item.tipo_attivita),
                transition: 'box-shadow 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: 1 }}>
                  <div style={{ marginTop: '2px', flexShrink: 0 }}>{getIcon(item.tipo_attivita)}</div>
                  <div style={{ flex: 1 }}>
                    {/* Data */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                      <Calendar style={{ width: '14px', height: '14px' }} />
                      <span>{formatDate(item.data_ora)}</span>
                    </div>

                    {/* Contenuto Studio */}
                    {item.tipo_attivita === 'studio' && (
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', margin: '0 0 4px' }}>
                          {item.dettagli?.materia || '—'}
                        </h3>
                        <p style={{ fontSize: '14px', color: '#374151', margin: '0 0 4px' }}>
                          Argomento: <strong>{item.dettagli?.argomento}</strong>
                        </p>
                        {item.dettagli?.dettagli && (
                          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, whiteSpace: 'pre-line' }}>
                            {item.dettagli.dettagli}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Contenuto UDA */}
                    {item.tipo_attivita === 'uda' && (
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', margin: '0 0 6px' }}>
                          {item.dettagli?.titolo_uda || '—'}
                        </h3>
                        {item.dettagli?.descrizione_attivita && (
                          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0, whiteSpace: 'pre-line' }}>
                            {item.dettagli.descrizione_attivita}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Contenuto Extrascolastica */}
                    {item.tipo_attivita === 'extrascolastica' && (
                      <div>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1f2937', margin: '0 0 6px' }}>
                          {item.dettagli?.titolo_attivita || '—'}
                        </h3>
                        {item.dettagli?.descrizione_attivita && (
                          <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 8px', whiteSpace: 'pre-line' }}>
                            {item.dettagli.descrizione_attivita}
                          </p>
                        )}
                        {item.dettagli?.competenze && item.dettagli.competenze.length > 0 && (
                          <div>
                            <p style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', margin: '0 0 6px' }}>
                              Competenze acquisite:
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {item.dettagli.competenze.map((comp, idx) => (
                                <span key={idx} style={{
                                  backgroundColor: '#e9d5ff',
                                  color: '#6b21a8',
                                  fontSize: '12px',
                                  padding: '3px 10px',
                                  borderRadius: '20px',
                                  fontWeight: '500',
                                }}>
                                  {comp}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottone elimina */}
                <button
                  onClick={() => handleDelete(item.id)}
                  title="Elimina attività"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: '4px', borderRadius: '4px', flexShrink: 0 }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#dc2626'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#f87171'}
                >
                  <Trash2 style={{ width: '18px', height: '18px' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}