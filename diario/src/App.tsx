import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'
import DiarioHome from './components/DiarioHome'

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || '/'

function App() {
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      // Prima prova a prendere la sessione esistente
      let { data: { session } } = await supabase.auth.getSession()

      // Se non c'è, forza il refresh (necessario quando caricato in iframe)
      if (!session) {
        const { data: refreshed } = await supabase.auth.refreshSession()
        session = refreshed.session
      }

      if (!session) {
        window.location.href = DASHBOARD_URL
        return
      }

      setSession(session)
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.href = DASHBOARD_URL
      } else {
        setSession(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: '18px', color: '#6b7280' }}>Caricamento...</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      <DiarioHome session={session} />
    </div>
  )
}

export default App