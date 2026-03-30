import { useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import VideoPanel, { VideoPanelHandle } from './VideoPanel'
import { supabase } from '../../src/lib/supabase.js'

// ─── Tipi ────────────────────────────────────────────────────────────────────

interface Props {
  sessioneId: string
  sessioneCodice: string
  sessioneNome: string
  userId: string
  userEmail: string
  isAdmin: boolean
  onEsci: () => void
  onConcludi: () => void
}

interface ChatMsg {
  id: string
  user_email: string
  testo: string
  ts: string
}

interface Annotation {
  id: string
  type: 'highlight' | 'underline' | 'postit' | 'pen' | 'text'
  page: number
  x: number
  y: number
  width?: number
  height?: number
  color: string
  text?: string
  points?: { x: number; y: number }[]
}

type PanelType = 'whiteboard' | 'mathpanel' | 'media'

// ─── Brand ───────────────────────────────────────────────────────────────────

const B = {
  navy:         '#1a2332',   // navy principale (homeacademy)
  navyLight:    '#2d3e50',   // navy secondario
  bordeaux:     '#6b1f3d',   // bordeaux principale
  bordeauxLight:'#8b2f52',   // bordeaux secondario
  bgPage:       '#F5F4F1',   // bianco sporco — sfondo pagina
  bgCard:       '#FFFFFF',   // bianco puro — pannelli/card
  bgWarm:       '#FAF9F7',   // bianco caldo — aree secondarie
  border:       '#E4E2DD',   // bordo caldo
  text:         '#1a2332',   // testo primario
  muted:        '#4f5d75',   // testo secondario
  faint:        '#8d99ae',   // testo tenue
  green:        '#16a34a',   // solo per stati attivi/conferme
  red:          '#dc2626',   // solo per azioni distruttive
  // Colori annotazioni
  annotBlack:   '#1a2332',
  annotBordeaux:'#6b1f3d',
  annotBlue:    '#1D4ED8',
  annotYellow:  '#FEF08A',
  annotGreen:   '#BBF7D0',
}

// ─── Icone SVG ────────────────────────────────────────────────────────────────

const Icon = {
  whiteboard: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  math: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M2 17l10 5 10-5"/>
      <path d="M2 12l10 5 10-5"/>
    </svg>
  ),
  media: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <rect x="8" y="13" width="8" height="6" rx="1"/>
    </svg>
  ),
  split: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="9" height="18" rx="1"/>
      <rect x="13" y="3" width="9" height="18" rx="1"/>
    </svg>
  ),
  link: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
    </svg>
  ),
  academy: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  send: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  ),
  // Tool annotazioni
  select: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3l14 9-7 1-4 7z"/>
    </svg>
  ),
  highlight: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l-6 6v3h3l6-6m-3-3l7.07-7.07 3 3L12 14"/>
    </svg>
  ),
  underline: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/>
      <line x1="4" y1="21" x2="20" y2="21"/>
    </svg>
  ),
  postit: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  pen: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
    </svg>
  ),
  text: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 7 4 4 20 4 20 7"/>
      <line x1="9" y1="20" x2="15" y2="20"/>
      <line x1="12" y1="4" x2="12" y2="20"/>
    </svg>
  ),
  undo: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6"/><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
    </svg>
  ),
  download: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  ),
  image: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
      <circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  pdf: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
}

// ─── LATEX KEYS ───────────────────────────────────────────────────────────────

const LATEX_KEYS = [
  { label: 'α', val: '\\alpha' }, { label: 'β', val: '\\beta' },
  { label: 'γ', val: '\\gamma' }, { label: 'π', val: '\\pi' },
  { label: 'Σ', val: '\\Sigma' }, { label: '∫', val: '\\int' },
  { label: '∂', val: '\\partial' }, { label: '√', val: '\\sqrt{}' },
  { label: 'x²', val: '^{2}' }, { label: 'xₙ', val: '_{n}' },
  { label: 'frac', val: '\\frac{}{}' }, { label: 'lim', val: '\\lim_{}' },
  { label: 'sin', val: '\\sin' }, { label: 'cos', val: '\\cos' },
  { label: '∞', val: '\\infty' }, { label: '≤', val: '\\leq' },
  { label: '≥', val: '\\geq' }, { label: '∈', val: '\\in' },
  { label: 'ℝ', val: '\\mathbb{R}' }, { label: '±', val: '\\pm' },
  { label: '·', val: '\\cdot' }, { label: '×', val: '\\times' },
]

// ─── Iframe Embeds ────────────────────────────────────────────────────────────

const WhiteboardEmbed = forwardRef<HTMLIFrameElement, { sessioneId: string; isAdmin: boolean }>(
  ({ sessioneId, isAdmin }, ref) => (
    <iframe ref={ref} src={`/whiteboard/?board=${sessioneId}&master=${isAdmin ? '1' : '0'}`}
      style={{ width: '100%', height: '100%', border: 'none' }} title="Lavagna" />
  )
)

const MathPanelEmbed = forwardRef<HTMLIFrameElement, { sessioneId: string }>(
  ({ sessioneId }, ref) => (
    <iframe ref={ref} src={`/math-panel/?board=${sessioneId}`}
      style={{ width: '100%', height: '100%', border: 'none' }} title="Math Panel" />
  )
)

// ─── AnnotationViewer (PDF + Foto accorpati) ──────────────────────────────────

type AnnotTool = 'select' | 'highlight' | 'underline' | 'postit' | 'pen' | 'text'

const ANNOT_COLORS = [
  { id: 'black',    hex: B.annotBlack,    label: 'Nero' },
  { id: 'bordeaux', hex: B.annotBordeaux, label: 'Bordeaux' },
  { id: 'blue',     hex: B.annotBlue,     label: 'Blu' },
  { id: 'yellow',   hex: B.annotYellow,   label: 'Giallo' },
  { id: 'green',    hex: B.annotGreen,    label: 'Verde' },
]

function AnnotationViewer({
  activeTextInputRef,
}: {
  activeTextInputRef: React.RefObject<HTMLInputElement | null>
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const annotRef = useRef<HTMLCanvasElement>(null)

  const [mode, setMode] = useState<'pdf' | 'image'>('pdf')
  const [pdfDoc, setPdfDoc] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [pdfJsReady, setPdfJsReady] = useState(false)
  const [images, setImages] = useState<{ url: string; name: string }[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [activeTool, setActiveTool] = useState<AnnotTool>('select')
  const [activeColor, setActiveColor] = useState(B.annotBlack)
  const [isDrawing, setIsDrawing] = useState(false)
  const [penPoints, setPenPoints] = useState<{ x: number; y: number }[]>([])
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [postitPos, setPostitPos] = useState<{ x: number; y: number } | null>(null)
  const [postitText, setPostitText] = useState('')
  const [textInput, setTextInput] = useState<{ x: number; y: number; screenX: number; screenY: number; value: string } | null>(null)
  const inlineInputRef = useRef<HTMLInputElement>(null)

  // Carica pdfjs
  useEffect(() => {
    if ((window as any).pdfjsLib) { setPdfJsReady(true); return }
    const s = document.createElement('script')
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    s.onload = () => {
      ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      setPdfJsReady(true)
    }
    document.head.appendChild(s)
  }, [])

  async function loadPdf(file: File) {
    if (!(window as any).pdfjsLib) return
    const buf = await file.arrayBuffer()
    const doc = await (window as any).pdfjsLib.getDocument({ data: buf }).promise
    setPdfDoc(doc)
    setTotalPages(doc.numPages)
    setCurrentPage(1)
    setMode('pdf')
    setAnnotations([])
    renderPage(doc, 1)
  }

  const renderPage = useCallback(async (doc: any, pageNum: number) => {
    if (!doc || !canvasRef.current) return
    const page = await doc.getPage(pageNum)
    const vp = page.getViewport({ scale: 1.4 })
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    canvas.height = vp.height
    canvas.width = vp.width
    if (annotRef.current) {
      annotRef.current.height = vp.height
      annotRef.current.width = vp.width
    }
    await page.render({ canvasContext: ctx, viewport: vp }).promise
    redrawAnnotations(pageNum)
  }, [annotations])

  useEffect(() => { if (pdfDoc) renderPage(pdfDoc, currentPage) }, [currentPage, pdfDoc])

  function redrawAnnotations(page: number) {
    const ac = annotRef.current
    if (!ac) return
    const ctx = ac.getContext('2d')!
    ctx.clearRect(0, 0, ac.width, ac.height)
    annotations.filter(a => a.page === page).forEach(a => drawAnnot(ctx, a))
  }

  useEffect(() => { redrawAnnotations(currentPage) }, [annotations, currentPage])

  function drawAnnot(ctx: CanvasRenderingContext2D, a: Annotation) {
    ctx.save()
    if (a.type === 'highlight') {
      ctx.globalAlpha = 0.35
      ctx.fillStyle = a.color
      ctx.fillRect(a.x, a.y, a.width || 80, a.height || 16)
    } else if (a.type === 'underline') {
      ctx.strokeStyle = a.color
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.9
      ctx.beginPath()
      ctx.moveTo(a.x, a.y + (a.height || 16))
      ctx.lineTo(a.x + (a.width || 80), a.y + (a.height || 16))
      ctx.stroke()
    } else if (a.type === 'postit') {
      ctx.globalAlpha = 0.95
      ctx.fillStyle = '#FFF176'
      ctx.strokeStyle = '#CA8A04'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.roundRect(a.x, a.y, 150, 80, 3)
      ctx.fill(); ctx.stroke()
      ctx.fillStyle = '#1e293b'
      ctx.font = '11px system-ui'
      ctx.globalAlpha = 1
      ;(a.text || '').split('\n').forEach((l, i) => ctx.fillText(l, a.x + 6, a.y + 16 + i * 14))
    } else if (a.type === 'pen' && a.points) {
      ctx.globalAlpha = 0.85
      ctx.strokeStyle = a.color
      ctx.lineWidth = 1.75
      ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath()
      a.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
      ctx.stroke()
    } else if (a.type === 'text' && a.text) {
      ctx.fillStyle = a.color
      ctx.font = '15px system-ui'
      ctx.fillText(a.text, a.x, a.y)
    }
    ctx.restore()
  }

  function getPos(e: React.MouseEvent) {
    const ac = annotRef.current!
    const rect = ac.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (ac.width / rect.width),
      y: (e.clientY - rect.top) * (ac.height / rect.height),
      screenX: e.clientX - rect.left,
      screenY: e.clientY - rect.top,
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    const pos = getPos(e)
    if (activeTool === 'postit') { setPostitPos({ x: pos.x, y: pos.y }); return }
    if (activeTool === 'text') {
      setTextInput({ x: pos.x, y: pos.y, screenX: pos.screenX, screenY: pos.screenY, value: '' })
      setTimeout(() => {
        inlineInputRef.current?.focus()
        if (activeTextInputRef) (activeTextInputRef as any).current = inlineInputRef.current
      }, 30)
      return
    }
    setIsDrawing(true)
    setDragStart({ x: pos.x, y: pos.y })
    if (activeTool === 'pen') setPenPoints([{ x: pos.x, y: pos.y }])
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDrawing) return
    const pos = getPos(e)
    if (activeTool === 'pen') {
      setPenPoints(prev => {
        const pts = [...prev, { x: pos.x, y: pos.y }]
        const ac = annotRef.current
        if (ac) {
          const ctx = ac.getContext('2d')!
          redrawAnnotations(currentPage)
          ctx.save()
          ctx.strokeStyle = activeColor; ctx.lineWidth = 1.75
          ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.85
          ctx.beginPath()
          pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y))
          ctx.stroke(); ctx.restore()
        }
        return pts
      })
    }
  }

  function handleMouseUp(e: React.MouseEvent) {
    if (!isDrawing) return
    setIsDrawing(false)
    const pos = getPos(e)
    const page = mode === 'pdf' ? currentPage : 0

    if (activeTool === 'pen') {
      setAnnotations(prev => [...prev, { id: crypto.randomUUID(), type: 'pen', page, x: 0, y: 0, color: activeColor, points: penPoints }])
      setPenPoints([])
    } else if ((activeTool === 'highlight' || activeTool === 'underline') && dragStart) {
      setAnnotations(prev => [...prev, {
        id: crypto.randomUUID(), type: activeTool, page,
        x: Math.min(dragStart.x, pos.x), y: Math.min(dragStart.y, pos.y),
        width: Math.abs(pos.x - dragStart.x) || 80,
        height: Math.abs(pos.y - dragStart.y) || 16,
        color: activeColor,
      }])
    }
    setDragStart(null)
  }

  function addPostit() {
    if (!postitPos) return
    const page = mode === 'pdf' ? currentPage : 0
    setAnnotations(prev => [...prev, { id: crypto.randomUUID(), type: 'postit', page, x: postitPos.x, y: postitPos.y, color: '#FFF176', text: postitText }])
    setPostitText(''); setPostitPos(null)
  }

  function commitText() {
    if (!textInput) { setTextInput(null); return }
    if (textInput.value.trim()) {
      const page = mode === 'pdf' ? currentPage : 0
      const ac = annotRef.current
      if (ac) {
        const ctx = ac.getContext('2d')!
        ctx.fillStyle = activeColor
        ctx.font = '15px system-ui'
        ctx.fillText(textInput.value, textInput.x, textInput.y)
      }
      setAnnotations(prev => [...prev, { id: crypto.randomUUID(), type: 'text', page, x: textInput.x, y: textInput.y, color: activeColor, text: textInput.value }])
    }
    setTextInput(null)
    if (activeTextInputRef) (activeTextInputRef as any).current = null
  }

  function exportPage() {
    if (!canvasRef.current || !annotRef.current) return
    const merged = document.createElement('canvas')
    merged.width = canvasRef.current.width
    merged.height = canvasRef.current.height
    const ctx = merged.getContext('2d')!
    ctx.drawImage(canvasRef.current, 0, 0)
    ctx.drawImage(annotRef.current, 0, 0)
    const link = document.createElement('a')
    link.download = `streamath-export.png`
    link.href = merged.toDataURL('image/png')
    link.click()
  }

  function loadImages(files: FileList) {
    const imgs = Array.from(files).map(f => ({ url: URL.createObjectURL(f), name: f.name }))
    setImages(prev => [...prev, ...imgs])
    if (!selectedImage && imgs.length > 0) {
      setSelectedImage(imgs[0].url)
      setMode('image')
      drawImageOnCanvas(imgs[0].url)
    }
  }

  function selectImage(url: string) {
    setSelectedImage(url)
    setMode('image')
    setAnnotations([])
    drawImageOnCanvas(url)
  }

  function drawImageOnCanvas(url: string) {
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = img.width
      canvas.height = img.height
      if (annotRef.current) {
        annotRef.current.width = img.width
        annotRef.current.height = img.height
      }
      canvas.getContext('2d')!.drawImage(img, 0, 0)
    }
    img.src = url
  }

  // Toolbar tools
  const tools: { id: AnnotTool; icon: () => JSX.Element; label: string }[] = [
    { id: 'select',    icon: Icon.select,    label: 'Seleziona' },
    { id: 'highlight', icon: Icon.highlight, label: 'Evidenzia' },
    { id: 'underline', icon: Icon.underline, label: 'Sottolinea' },
    { id: 'postit',    icon: Icon.postit,    label: 'Post-it' },
    { id: 'pen',       icon: Icon.pen,       label: 'Penna' },
    { id: 'text',      icon: Icon.text,      label: 'Testo' },
  ]

  const toolbarStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4,
    padding: '6px 10px', background: B.bgCard,
    borderBottom: `1px solid ${B.border}`, flexWrap: 'wrap',
  }

  const toolBtnStyle = (active: boolean): React.CSSProperties => ({
    width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: active ? `1.5px solid ${B.navy}` : `1px solid ${B.border}`,
    borderRadius: 6, background: active ? B.navy : B.bgCard,
    color: active ? B.bgCard : B.text, cursor: 'pointer',
    transition: 'all 0.12s',
  })

  const hasContent = mode === 'pdf' ? !!pdfDoc : !!selectedImage

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: B.bgPage }}>

      {/* Toolbar */}
      <div style={toolbarStyle}>

        {/* Carica PDF */}
        <label title="Carica PDF" style={{ ...toolBtnStyle(false), cursor: 'pointer' }}>
          <Icon.pdf />
          <input type="file" accept=".pdf" style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) loadPdf(e.target.files[0]) }} />
        </label>

        {/* Carica immagine */}
        <label title="Carica immagine" style={{ ...toolBtnStyle(false), cursor: 'pointer' }}>
          <Icon.image />
          <input type="file" accept="image/*" multiple style={{ display: 'none' }}
            onChange={e => { if (e.target.files) loadImages(e.target.files) }} />
        </label>

        <div style={{ width: 1, height: 20, background: B.border, margin: '0 2px' }} />

        {/* Tool buttons */}
        {tools.map(t => (
          <button key={t.id} onClick={() => setActiveTool(t.id)} title={t.label}
            style={toolBtnStyle(activeTool === t.id)}>
            <t.icon />
          </button>
        ))}

        <div style={{ width: 1, height: 20, background: B.border, margin: '0 2px' }} />

        {/* Colori */}
        {ANNOT_COLORS.map(c => (
          <button key={c.id} onClick={() => setActiveColor(c.hex)} title={c.label}
            style={{
              width: 20, height: 20, borderRadius: '50%', background: c.hex,
              border: activeColor === c.hex ? `2.5px solid ${B.navy}` : '1.5px solid rgba(0,0,0,0.15)',
              cursor: 'pointer', flexShrink: 0,
            }} />
        ))}

        <div style={{ flex: 1 }} />

        {/* Undo */}
        <button onClick={() => setAnnotations(prev => prev.slice(0, -1))} title="Annulla ultima"
          style={toolBtnStyle(false)}>
          <Icon.undo />
        </button>

        {/* Export */}
        {hasContent && (
          <button onClick={exportPage} title="Esporta con annotazioni"
            style={{ ...toolBtnStyle(false), background: '#F0FDF4', borderColor: B.green, color: '#16A34A' }}>
            <Icon.download />
          </button>
        )}
      </div>

      {/* Area principale */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar miniature immagini */}
        {images.length > 0 && (
          <div style={{ width: 72, background: B.navy, overflowY: 'auto', padding: 6, display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
            {images.map(img => (
              <div key={img.url} onClick={() => selectImage(img.url)}
                style={{ borderRadius: 4, overflow: 'hidden', cursor: 'pointer', border: selectedImage === img.url && mode === 'image' ? `2px solid ${B.amber}` : '2px solid transparent' }}>
                <img src={img.url} alt={img.name} style={{ width: '100%', height: 52, objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        )}

        {/* Canvas area */}
        <div ref={containerRef} style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16, background: B.bgWarm, position: 'relative' }}>

          {!hasContent ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: B.muted, background: B.bgWarm }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              <p style={{ fontSize: 13, fontWeight: 600 }}>Carica un PDF o un'immagine</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ padding: '7px 16px', background: B.navy, color: B.white, borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  PDF
                  <input type="file" accept=".pdf" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files?.[0]) loadPdf(e.target.files[0]) }} />
                </label>
                <label style={{ padding: '7px 16px', background: B.bgCard, color: B.text, border: `1px solid ${B.border}`, borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  Immagine
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={e => { if (e.target.files) loadImages(e.target.files) }} />
                </label>
              </div>
            </div>
          ) : (
            <>
              <div style={{ position: 'relative', boxShadow: '0 2px 16px rgba(0,0,0,0.12)', marginBottom: 12 }}>
                <canvas ref={canvasRef} style={{ display: 'block', maxWidth: '100%' }} />
                <canvas ref={annotRef}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: activeTool === 'select' ? 'default' : activeTool === 'text' ? 'text' : 'crosshair' }}
                />

                {/* Input testo inline */}
                {textInput && (
                  <div style={{ position: 'absolute', left: textInput.screenX, top: textInput.screenY - 22, zIndex: 200, display: 'flex', gap: 3 }}>
                    <input ref={inlineInputRef} value={textInput.value}
                      onChange={e => setTextInput(prev => prev ? { ...prev, value: e.target.value } : null)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitText() } if (e.key === 'Escape') setTextInput(null) }}
                      onBlur={() => setTimeout(commitText, 150)}
                      style={{ minWidth: 140, padding: '4px 8px', fontSize: 14, color: activeColor, background: 'rgba(255,255,255,0.97)', border: `1.5px solid ${activeColor}`, borderRadius: 5, outline: 'none', boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}
                      placeholder="Scrivi... (Invio ✓)" />
                    <button onMouseDown={e => { e.preventDefault(); commitText() }}
                      style={{ padding: '4px 8px', background: B.navy, color: B.white, border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✓</button>
                    <button onMouseDown={e => { e.preventDefault(); setTextInput(null) }}
                      style={{ padding: '4px 8px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>✕</button>
                  </div>
                )}

                {/* Post-it input */}
                {postitPos && (
                  <div style={{ position: 'absolute', left: postitPos.x * (annotRef.current ? annotRef.current.getBoundingClientRect().width / annotRef.current.width : 1), top: postitPos.y * (annotRef.current ? annotRef.current.getBoundingClientRect().height / annotRef.current.height : 1), zIndex: 200, background: '#FFF176', border: '1px solid #CA8A04', borderRadius: 5, padding: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
                    <textarea autoFocus value={postitText} onChange={e => setPostitText(e.target.value)}
                      style={{ width: 140, height: 60, border: 'none', background: 'transparent', resize: 'none', fontSize: 12, outline: 'none' }} placeholder="Scrivi nota..." />
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      <button onClick={addPostit} style={{ flex: 1, padding: '3px 8px', background: B.navy, color: B.white, border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>Aggiungi</button>
                      <button onClick={() => setPostitPos(null)} style={{ padding: '3px 8px', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>✕</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigazione PDF */}
              {mode === 'pdf' && pdfDoc && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', background: B.white, borderRadius: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    style={{ width: 28, height: 28, border: `1px solid ${B.border}`, borderRadius: 5, background: currentPage === 1 ? B.bgWarm : B.navy, color: currentPage === 1 ? B.muted : B.white, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}>‹</button>
                  <span style={{ fontSize: 12, fontWeight: 600, color: B.muted }}>Pag. {currentPage} / {totalPages}</span>
                  <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                    style={{ width: 28, height: 28, border: `1px solid ${B.border}`, borderRadius: 5, background: currentPage === totalPages ? B.bgWarm : B.navy, color: currentPage === totalPages ? B.muted : B.white, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 14 }}>›</button>
                  <label style={{ padding: '4px 10px', background: B.bgWarm, border: `1px solid ${B.border}`, borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600, color: B.text }}>
                    Cambia PDF
                    <input type="file" accept=".pdf" style={{ display: 'none' }}
                      onChange={e => { if (e.target.files?.[0]) loadPdf(e.target.files[0]) }} />
                  </label>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

function ChatPanel({ sessioneId, userId, userEmail, isAdmin }: { sessioneId: string; userId: string; userEmail: string; isAdmin: boolean }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    supabase.from('chat_streamath').select('*').eq('sessione_id', sessioneId)
      .order('created_at', { ascending: true }).limit(100)
      .then(({ data }) => { if (data) setMessages(data.map((r: any) => ({ id: r.id, user_email: r.user_email, testo: r.testo, ts: r.created_at }))) })

    const ch = supabase.channel(`chat:${sessioneId}`)
    ch.on('broadcast', { event: 'msg' }, ({ payload }: { payload: ChatMsg }) => setMessages(prev => [...prev, payload])).subscribe()
    channelRef.current = ch
    return () => { ch.unsubscribe() }
  }, [sessioneId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function sendMsg() {
    const testo = input.trim()
    if (!testo) return
    setInput('')
    const msg: ChatMsg = { id: crypto.randomUUID(), user_email: userEmail, testo, ts: new Date().toISOString() }
    await supabase.from('chat_streamath').insert({ id: msg.id, sessione_id: sessioneId, user_id: userId, user_email: userEmail, testo })
    channelRef.current?.send({ type: 'broadcast', event: 'msg', payload: msg })
    setMessages(prev => [...prev, msg])
  }

  const isMe = (email: string) => email === userEmail

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: B.bgCard }}>
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${B.border}`, fontSize: 11, fontWeight: 700, color: B.muted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        Chat
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && <p style={{ color: B.border, fontSize: 12, textAlign: 'center', marginTop: 24 }}>Nessun messaggio</p>}
        {messages.map(m => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe(m.user_email) ? 'flex-end' : 'flex-start' }}>
            <span style={{ fontSize: 10, color: B.muted, marginBottom: 2 }}>
              {m.user_email.split('@')[0]} · {new Date(m.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <div style={{
              maxWidth: '85%', padding: '6px 10px',
              borderRadius: isMe(m.user_email) ? '10px 10px 3px 10px' : '10px 10px 10px 3px',
              background: isMe(m.user_email) ? B.navy : B.light,
              color: isMe(m.user_email) ? B.white : B.text,
              fontSize: 13, lineHeight: 1.4, wordBreak: 'break-word',
            }}>{m.testo}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: '8px 10px', borderTop: `1px solid ${B.border}`, display: 'flex', gap: 6 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() } }}
          placeholder="Scrivi..."
          style={{ flex: 1, padding: '6px 10px', border: `1px solid ${B.border}`, borderRadius: 7, fontSize: 13, outline: 'none', background: B.bgWarm }} />
        <button onClick={sendMsg}
          style={{ width: 32, height: 32, background: B.navy, color: B.white, border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon.send />
        </button>
      </div>
    </div>
  )
}

// ─── LaTeX Keyboard ───────────────────────────────────────────────────────────

function LatexKeyboard({ onInsert }: { onInsert: (val: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ background: B.navy, borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
      <button onMouseDown={e => { e.preventDefault(); setExpanded(x => !x) }}
        style={{ width: '100%', padding: '5px 14px', background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 10, fontWeight: 700, textAlign: 'left', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points={expanded ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}/></svg>
        Tastiera LaTeX
      </button>
      {expanded && (
        <div style={{ padding: '6px 10px 10px', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {LATEX_KEYS.map(k => (
            <button key={k.val} onMouseDown={e => { e.preventDefault(); onInsert(k.val) }} title={k.val}
              style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.07)', color: B.white, border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontWeight: 500, minWidth: 32, textAlign: 'center' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}>
              {k.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SessionRoom principale ───────────────────────────────────────────────────

export default function SessionRoom({ sessioneId, sessioneCodice, sessioneNome, userId, userEmail, isAdmin, onEsci, onConcludi }: Props) {
  const [activePanel, setActivePanel] = useState<PanelType>('whiteboard')
  const [splitMode, setSplitMode] = useState(false)
  const whiteboardRef = useRef<HTMLIFrameElement>(null)
  const mathPanelRef = useRef<HTMLIFrameElement>(null)
  const pdfTextInputRef = useRef<HTMLInputElement>(null)
  const videoPanelRef = useRef<VideoPanelHandle>(null)

  // Ascolta cambio stato sessione — se diventa 'conclusa' espelli tutti
  useEffect(() => {
    const channel = supabase
      .channel(`sessione:${sessioneId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessioni_streamath',
        filter: `id=eq.${sessioneId}`,
      }, async (payload) => {
        if (payload.new?.stato === 'conclusa') {
          await videoPanelRef.current?.endMeeting()
          onEsci()
        }
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [sessioneId])

  function handleLatexInsert(val: string) {
    const el = pdfTextInputRef.current as HTMLInputElement | null
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end = el.selectionEnd ?? el.value.length
    const newVal = el.value.slice(0, start) + val + el.value.slice(end)
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(el, newVal)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    requestAnimationFrame(() => { el.selectionStart = start + val.length; el.selectionEnd = start + val.length; el.focus() })
  }

  const navButtons: { id: PanelType; icon: () => JSX.Element; label: string }[] = [
    { id: 'whiteboard', icon: Icon.whiteboard, label: 'Lavagna' },
    { id: 'mathpanel',  icon: Icon.math,       label: 'Math' },
    { id: 'media',      icon: Icon.media,      label: 'Media' },
  ]

  function renderMainPanel() {
    if (splitMode) {
      return (
        <div style={{ display: 'flex', height: '100%' }}>
          <div style={{ flex: 1, borderRight: `1px solid ${B.border}`, overflow: 'hidden' }}>
            <WhiteboardEmbed ref={whiteboardRef} sessioneId={sessioneId} isAdmin={isAdmin} />
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <MathPanelEmbed ref={mathPanelRef} sessioneId={sessioneId} />
          </div>
        </div>
      )
    }
    switch (activePanel) {
      case 'whiteboard': return <WhiteboardEmbed ref={whiteboardRef} sessioneId={sessioneId} isAdmin={isAdmin} />
      case 'mathpanel':  return <MathPanelEmbed ref={mathPanelRef} sessioneId={sessioneId} />
      case 'media':      return <AnnotationViewer activeTextInputRef={pdfTextInputRef} />
    }
  }

  const navBtnStyle = (active: boolean): React.CSSProperties => ({
    width: 52, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 4, padding: '8px 4px', border: 'none', borderRadius: 8, cursor: 'pointer',
    background: active ? B.navy : 'transparent',
    color: active ? B.bgCard : B.muted,
    transition: 'all 0.12s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, -apple-system, sans-serif', background: B.bgPage, overflow: 'hidden' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 64, background: '#FAF9F7', flexShrink: 0, borderBottom: '1px solid #E4E2DD', boxShadow: '0 1px 8px rgba(26,35,50,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {/* Brand MatHeight */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ height: '1.5px', width: 110, background: 'linear-gradient(90deg, transparent, #4a90d9 40%, #4a90d9 60%, transparent)' }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <h1 style={{ fontFamily: "'Georgia', serif", fontSize: '1.1rem', fontWeight: 400, letterSpacing: '5px', color: '#f5bc76', margin: 0, whiteSpace: 'nowrap' }}>MatHeight</h1>
              <span style={{ fontSize: '0.65rem', fontWeight: 600, letterSpacing: '3px', color: 'rgba(245,188,118,0.5)', textTransform: 'uppercase' }}>StreaMath</span>
            </div>
            <div style={{ height: '1.5px', width: 110, background: 'linear-gradient(90deg, transparent, #8B0000 40%, #8B0000 60%, transparent)' }} />
          </div>
          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(26,35,50,0.7)', letterSpacing: '0.3px' }}>{sessioneNome}</span>
            <code style={{ fontSize: 10, color: 'rgba(26,35,50,0.3)', letterSpacing: '1px' }}>#{sessioneCodice}</code>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/streamath/${sessioneCodice}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#FAF9F7', color: '#1a2332', border: '1px solid #E4E2DD', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
            <Icon.link /> Copia link
          </button>
          <a href="/academy/" target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: '#FAF9F7', color: '#1a2332', border: '1px solid #E4E2DD', borderRadius: 5, fontSize: 11, textDecoration: 'none', fontWeight: 500 }}>
            <Icon.academy /> Academy
          </a>
          {isAdmin && (
            <button onClick={async () => {
              if (confirm('Concludere la sessione per tutti?')) {
                await videoPanelRef.current?.endMeeting()
                onConcludi()
              }
            }}
              style={{ padding: '4px 10px', background: '#DC2626', color: '#FFFFFF', border: 'none', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
              Concludi
            </button>
          )}
          <button onClick={onEsci}
            style={{ padding: '4px 12px', background: 'transparent', color: '#1a2332', border: '1px solid #E4E2DD', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
            ← Sessioni
          </button>
          <span style={{ fontSize: 11, color: 'rgba(26,35,50,0.4)' }}>{userEmail.split('@')[0]}</span>
        </div>
      </header>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar sinistra */}
        <div style={{ width: 64, background: B.bgCard, borderRight: `1px solid ${B.border}`, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0', gap: 3, flexShrink: 0 }}>
          {navButtons.map(btn => (
            <button key={btn.id} onClick={() => { setActivePanel(btn.id); setSplitMode(false) }} title={btn.label}
              style={navBtnStyle(activePanel === btn.id && !splitMode)}
              onMouseEnter={e => { if (activePanel !== btn.id || splitMode) (e.currentTarget as HTMLButtonElement).style.background = B.light }}
              onMouseLeave={e => { if (activePanel !== btn.id || splitMode) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
              <btn.icon />
              <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.02em' }}>{btn.label}</span>
            </button>
          ))}

          <div style={{ width: 36, height: 1, background: B.border, margin: '4px 0' }} />

          <button onClick={() => setSplitMode(s => !s)} title="Split: Lavagna + Math"
            style={navBtnStyle(splitMode)}
            onMouseEnter={e => { if (!splitMode) (e.currentTarget as HTMLButtonElement).style.background = B.light }}
            onMouseLeave={e => { if (!splitMode) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}>
            <Icon.split />
            <span style={{ fontSize: 9, fontWeight: 600 }}>Split</span>
          </button>
        </div>

        {/* Pannello centrale */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {renderMainPanel()}
        </div>

        {/* Pannello destro */}
        <div style={{ width: 280, borderLeft: `1px solid ${B.border}`, display: 'flex', flexDirection: 'column', flexShrink: 0, background: B.bgCard, overflow: 'hidden' }}>
          <VideoPanel ref={videoPanelRef} sessioneId={sessioneId} sessioneCodice={sessioneCodice} userId={userId} userEmail={userEmail} isAdmin={isAdmin} />
          <ChatPanel sessioneId={sessioneId} userId={userId} userEmail={userEmail} isAdmin={isAdmin} />
        </div>

      </div>

      {/* Footer LaTeX — solo nel pannello Media */}
      {activePanel === 'media' && !splitMode && (
        <LatexKeyboard onInsert={handleLatexInsert} />
      )}

    </div>
  )
}