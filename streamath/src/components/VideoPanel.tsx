import { useState, useRef, useImperativeHandle, forwardRef, useEffect } from 'react'
import RTKClient from '@cloudflare/realtimekit'
import { RtkGrid, RtkParticipantsAudio, RtkControlbar } from '@cloudflare/realtimekit-react-ui'
import { supabase } from '../../src/lib/supabase.js'

const WORKER_URL = import.meta.env.VITE_CALLS_WORKER_URL || 'https://streamath-calls.matheightlearing.workers.dev'

interface VideoPanelProps {
  sessioneId: string
  sessioneCodice: string
  userId: string
  userEmail: string
  isAdmin: boolean
}

type VideoState = 'idle' | 'loading' | 'connected' | 'error'

export interface VideoPanelHandle {
  endMeeting: () => Promise<void>
}

const VideoPanel = forwardRef<VideoPanelHandle, VideoPanelProps>(function VideoPanel(
  { sessioneId, sessioneCodice, userId, userEmail, isAdmin }, ref
) {
  const [state, setState] = useState<VideoState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [meeting, setMeeting] = useState<any>(null)
  const [meetingId, setMeetingId] = useState<string | null>(null)
  const [states, setStates] = useState<any>({ meeting: 'idle' })

  useImperativeHandle(ref, () => ({
    endMeeting: async () => { await endMeeting() }
  }))

  // Ascolta aggiornamenti di stato dal meeting
  useEffect(() => {
    if (!meeting) return
    const handler = (newStates: any) => setStates(newStates)
    meeting.self.on('meetingStateUpdate', handler)
    return () => { meeting.self.off('meetingStateUpdate', handler) }
  }, [meeting])

  async function joinMeeting() {
    setState('loading')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non autenticato')

      const res = await fetch(`${WORKER_URL}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          sessione_id: sessioneId,
          sessione_codice: sessioneCodice,
          display_name: userEmail.split('@')[0],
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Errore Worker')
      }

      const { authToken, meetingId: mId } = await res.json()
      setMeetingId(mId)

      const client = await RTKClient.init({
        authToken,
        defaults: { audio: true, video: true },
      })

      // Unisciti alla stanza
      await client.joinRoom()

      setMeeting(client)
      setState('connected')

      client.self.on('roomLeft', () => {
        setMeeting(null)
        setMeetingId(null)
        setState('idle')
      })

      // Quando RealtimeKit termina la chiamata (es. host chiude)
      client.meta.on('meetingEnded', () => {
        setMeeting(null)
        setMeetingId(null)
        setState('idle')
      })

    } catch (err: any) {
      setErrorMsg(err.message || 'Errore connessione')
      setState('error')
    }
  }

  async function leaveMeeting() {
    if (meeting) { await meeting.leaveRoom(); setMeeting(null) }
    setState('idle')
  }

  async function endMeeting() {
    if (!meetingId) { await leaveMeeting(); return }
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch(`${WORKER_URL}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ meeting_id: meetingId }),
      })
    } catch (_) {}
    await leaveMeeting()
  }

  // ── IDLE ─────────────────────────────────────────────────────────────────
  if (state === 'idle') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '1.5rem', gap: 10,
        background: '#1a2332', flexShrink: 0,
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M23 7l-7 5 7 5V7z"/>
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
        </svg>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 500, textAlign: 'center', margin: 0 }}>
          Video non attivo
        </p>
        <button onClick={joinMeeting} style={{
          padding: '6px 16px', background: '#16a34a', color: 'white',
          border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: 'pointer',
        }}>
          Avvia video
        </button>
      </div>
    )
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: '#1a2332', gap: 8, flexShrink: 0 }}>
        <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#16a34a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>Connessione...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ── ERROR ─────────────────────────────────────────────────────────────────
  if (state === 'error') {
    return (
      <div style={{ padding: '1rem', background: '#1a2332', flexShrink: 0 }}>
        <p style={{ color: '#f87171', fontSize: 11, fontWeight: 500, margin: '0 0 8px' }}>{errorMsg}</p>
        <button onClick={() => { setState('idle'); setErrorMsg('') }}
          style={{ padding: '4px 10px', background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>
          Riprova
        </button>
      </div>
    )
  }

  // ── CONNECTED ─────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1a2332', minHeight: 0, overflow: 'hidden' }}>

      {/* Griglia video partecipanti */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {meeting && (
          <>
            {/* Audio di tutti i partecipanti remoti */}
            <RtkParticipantsAudio meeting={meeting} />
            {/* Griglia video */}
            <RtkGrid
              meeting={meeting}
              states={states}
              style={{ width: '100%', height: '100%' }}
            />
          </>
        )}
      </div>

      {/* Barra controlli */}
      {meeting && (
        <div style={{ flexShrink: 0 }}>
          <RtkControlbar meeting={meeting} states={states} size="sm" />
        </div>
      )}

      {/* Esci */}
      <div style={{ padding: '5px 10px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
        <button onClick={leaveMeeting}
          style={{ padding: '3px 10px', background: 'transparent', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, fontSize: 10, cursor: 'pointer' }}>
          ← Esci dal video
        </button>
      </div>
    </div>
  )
})

export default VideoPanel