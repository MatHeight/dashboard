import { useState } from 'react'
import { BookOpen, FileText, Star, PlusCircle } from 'lucide-react'
import FormStudio from './FormStudio'
import FormUda from './FormUda'
import FormExtrascolastica from './FormExtrascolastica'
import ListaAttivita from './ListaAttivita'

interface DiarioHomeProps {
  session: any
}

type FormType = 'studio' | 'uda' | 'extrascolastica' | null

export default function DiarioHome({ session }: DiarioHomeProps) {
  const [activeForm, setActiveForm] = useState<FormType>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const userId = session?.user?.id

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600 font-semibold">Errore: utente non riconosciuto.</p>
      </div>
    )
  }

  const handleSuccess = () => {
    setActiveForm(null)
    setRefreshTrigger(prev => prev + 1)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #001f3f 0%, #8B0000 100%)',
        padding: '24px 32px',
        color: 'white',
      }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', letterSpacing: '1px' }}>
          📖 Diario di Bordo
        </h1>
        <p style={{ margin: '6px 0 0', opacity: 0.8, fontSize: '14px' }}>
          Registra le tue attività di studio, UDA e attività extrascolastiche
        </p>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Bottoni azione */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}>
          {/* Card Studio */}
          <button
            onClick={() => setActiveForm('studio')}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '24px 20px',
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 4px 15px rgba(59, 130, 246, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(59, 130, 246, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <BookOpen style={{ width: '28px', height: '28px' }} />
              <PlusCircle style={{ width: '20px', height: '20px', opacity: 0.8 }} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Studio</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>
              Registra materia e argomento studiato
            </div>
          </button>

          {/* Card UDA */}
          <button
            onClick={() => setActiveForm('uda')}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '24px 20px',
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(16, 185, 129, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(16, 185, 129, 0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <FileText style={{ width: '28px', height: '28px' }} />
              <PlusCircle style={{ width: '20px', height: '20px', opacity: 0.8 }} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>UDA</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>
              Registra un'attività legata a un'UDA
            </div>
          </button>

          {/* Card Extrascolastica */}
          <button
            onClick={() => setActiveForm('extrascolastica')}
            style={{
              background: 'linear-gradient(135deg, #a855f7, #9333ea)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '24px 20px',
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(168, 85, 247, 0.4)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(168, 85, 247, 0.3)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <Star style={{ width: '28px', height: '28px' }} />
              <PlusCircle style={{ width: '20px', height: '20px', opacity: 0.8 }} />
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>Extrascolastica</div>
            <div style={{ fontSize: '13px', opacity: 0.85, marginTop: '4px' }}>
              Sport, volontariato, hobby e altro
            </div>
          </button>
        </div>

        {/* Lista attività */}
        <ListaAttivita userId={userId} refreshTrigger={refreshTrigger} />
      </div>

      {/* Modali form */}
      {activeForm === 'studio' && (
        <FormStudio
          userId={userId}
          onClose={() => setActiveForm(null)}
          onSuccess={handleSuccess}
        />
      )}
      {activeForm === 'uda' && (
        <FormUda
          userId={userId}
          onClose={() => setActiveForm(null)}
          onSuccess={handleSuccess}
        />
      )}
      {activeForm === 'extrascolastica' && (
        <FormExtrascolastica
          userId={userId}
          onClose={() => setActiveForm(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}