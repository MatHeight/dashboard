import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import Dashboard from './pages/Dashboard'
import Editor from './pages/Editor'
import TemplateSelector from './pages/TemplateSelector'
import Autovalutazione from './pages/Autovalutazione'
import UdaView from './pages/UdaView'

const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || '/dashboard'

// Se c'è ?view=ID nell'URL, siamo in modalità visualizzazione
const viewId = new URLSearchParams(window.location.search).get('view')

function AuthGuard({ children }) {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    async function check() {
      let { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { data: refreshed } = await supabase.auth.refreshSession()
        session = refreshed.session
      }
      if (!session) {
        setStatus('redirect')
        window.location.href = DASHBOARD_URL
      } else {
        setStatus('ok')
      }
    }
    check()
  }, [])

  if (status === 'loading') return <div className="flex items-center justify-center min-h-screen"><div className="text-xl text-gray-600">Caricamento...</div></div>
  if (status === 'redirect') return null
  return children
}

function App() {
  // Modalità visualizzazione: carica UdaView direttamente senza AuthGuard né router
  if (viewId) {
    return <UdaView udaId={viewId} />
  }

  return (
    <Router basename="/uda">
      <Routes>
        <Route path="/*" element={
          <AuthGuard>
            <div className="min-h-screen bg-gray-50">
              <header className="bg-white shadow-sm border-b-4 border-brand-navy">
                <div className="border-b-2 border-brand-bordeaux"></div>
                <div className="max-w-7xl mx-auto px-4 py-4">
                  <h1 className="text-2xl font-bold text-brand-navy">
                    MatHeight <span className="text-brand-bordeaux">UdA</span>
                  </h1>
                </div>
              </header>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/editor/:id?" element={<Editor />} />
                <Route path="/templates" element={<TemplateSelector />} />
                <Route path="/autovalutazione/:id" element={<Autovalutazione />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </AuthGuard>
        } />
      </Routes>
    </Router>
  )
}

export default App