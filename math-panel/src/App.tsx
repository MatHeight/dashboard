import { useState, useEffect, useRef } from 'react'
import Plot from 'react-plotly.js'
import { create, all } from 'mathjs'
import './App.css'
import { supabase } from './lib/supabase'

const math = create(all, {})

math.config({
  number: 'number'
})

const BRAND = {
  navy: '#001F3F',
  bordeaux: '#6B0F1A',
  lightGray: '#F8F9FA',
  mediumGray: '#E9ECEF',
  darkGray: '#495057',
  white: '#FFFFFF'
}

interface Equation {
  id: string
  expression: string
  color: string
  visible: boolean
  type: 'function' | 'point' | 'line'
}

interface SerializableEquation {
  id: string
  expression: string
  color: string
  visible: boolean
  type: 'function' | 'point' | 'line'
}

function App() {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [equations, setEquations] = useState<Equation[]>([])
  const [inputValue, setInputValue] = useState('')
  const [viewBounds, setViewBounds] = useState({ x: [-10, 10], y: [-10, 10] })

  // Drawing state
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const plotContainerRef = useRef<HTMLDivElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawingEnabled, setDrawingEnabled] = useState(false)
  const [drawColor, setDrawColor] = useState('#dc2626')
  const [drawWidth, setDrawWidth] = useState(3)
  const [drawTool, setDrawTool] = useState<'pen' | 'eraser' | 'line'>('pen')
  const [lineStart, setLineStart] = useState<{x: number, y: number} | null>(null)
  const [savedCanvas, setSavedCanvas] = useState<ImageData | null>(null)

  const colors = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#84cc16', '#f59e0b']

  const mathButtons = [
    { label: 'x²', value: 'x^2' },
    { label: 'x³', value: 'x^3' },
    { label: '√', value: 'sqrt(' },
    { label: 'π', value: 'pi' },
    { label: 'e', value: 'e' },
    { label: '^', value: '^' },
    { label: 'sin', value: 'sin(' },
    { label: 'cos', value: 'cos(' },
    { label: 'tan', value: 'tan(' },
    { label: 'asin', value: 'asin(' },
    { label: 'acos', value: 'acos(' },
    { label: 'atan', value: 'atan(' },
    { label: 'ln', value: 'log(' },
    { label: 'log', value: 'log10(' },
    { label: 'abs', value: 'abs(' },
    { label: 'exp', value: 'exp(' },
    { label: '/', value: '/' },
    { label: '*', value: '*' },
    { label: '(', value: '(' },
    { label: ')', value: ')' },
  ]

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()

        if (error || !session) {
          setIsAuthorized(false)
          setIsLoading(false)
          return
        }

        setIsAuthorized(true)
        setIsLoading(false)
      } catch (error) {
        setIsAuthorized(false)
        setIsLoading(false)
      }
    }

    checkAuth()
  }, [])

  // Listener postMessage dalla tastiera LaTeX in SessionRoom
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'latex-insert') {
        setInputValue(prev => prev + e.data.val)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const parent = canvas.parentElement
      if (parent) {
        canvas.width = parent.offsetWidth
        canvas.height = parent.offsetHeight
      }
    }

    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [equations])

  const parseFunctionWithMathJS = (expr: string) => {
    try {
      let cleaned = expr.replace(/^y\s*=\s*/i, '').trim()
      cleaned = cleaned.replace(/π/g, 'pi')

      const compiled = math.compile(cleaned)

      const fn = (x: number) => {
        try {
          const result = compiled.evaluate({ x })

          if (typeof result !== 'number') return null
          if (!isFinite(result) || isNaN(result)) return null

          return result
        } catch {
          return null
        }
      }

      return fn
    } catch {
      return null
    }
  }

  const smartParse = (input: string): { type: 'function' | 'point' | 'line' } | null => {
    const cleaned = input.trim()

    const pointMatch = cleaned.match(/^\(?\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\)?$/)
    if (pointMatch) return { type: 'point' }

    const lineExpr = cleaned.replace(/\s/g, '')
    let lineMatch = lineExpr.match(/^y=(-?\d+\.?\d*)\*?x([+-]\d+\.?\d*)?$/)
    if (lineMatch) return { type: 'line' }

    lineMatch = lineExpr.match(/^(-?\d+\.?\d*)\*?x([+-]\d+\.?\d*)?$/)
    if (lineMatch) return { type: 'line' }

    const fn = parseFunctionWithMathJS(cleaned)
    if (fn) return { type: 'function' }

    return null
  }

  const addEquation = () => {
    if (!inputValue.trim()) return

    const result = smartParse(inputValue)
    if (!result) {
      alert('❌ Espressione non valida. Esempi:\n\n• sin(x)/(2*x-1)\n• x^2 + 3*x - 5\n• sqrt(abs(x))\n• log(x)/x\n• (2, 3) per un punto')
      return
    }

    const newEquation: Equation = {
      id: Date.now().toString(),
      expression: inputValue,
      color: colors[equations.length % colors.length],
      visible: true,
      type: result.type
    }

    setEquations(prev => [...prev, newEquation])
    setInputValue('')
  }

  const removeEquation = (id: string) => {
    setEquations(prev => prev.filter(eq => eq.id !== id))
  }

  const toggleVisibility = (id: string) => {
    setEquations(prev =>
      prev.map(eq => eq.id === id ? { ...eq, visible: !eq.visible } : eq)
    )
  }

  const insertSymbol = (symbol: string) => {
    setInputValue(prev => prev + symbol)
  }

  const updateViewBounds = (newBounds: any) => {
    setViewBounds(newBounds)
  }

  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawingEnabled) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setIsDrawing(true)

    if (drawTool === 'line') {
      setLineStart({ x, y })
      setSavedCanvas(ctx.getImageData(0, 0, canvas.width, canvas.height))
    } else {
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingEnabled) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (drawTool === 'line') {
      if (lineStart && savedCanvas) {
        ctx.putImageData(savedCanvas, 0, 0)
        ctx.strokeStyle = drawColor
        ctx.lineWidth = drawWidth
        ctx.lineCap = 'round'
        ctx.globalCompositeOperation = 'source-over'
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(lineStart.x, lineStart.y)
        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.setLineDash([])
      }
    } else {
      ctx.lineWidth = drawTool === 'eraser' ? 20 : drawWidth
      ctx.lineCap = 'round'
      ctx.strokeStyle = drawTool === 'eraser' ? '#ffffff' : drawColor
      ctx.globalCompositeOperation = drawTool === 'eraser' ? 'destination-out' : 'source-over'
      ctx.lineTo(x, y)
      ctx.stroke()
    }
  }

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingEnabled) return

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (drawTool === 'line' && lineStart && savedCanvas) {
      ctx.putImageData(savedCanvas, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = drawColor
      ctx.lineWidth = drawWidth
      ctx.lineCap = 'round'
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(lineStart.x, lineStart.y)
      ctx.lineTo(x, y)
      ctx.stroke()
      setLineStart(null)
      setSavedCanvas(null)
    }

    setIsDrawing(false)
    ctx.beginPath()
  }

  const clearDrawing = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }

  const addWatermark = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    const fontSize = Math.max(12, Math.round(w * 0.013))
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`
    ctx.fillStyle = 'rgba(107, 15, 26, 0.6)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('https://youtube.com/@MatHeightProject', w - 20, h - 20)
  }

  const exportToPNG = () => {
    const container = plotContainerRef.current
    if (!container) return
    const defaultName = `MatHeight-grafici-${new Date().toISOString().slice(0,10)}`
    const userInput = prompt('Nome del file:', defaultName)
    if (userInput === null) return // annullato
    const filename = userInput.trim() || defaultName
    // Usa Plotly.toImage per ottenere il PNG base64, poi aggiunge watermark
    const plotlyDiv = container.querySelector('.js-plotly-plot') as any
    if (plotlyDiv && (window as any).Plotly) {
      ;(window as any).Plotly.toImage(plotlyDiv, {
        format: 'png',
        width: 1400,
        height: 900,
        scale: 2
      }).then((dataUrl: string) => {
        const img = new Image()
        img.onload = () => {
          const exportCanvas = document.createElement('canvas')
          exportCanvas.width = img.width
          exportCanvas.height = img.height
          const ctx = exportCanvas.getContext('2d')
          if (!ctx) return
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
          ctx.drawImage(img, 0, 0)
          // Sovrapponi il layer di disegno scalato
          const drawingCanvas = canvasRef.current
          if (drawingCanvas) {
            ctx.drawImage(drawingCanvas, 0, 0, exportCanvas.width, exportCanvas.height)
          }
          addWatermark(ctx, exportCanvas.width, exportCanvas.height)
          const link = document.createElement('a')
          link.download = filename + '.png'
          link.href = exportCanvas.toDataURL('image/png')
          link.click()
        }
        img.src = dataUrl
      })
      return
    }
    // Fallback SVG -> Canvas con sfondo bianco
    const svgEl = container.querySelector('svg') as SVGSVGElement | null
    if (!svgEl) return
    const bbox = svgEl.getBoundingClientRect()
    const w = Math.round(bbox.width) || 1400
    const h = Math.round(bbox.height) || 900
    const svgData = new XMLSerializer().serializeToString(svgEl)
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = w * 2
    exportCanvas.height = h * 2
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, exportCanvas.width, exportCanvas.height)
      // Sovrapponi il layer di disegno scalato
      const drawingCanvas = canvasRef.current
      if (drawingCanvas) {
        ctx.drawImage(drawingCanvas, 0, 0, exportCanvas.width, exportCanvas.height)
      }
      addWatermark(ctx, exportCanvas.width, exportCanvas.height)
      const link = document.createElement('a')
      link.download = filename + '.png'
      link.href = exportCanvas.toDataURL('image/png')
      link.click()
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

  const generatePlotlyData = () => {
    const data: any[] = []

    equations.forEach((eq) => {
      if (!eq.visible) return

      if (eq.type === 'function') {
        const fn = parseFunctionWithMathJS(eq.expression)
        if (!fn) return

        const [xMin, xMax] = viewBounds.x
        const numPoints = 5000
        const step = (xMax - xMin) / numPoints

        const segments: { x: number[], y: number[] }[] = []
        let currentSegment = { x: [] as number[], y: [] as number[] }
        let lastValidY: number | null = null
        let consecutiveNulls = 0

        for (let i = 0; i <= numPoints; i++) {
          const x = xMin + i * step
          const y = fn(x)

          if (y !== null && isFinite(y)) {
            if (lastValidY !== null) {
              const slope = Math.abs(y - lastValidY) / step
              if (slope > 1000) {
                if (currentSegment.x.length > 1) segments.push(currentSegment)
                currentSegment = { x: [], y: [] }
              }
            }
            currentSegment.x.push(x)
            currentSegment.y.push(y)
            lastValidY = y
            consecutiveNulls = 0
          } else {
            consecutiveNulls++
            if (consecutiveNulls >= 3) {
              if (currentSegment.x.length > 1) segments.push(currentSegment)
              currentSegment = { x: [], y: [] }
              lastValidY = null
            }
          }
        }

        if (currentSegment.x.length > 1) segments.push(currentSegment)

        segments.forEach((segment, index) => {
          data.push({
            x: segment.x,
            y: segment.y,
            type: 'scatter',
            mode: 'lines',
            name: index === 0 ? eq.expression : undefined,
            showlegend: index === 0,
            legendgroup: eq.id,
            line: { color: eq.color, width: 3 },
            hovertemplate: `${eq.expression}<br>x: %{x:.3f}<br>y: %{y:.3f}<extra></extra>`
          })
        })

      } else if (eq.type === 'line') {
        const expr = eq.expression.replace(/\s/g, '')
        const match = expr.match(/^y?=?(-?\d+\.?\d*)\*?x([+-]\d+\.?\d*)?$/)

        if (match) {
          const slope = parseFloat(match[1])
          const intercept = match[2] ? parseFloat(match[2]) : 0
          const [xMin, xMax] = viewBounds.x
          const xValues = [xMin, xMax]
          const yValues = xValues.map(x => slope * x + intercept)

          data.push({
            x: xValues,
            y: yValues,
            type: 'scatter',
            mode: 'lines',
            name: eq.expression,
            line: { color: eq.color, width: 3 }
          })
        }

      } else if (eq.type === 'point') {
        const match = eq.expression.match(/^\(?\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*\)?$/)
        if (match) {
          data.push({
            x: [parseFloat(match[1])],
            y: [parseFloat(match[2])],
            type: 'scatter',
            mode: 'markers',
            name: eq.expression,
            marker: { color: eq.color, size: 12 }
          })
        }
      }
    })

    return data
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'function': return '📈'
      case 'line': return '📏'
      case 'point': return '📍'
      default: return '•'
    }
  }

  // ── Loading ──────────────────────────────────────────────
  if (isLoading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px',
        background: BRAND.lightGray,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}>
        <div style={{ fontSize: '48px' }}>📐</div>
        <div style={{ fontSize: '16px', color: BRAND.navy, fontWeight: '600' }}>
          Verifica autenticazione...
        </div>
      </div>
    )
  }

  // ── Not authorized ───────────────────────────────────────
  if (!isAuthorized) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px',
        background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.bordeaux} 100%)`,
        color: 'white',
        padding: '40px',
        textAlign: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      }}>
        <div style={{ fontSize: '64px' }}>🔒</div>
        <div style={{ fontSize: '24px', fontWeight: '700' }}>Accesso Negato</div>
        <div style={{ fontSize: '16px', opacity: 0.9, maxWidth: '400px', lineHeight: '1.6' }}>
          Accedi alla dashboard MatHeight per utilizzare questo strumento.
        </div>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            marginTop: '12px',
            padding: '12px 28px',
            background: 'white',
            color: BRAND.navy,
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '700',
            fontSize: '15px'
          }}
        >
          Vai alla Dashboard
        </button>
      </div>
    )
  }

  // ── Main standalone layout ───────────────────────────────
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: BRAND.white,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>

      {/* ── Header ── */}
      <div style={{
        padding: '12px 20px',
        background: `linear-gradient(135deg, ${BRAND.navy} 0%, ${BRAND.bordeaux} 100%)`,
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '12px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '20px', fontWeight: '700' }}>📊 Grafici Matematici</span>
          {equations.length > 0 && (
            <span style={{
              fontSize: '12px',
              background: 'rgba(255,255,255,0.2)',
              padding: '4px 10px',
              borderRadius: '12px',
              fontWeight: '600'
            }}>
              {equations.length} {equations.length === 1 ? 'equazione' : 'equazioni'}
            </span>
          )}
        </div>

        {/* Drawing toolbar */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setDrawingEnabled(!drawingEnabled)}
            style={{
              padding: '6px 12px',
              background: drawingEnabled ? BRAND.bordeaux : 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            ✏️ {drawingEnabled ? 'Disegno ON' : 'Disegno OFF'}
          </button>

          {drawingEnabled && (
            <>
              {(['pen', 'line', 'eraser'] as const).map(tool => (
                <button
                  key={tool}
                  onClick={() => setDrawTool(tool)}
                  title={tool === 'pen' ? 'Penna' : tool === 'line' ? 'Linea retta' : 'Gomma'}
                  style={{
                    padding: '6px 12px',
                    background: drawTool === tool ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  {tool === 'pen' ? '🖊️' : tool === 'line' ? '📏' : '🧹'}
                </button>
              ))}

              <input
                type="color"
                value={drawColor}
                onChange={(e) => setDrawColor(e.target.value)}
                style={{ width: '30px', height: '30px', border: '2px solid white', borderRadius: '6px', cursor: 'pointer' }}
                title="Colore"
              />

              <input
                type="range"
                min="1"
                max="10"
                value={drawWidth}
                onChange={(e) => setDrawWidth(Number(e.target.value))}
                style={{ width: '60px' }}
                title={`Spessore: ${drawWidth}px`}
              />

              <button
                onClick={clearDrawing}
                style={{
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
                title="Cancella disegno"
              >
                🗑️
              </button>
            </>
          )}
          <button
            onClick={exportToPNG}
            disabled={equations.length === 0}
            style={{
              padding: '6px 14px',
              background: equations.length === 0 ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '6px',
              cursor: equations.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '600',
              opacity: equations.length === 0 ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
            title="Esporta grafico come PNG"
          >
            💾 Esporta PNG
          </button>
        </div>
      </div>

      {/* ── Body: sidebar + grafico ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Sidebar sinistra */}
        <div style={{
          width: '300px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${BRAND.mediumGray}`,
          background: BRAND.white
        }}>

          {/* Input */}
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BRAND.mediumGray}` }}>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addEquation()}
              placeholder="es: sin(x)/(2*x-1)"
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: `2px solid ${BRAND.mediumGray}`,
                fontSize: '13px',
                outline: 'none',
                fontFamily: 'monospace',
                marginBottom: '8px',
                boxSizing: 'border-box'
              }}
              onFocus={e => e.currentTarget.style.borderColor = BRAND.navy}
              onBlur={e => e.currentTarget.style.borderColor = BRAND.mediumGray}
            />
            <button
              onClick={addEquation}
              style={{
                width: '100%',
                padding: '9px',
                background: `linear-gradient(135deg, ${BRAND.navy}, ${BRAND.bordeaux})`,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '13px'
              }}
            >
              + Aggiungi equazione
            </button>
          </div>

          {/* Tasti matematici */}
          <div style={{
            padding: '12px 16px',
            borderBottom: `1px solid ${BRAND.mediumGray}`,
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '4px'
            }}>
              {mathButtons.map((btn) => (
                <button
                  key={btn.label}
                  onClick={() => insertSymbol(btn.value)}
                  style={{
                    padding: '7px 4px',
                    background: BRAND.lightGray,
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = BRAND.navy
                    e.currentTarget.style.color = 'white'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = BRAND.lightGray
                    e.currentTarget.style.color = 'black'
                  }}
                >
                  {btn.label}
                </button>
              ))}

              <button
                onClick={() => setInputValue(prev => prev.slice(0, -1))}
                style={{
                  padding: '7px 4px',
                  background: BRAND.bordeaux,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              >⌫</button>

              <button
                onClick={() => setInputValue('')}
                style={{
                  padding: '7px 4px',
                  background: BRAND.bordeaux,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '700'
                }}
              >C</button>
            </div>
          </div>

          {/* Lista equazioni */}
          <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto' }}>
            {equations.length === 0 ? (
              <div style={{
                textAlign: 'center',
                color: BRAND.darkGray,
                fontSize: '12px',
                marginTop: '24px',
                opacity: 0.6,
                lineHeight: '1.6'
              }}>
                Nessuna equazione ancora.<br />
                Prova: <code>sin(x)/(2*x-1)</code>
              </div>
            ) : (
              equations.map((eq) => (
                <div
                  key={eq.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    background: BRAND.lightGray,
                    borderRadius: '8px',
                    fontSize: '12px',
                    marginBottom: '6px',
                    border: `2px solid ${eq.visible ? eq.color : BRAND.mediumGray}`
                  }}
                >
                  <span style={{ fontSize: '14px' }}>{getTypeIcon(eq.type)}</span>
                  <span style={{
                    flex: 1,
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    fontWeight: '600',
                    wordBreak: 'break-all'
                  }}>
                    {eq.expression}
                  </span>
                  <button
                    onClick={() => toggleVisibility(eq.id)}
                    style={{ padding: '2px 6px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    title={eq.visible ? 'Nascondi' : 'Mostra'}
                  >
                    {eq.visible ? '👁️' : '👁️‍🗨️'}
                  </button>
                  <button
                    onClick={() => removeEquation(eq.id)}
                    style={{
                      padding: '3px 7px',
                      background: BRAND.bordeaux,
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      fontWeight: '700'
                    }}
                  >✕</button>
                </div>
              ))
            )}
          </div>

          {/* Footer sidebar */}
          {equations.length > 0 && (
            <div style={{ padding: '12px 16px', borderTop: `1px solid ${BRAND.mediumGray}` }}>
              <button
                onClick={() => {
                  if (confirm('🗑️ Cancellare tutte le equazioni?')) {
                    setEquations([])
                  }
                }}
                style={{
                  width: '100%',
                  padding: '9px',
                  background: BRAND.bordeaux,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600'
                }}
              >
                🗑️ Cancella Tutto
              </button>
            </div>
          )}
        </div>

        {/* Area grafico */}
        <div style={{ flex: 1, padding: '16px', overflow: 'hidden', background: '#fafafa', position: 'relative' }}>
          {equations.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: BRAND.darkGray,
              textAlign: 'center'
            }}>
              <div>
                <div style={{ fontSize: '64px', marginBottom: '20px' }}>📐</div>
                <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                  Nessuna equazione da visualizzare
                </div>
                <div style={{ fontSize: '14px', opacity: 0.7 }}>
                  Aggiungi un'equazione dal pannello a sinistra
                </div>
              </div>
            </div>
          ) : (
            <div
              ref={plotContainerRef}
              style={{
              width: '100%',
              height: '100%',
              background: 'white',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              overflow: 'hidden',
              position: 'relative'
            }}>
              <Plot
                data={generatePlotlyData()}
                layout={{
                  xaxis: {
                    range: viewBounds.x,
                    title: { text: 'x' },
                    gridcolor: '#e0e0e0',
                    zeroline: true,
                    zerolinecolor: '#666',
                    zerolinewidth: 2
                  },
                  yaxis: {
                    range: viewBounds.y,
                    title: { text: 'y' },
                    gridcolor: '#e0e0e0',
                    zeroline: true,
                    zerolinecolor: '#666',
                    zerolinewidth: 2
                  },
                  showlegend: true,
                  legend: {
                    x: 1,
                    xanchor: 'right',
                    y: 1,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    bordercolor: '#ccc',
                    borderwidth: 1
                  },
                  margin: { l: 60, r: 20, t: 20, b: 60 },
                  paper_bgcolor: 'white',
                  plot_bgcolor: 'white',
                  hovermode: 'closest'
                }}
                config={{
                  displayModeBar: true,
                  displaylogo: false,
                  modeBarButtonsToRemove: ['select2d', 'lasso2d'],
                  toImageButtonOptions: {
                    format: 'png',
                    filename: 'MatHeight-grafico',
                    height: 800,
                    width: 1200,
                    scale: 2
                  }
                }}
                style={{ width: '100%', height: '100%' }}
                onRelayout={(event: any) => {
                  if (event['xaxis.range[0]'] !== undefined) {
                    updateViewBounds({
                      x: [event['xaxis.range[0]'], event['xaxis.range[1]']],
                      y: [event['yaxis.range[0]'], event['yaxis.range[1]']]
                    })
                  }
                }}
              />

              {/* Drawing Canvas Overlay */}
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={() => {
                  setIsDrawing(false)
                  setLineStart(null)
                  setSavedCanvas(null)
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: drawingEnabled ? 'auto' : 'none',
                  cursor: drawingEnabled
                    ? (drawTool === 'eraser' ? 'cell' : 'crosshair')
                    : 'default'
                }}
              />
            </div>
          )}

          {/* Watermark */}
          <div style={{
            position: 'absolute',
            bottom: '28px',
            right: '28px',
            color: BRAND.bordeaux,
            fontSize: '13px',
            opacity: 0.5,
            fontWeight: '600',
            pointerEvents: 'none',
            letterSpacing: '0.3px'
          }}>
            https://youtube.com/@MatHeightProject
          </div>
        </div>
      </div>
    </div>
  )
}

export default App