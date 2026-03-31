import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { Whiteboard } from './components/Whiteboard'

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || '/dashboard'

function App() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [boardId, setBoardId] = useState('')
  const [isMaster, setIsMaster] = useState(false)

  useEffect(() => {
    async function init() {
      let { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        const { data: refreshed } = await supabase.auth.refreshSession()
        session = refreshed.session
      }

      if (!session) {
        window.location.href = DASHBOARD_URL
        return
      }

      setUser(session.user)
      setLoading(false)
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.href = DASHBOARD_URL
      } else {
        setUser(session.user)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const path = window.location.pathname
    const match = path.match(/\/board\/(.+)/)
    if (match) {
      setBoardId(match[1])
      setIsMaster(false)
    }
  }, [])

  const createNewBoard = () => {
    const newId = Math.random().toString(36).substring(2, 10)
    setBoardId(newId)
    setIsMaster(true)
    window.history.pushState({}, '', `/board/${newId}`)
  }

  if (loading) return <div style={{ padding: '50px', textAlign: 'center' }}>Caricamento...</div>

  if (!boardId) {
    return (
      <div style={{ maxWidth: '500px', margin: '100px auto', padding: '40px', textAlign: 'center' }}>
        <h1>🎨 Lavagna Collaborativa</h1>
        <p>Benvenuto, {user?.email}</p>
        <button onClick={createNewBoard} style={{
          padding: '15px 30px',
          marginTop: '20px',
          fontSize: '16px',
          background: '#2196F3',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer'
        }}>
          ➕ Crea Nuova Lavagna
        </button>
      </div>
    )
  }

  return <Whiteboard boardId={boardId} isMaster={isMaster} onLogout={() => window.location.href = DASHBOARD_URL} />
}

export default App