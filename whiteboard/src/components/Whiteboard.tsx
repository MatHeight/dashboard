import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

interface WhiteboardProps {
  boardId: string
  isMaster: boolean
  onLogout: () => void
}

interface DrawData {
  type: 'draw' | 'clear' | 'text' | 'shape' | 'restore' | 'paste'
  x?: number
  y?: number
  prevX?: number
  prevY?: number
  color?: string
  lineWidth?: number
  text?: string
  fontSize?: number
  shapeType?: 'rectangle' | 'circle' | 'line'
  width?: number
  height?: number
  imageData?: string
}

const BRAND = {
  navy: '#001F3F',
  bordeaux: '#6B0F1A',
  lightGray: '#F8F9FA',
  mediumGray: '#E9ECEF',
  darkGray: '#495057',
  white: '#FFFFFF'
}

export function Whiteboard({ boardId, isMaster, onLogout }: WhiteboardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const tempCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [context, setContext] = useState<CanvasRenderingContext2D | null>(null)
  const [tempContext, setTempContext] = useState<CanvasRenderingContext2D | null>(null)
  const [channel, setChannel] = useState<any>(null)
  const [isWritingEnabled, setIsWritingEnabled] = useState(true)
  const [connectedUsers, setConnectedUsers] = useState(0)

  
  const [currentTool, setCurrentTool] = useState<'pen' | 'eraser' | 'text' | 'rectangle' | 'circle' | 'line' | 'select'>('pen')
  const [currentColor, setCurrentColor] = useState('#000000')
  const [lineWidth, setLineWidth] = useState(3)
  const [fontSize, setFontSize] = useState(20)
  
  const [lastX, setLastX] = useState(0)
  const [lastY, setLastY] = useState(0)
  const [startX, setStartX] = useState(0)
  const [startY, setStartY] = useState(0)
  
  const [history, setHistory] = useState<string[]>([])
  const [historyStep, setHistoryStep] = useState(0)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationText, setNotificationText] = useState('')
  
  // Selection tool state
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionRect, setSelectionRect] = useState<{x: number, y: number, width: number, height: number} | null>(null)
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({x: 0, y: 0})

  // Inline text input state
  const [textInput, setTextInput] = useState<{ x: number; y: number; value: string } | null>(null)
  const textInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const tempCanvas = tempCanvasRef.current
    if (!canvas || !tempCanvas) return

    const ctx = canvas.getContext('2d')
    const tempCtx = tempCanvas.getContext('2d')
    if (!ctx || !tempCtx) return

    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight
    tempCanvas.width = canvas.offsetWidth
    tempCanvas.height = canvas.offsetHeight

    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    tempCtx.lineCap = 'round'
    tempCtx.lineJoin = 'round'

    setContext(ctx)
    setTempContext(tempCtx)
    
    drawWatermark()
    saveToHistory(canvas)
  }, [])

 const drawWatermark = () => {
 // Watermark gestito in HTML
}

  const saveToHistory = (canvas: HTMLCanvasElement) => {
    const dataURL = canvas.toDataURL()
    setHistory(prev => {
      const newHistory = prev.slice(0, historyStep + 1)
      newHistory.push(dataURL)
      if (newHistory.length > 20) newHistory.shift()
      return newHistory
    })
    setHistoryStep(prev => Math.min(prev + 1, 19))
  }

  const showNotif = (text: string) => {
    setNotificationText(text)
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 2000)
  }

  useEffect(() => {
    const realtimeChannel = supabase.channel(`board:${boardId}`, {
      config: { broadcast: { self: false } }
    })

    realtimeChannel
      .on('broadcast', { event: 'draw' }, ({ payload }: { payload: DrawData }) => {
        if (!context) return
        
        if (payload.type === 'clear') {
          const canvas = canvasRef.current
          if (canvas) {
            context.clearRect(0, 0, canvas.width, canvas.height)
            drawWatermark()
            saveToHistory(canvas)
          }
        } else if (payload.type === 'restore' && payload.imageData) {
          const img = new Image()
          img.onload = () => {
            const canvas = canvasRef.current
            if (canvas && context) {
              context.clearRect(0, 0, canvas.width, canvas.height)
              context.drawImage(img, 0, 0)
            }
          }
          img.src = payload.imageData
        } else if (payload.type === 'paste' && payload.imageData && payload.x && payload.y) {
          const img = new Image()
          img.onload = () => {
            if (context) {
              context.drawImage(img, payload.x!, payload.y!)
            }
          }
          img.src = payload.imageData
        } else if (payload.type === 'draw' && payload.x && payload.y && payload.prevX && payload.prevY) {
          context.strokeStyle = payload.color || '#000000'
          context.lineWidth = payload.lineWidth || 3
          context.beginPath()
          context.moveTo(payload.prevX, payload.prevY)
          context.lineTo(payload.x, payload.y)
          context.stroke()
        } else if (payload.type === 'text' && payload.x && payload.y && payload.text) {
          context.fillStyle = payload.color || '#000000'
          context.font = `${payload.fontSize || 20}px Arial`
          context.fillText(payload.text, payload.x, payload.y)
        } else if (payload.type === 'shape' && payload.x && payload.y) {
          context.strokeStyle = payload.color || '#000000'
          context.lineWidth = payload.lineWidth || 3
          
          if (payload.shapeType === 'rectangle' && payload.width && payload.height) {
            context.strokeRect(payload.x, payload.y, payload.width, payload.height)
          } else if (payload.shapeType === 'circle' && payload.width) {
            context.beginPath()
            context.arc(payload.x, payload.y, payload.width, 0, Math.PI * 2)
            context.stroke()
          } else if (payload.shapeType === 'line' && payload.prevX && payload.prevY) {
            context.beginPath()
            context.moveTo(payload.prevX, payload.prevY)
            context.lineTo(payload.x, payload.y)
            context.stroke()
          }
        }
      })
      .on('broadcast', { event: 'writing-toggle' }, ({ payload }) => {
        setIsWritingEnabled(payload.enabled)
      })
      .on('presence', { event: 'sync' }, () => {
        const state = realtimeChannel.presenceState()
        setConnectedUsers(Object.keys(state).length)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await realtimeChannel.track({ online_at: new Date().toISOString() })
        }
      })

    setChannel(realtimeChannel)
    return () => { realtimeChannel.unsubscribe() }
  }, [boardId, context])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
        else if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
        else if (e.key === 'y') { e.preventDefault(); redo() }
        else if (e.key === 'c' && selectionRect && selectedImage) { 
          e.preventDefault()
          showNotif('Area copiata')
        }
        else if (e.key === 'x' && selectionRect && selectedImage && context && canvasRef.current) {
          e.preventDefault()
          // Cut: clear the selected area
          context.clearRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height)
          saveToHistory(canvasRef.current)
          showNotif('Area tagliata')
        }
      } else if (e.key === 'Delete' && selectionRect && context && canvasRef.current) {
        e.preventDefault()
        context.clearRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height)
        setSelectionRect(null)
        setSelectedImage(null)
        saveToHistory(canvasRef.current)
        showNotif('Area eliminata')
      } else if (e.key === 'Escape') {
        setSelectionRect(null)
        setSelectedImage(null)
        if (tempContext && tempCanvasRef.current) {
          tempContext.clearRect(0, 0, tempCanvasRef.current.width, tempCanvasRef.current.height)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [historyStep, history, selectionRect, selectedImage, context])

  // Listener postMessage dalla tastiera LaTeX in SessionRoom
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === 'latex-insert') {
        setTextInput(prev => {
          if (prev) return { ...prev, value: prev.value + e.data.val }
          return prev
        })
        if (textInputRef.current) {
          textInputRef.current.focus()
        }
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isWritingEnabled && !isMaster) return
    
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    
    // Check if clicking inside selection to drag
    if (currentTool === 'select' && selectionRect) {
      if (x >= selectionRect.x && x <= selectionRect.x + selectionRect.width &&
          y >= selectionRect.y && y <= selectionRect.y + selectionRect.height) {
        setIsDragging(true)
        setDragOffset({ x: x - selectionRect.x, y: y - selectionRect.y })
        return
      }
    }
    
    if (currentTool === 'text') {
      setTextInput({ x, y, value: '' })
      setTimeout(() => textInputRef.current?.focus(), 50)
      return
    }
    
    if (currentTool === 'select') {
      setIsSelecting(true)
      setSelectionRect(null)
      setSelectedImage(null)
    }
    
    setIsDrawing(true)
    setStartX(x)
    setStartY(y)
    setLastX(x)
    setLastY(y)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const tempCanvas = tempCanvasRef.current
    if (!rect || !tempCanvas || !tempContext) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Handle dragging selected area
    if (currentTool === 'select' && isDragging && selectionRect && selectedImage && context) {
      tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      
      const newX = x - dragOffset.x
      const newY = y - dragOffset.y
      
      // Draw on temp canvas
      tempContext.putImageData(selectedImage, newX, newY)
      
      // Draw selection rectangle
      tempContext.strokeStyle = BRAND.navy
      tempContext.lineWidth = 2
      tempContext.setLineDash([5, 5])
      tempContext.strokeRect(newX, newY, selectionRect.width, selectionRect.height)
      tempContext.setLineDash([])
      
      return
    }

    if (!isDrawing || !context || (!isWritingEnabled && !isMaster)) return

    if (currentTool === 'select' && isSelecting) {
      // Draw selection rectangle preview
      tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      tempContext.strokeStyle = BRAND.navy
      tempContext.lineWidth = 2
      tempContext.setLineDash([5, 5])
      tempContext.strokeRect(startX, startY, x - startX, y - startY)
      tempContext.setLineDash([])
      return
    }

    if (currentTool === 'pen' || currentTool === 'eraser') {
      const color = currentTool === 'eraser' ? '#ffffff' : currentColor
      const width = currentTool === 'eraser' ? 20 : lineWidth

      context.strokeStyle = color
      context.lineWidth = width
      context.beginPath()
      context.moveTo(lastX, lastY)
      context.lineTo(x, y)
      context.stroke()

      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'draw',
          payload: { type: 'draw', x, y, prevX: lastX, prevY: lastY, color, lineWidth: width }
        })
      }

      setLastX(x)
      setLastY(y)
    } else if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'line') {
      tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      tempContext.strokeStyle = currentColor
      tempContext.lineWidth = lineWidth
      
      if (currentTool === 'rectangle') {
        tempContext.strokeRect(startX, startY, x - startX, y - startY)
      } else if (currentTool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2))
        tempContext.beginPath()
        tempContext.arc(startX, startY, radius, 0, Math.PI * 2)
        tempContext.stroke()
      } else if (currentTool === 'line') {
        tempContext.beginPath()
        tempContext.moveTo(startX, startY)
        tempContext.lineTo(x, y)
        tempContext.stroke()
      }
    }
  }

  const stopDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing && !isDragging) return
    
    const canvas = canvasRef.current
    const tempCanvas = tempCanvasRef.current
    const rect = canvas?.getBoundingClientRect()
    if (!rect || !context || !canvas || !tempCanvas || !tempContext) return
    
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Handle end of drag
    if (currentTool === 'select' && isDragging && selectionRect && selectedImage) {
      const newX = x - dragOffset.x
      const newY = y - dragOffset.y
      
      // Clear the old position on main canvas
      context.clearRect(selectionRect.x, selectionRect.y, selectionRect.width, selectionRect.height)
      
      // Draw at new position
      context.putImageData(selectedImage, newX, newY)
      
      // Update selection rect
      setSelectionRect({ x: newX, y: newY, width: selectionRect.width, height: selectionRect.height })
      
      // Clear temp canvas
      tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      
      // Broadcast the paste
      const imageCanvas = document.createElement('canvas')
      imageCanvas.width = selectionRect.width
      imageCanvas.height = selectionRect.height
      const imageCtx = imageCanvas.getContext('2d')
      if (imageCtx) {
        imageCtx.putImageData(selectedImage, 0, 0)
        if (channel) {
          channel.send({
            type: 'broadcast',
            event: 'draw',
            payload: {
              type: 'paste',
              x: newX,
              y: newY,
              imageData: imageCanvas.toDataURL()
            }
          })
        }
      }
      
      saveToHistory(canvas)
      setIsDragging(false)
      return
    }
    
    // Handle selection tool
    if (currentTool === 'select' && isSelecting) {
      const selWidth = x - startX
      const selHeight = y - startY
      
      if (Math.abs(selWidth) > 5 && Math.abs(selHeight) > 5) {
        const normalizedX = Math.min(startX, x)
        const normalizedY = Math.min(startY, y)
        const normalizedWidth = Math.abs(selWidth)
        const normalizedHeight = Math.abs(selHeight)
        
        // Capture the selected area
        const imageData = context.getImageData(normalizedX, normalizedY, normalizedWidth, normalizedHeight)
        setSelectedImage(imageData)
        setSelectionRect({ x: normalizedX, y: normalizedY, width: normalizedWidth, height: normalizedHeight })
        
        // Draw selection border on temp canvas
        tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
        tempContext.strokeStyle = BRAND.navy
        tempContext.lineWidth = 2
        tempContext.setLineDash([5, 5])
        tempContext.strokeRect(normalizedX, normalizedY, normalizedWidth, normalizedHeight)
        tempContext.setLineDash([])
        
        showNotif('Area selezionata - Trascina per spostare')
      } else {
        tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      }
      
      setIsSelecting(false)
      setIsDrawing(false)
      return
    }
    
    if (currentTool === 'rectangle') {
      const width = x - startX
      const height = y - startY
      context.strokeStyle = currentColor
      context.lineWidth = lineWidth
      context.strokeRect(startX, startY, width, height)
      tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      saveToHistory(canvas)
      
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'draw',
          payload: { type: 'shape', shapeType: 'rectangle', x: startX, y: startY, width, height, color: currentColor, lineWidth }
        })
      }
    } else if (currentTool === 'circle') {
      const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2))
      context.strokeStyle = currentColor
      context.lineWidth = lineWidth
      context.beginPath()
      context.arc(startX, startY, radius, 0, Math.PI * 2)
      context.stroke()
      tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      saveToHistory(canvas)
      
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'draw',
          payload: { type: 'shape', shapeType: 'circle', x: startX, y: startY, width: radius, color: currentColor, lineWidth }
        })
      }
    } else if (currentTool === 'line') {
      context.strokeStyle = currentColor
      context.lineWidth = lineWidth
      context.beginPath()
      context.moveTo(startX, startY)
      context.lineTo(x, y)
      context.stroke()
      tempContext.clearRect(0, 0, tempCanvas.width, tempCanvas.height)
      saveToHistory(canvas)
      
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'draw',
          payload: { type: 'shape', shapeType: 'line', x, y, prevX: startX, prevY: startY, color: currentColor, lineWidth }
        })
      }
    } else if (currentTool === 'pen' || currentTool === 'eraser') {
      saveToHistory(canvas)
    }
    
    setIsDrawing(false)
  }

  const undo = () => {
    if (historyStep > 0) {
      const newStep = historyStep - 1
      setHistoryStep(newStep)
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        if (canvas && context) {
          context.clearRect(0, 0, canvas.width, canvas.height)
          context.drawImage(img, 0, 0)
          if (channel) {
            channel.send({ type: 'broadcast', event: 'draw', payload: { type: 'restore', imageData: history[newStep] } })
          }
        }
      }
      img.src = history[newStep]
    }
  }

  const redo = () => {
    if (historyStep < history.length - 1) {
      const newStep = historyStep + 1
      setHistoryStep(newStep)
      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        if (canvas && context) {
          context.clearRect(0, 0, canvas.width, canvas.height)
          context.drawImage(img, 0, 0)
          if (channel) {
            channel.send({ type: 'broadcast', event: 'draw', payload: { type: 'restore', imageData: history[newStep] } })
          }
        }
      }
      img.src = history[newStep]
    }
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas || !context) return
    if (!confirm('⚠️ Cancellare tutta la lavagna?')) return

    context.clearRect(0, 0, canvas.width, canvas.height)
    drawWatermark()
    saveToHistory(canvas)
    if (channel) {
      channel.send({ type: 'broadcast', event: 'draw', payload: { type: 'clear' } })
    }
    showNotif('Lavagna cancellata')
  }

  const exportWithWhiteBg = (defaultFilename: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const userInput = prompt('Nome del file:', defaultFilename.replace('.png', ''))
    if (userInput === null) return // annullato
    const filename = (userInput.trim() || defaultFilename.replace('.png', '')) + '.png'
    const exportCanvas = document.createElement('canvas')
    exportCanvas.width = canvas.width
    exportCanvas.height = canvas.height
    const ctx = exportCanvas.getContext('2d')
    if (!ctx) return
    // Sfondo bianco
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
    // Disegno lavagna
    ctx.drawImage(canvas, 0, 0)
    // Watermark in bordeaux come in UI
    const fontSize = Math.max(12, Math.round(exportCanvas.width * 0.013))
    ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`
    ctx.fillStyle = 'rgba(107, 15, 26, 0.6)'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText('https://youtube.com/@MatHeightProject', exportCanvas.width - 20, exportCanvas.height - 20)
    const link = document.createElement('a')
    link.download = filename
    link.href = exportCanvas.toDataURL('image/png')
    link.click()
  }

  const saveSnapshot = () => {
    exportWithWhiteBg(`MatHeight-${boardId}-${new Date().toISOString().slice(0,10)}.png`)
    showNotif('Snapshot salvato!')
  }

  const exportToPNG = () => {
    exportWithWhiteBg(`MatHeight-lavagna-${boardId}-${new Date().toISOString().slice(0,10)}.png`)
    showNotif('Lavagna esportata!')
  }

  const toggleWriting = () => {
    const newState = !isWritingEnabled
    setIsWritingEnabled(newState)
    if (channel) {
      channel.send({ type: 'broadcast', event: 'writing-toggle', payload: { enabled: newState } })
    }
    showNotif(newState ? 'Scrittura abilitata' : 'Scrittura disabilitata')
  }

  const copyBoardLink = () => {
    const link = `${window.location.origin}/board/${boardId}`
    navigator.clipboard.writeText(link)
    showNotif('Link copiato!')
  }

  const getCursor = () => {
    if (!isWritingEnabled && !isMaster) return 'not-allowed'
    if (currentTool === 'select') {
      if (isDragging) return 'grabbing'
      if (selectionRect) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          const mouseX = lastX
          const mouseY = lastY
          if (mouseX >= selectionRect.x && mouseX <= selectionRect.x + selectionRect.width &&
              mouseY >= selectionRect.y && mouseY <= selectionRect.y + selectionRect.height) {
            return 'grab'
          }
        }
      }
      return 'crosshair'
    }
    if (currentTool === 'text') return 'text'
    if (currentTool === 'eraser') return 'cell'
    return 'crosshair'
  }

  function commitText() {
    if (!textInput || !context || !canvasRef.current) { setTextInput(null); return }
    const { x, y, value } = textInput
    if (value.trim()) {
      context.fillStyle = currentColor
      context.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      context.fillText(value, x, y)
      saveToHistory(canvasRef.current)
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'draw',
          payload: { type: 'text', x, y, text: value, color: currentColor, fontSize }
        })
      }
    }
    setTextInput(null)
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: BRAND.lightGray }}>
      {/* Notification Toast */}
      {showNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: BRAND.navy,
          color: 'white',
          padding: '16px 24px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 10000,
          animation: 'slideIn 0.3s ease-out',
          fontWeight: '500',
          fontSize: '14px'
        }}>
          ✓ {notificationText}
        </div>
      )}

      {/* Header */}
      <div style={{ 
        background: BRAND.white,
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: `1px solid ${BRAND.mediumGray}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div>
            <div style={{ 
              fontSize: '22px', 
              fontWeight: '700',
              letterSpacing: '-0.5px',
              color: BRAND.navy
            }}>
              MatHeight
            </div>
            <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
              <div style={{ width: '30px', height: '3px', background: BRAND.navy, borderRadius: '2px' }} />
              <div style={{ width: '30px', height: '3px', background: BRAND.bordeaux, borderRadius: '2px' }} />
            </div>
          </div>
          
          <div style={{ height: '40px', width: '1px', background: BRAND.mediumGray }} />
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ fontSize: '13px', color: BRAND.darkGray, fontWeight: '500' }}>
              Lavagna {boardId}
            </span>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px',
              background: BRAND.lightGray,
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              color: BRAND.darkGray
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {connectedUsers}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {isMaster && (
            <>
              <IconButton onClick={copyBoardLink} color={BRAND.navy} tooltip="Copia link lavagna">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
              </IconButton>
              
              <IconButton 
                onClick={toggleWriting} 
                color={isWritingEnabled ? '#10b981' : BRAND.bordeaux}
                tooltip={isWritingEnabled ? 'Disabilita scrittura' : 'Abilita scrittura'}
              >
                {isWritingEnabled ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                )}
              </IconButton>
            </>
          )}
          
          <div style={{ width: '1px', height: '24px', background: BRAND.mediumGray, margin: '0 4px' }} />
          
          <IconButton onClick={onLogout} color={BRAND.darkGray} tooltip="Esci">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </IconButton>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ 
          width: '72px', 
          background: BRAND.white,
          borderRight: `1px solid ${BRAND.mediumGray}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '16px 0',
          gap: '8px'
        }}>
          <ToolBtn active={currentTool === 'select'} onClick={() => setCurrentTool('select')} tooltip="Seleziona Area (V)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 2v6l3-3 3 3V2"/>
              <rect x="4" y="8" width="16" height="12" rx="2"/>
            </svg>
          </ToolBtn>

          <div style={{ width: '40px', height: '1px', background: BRAND.mediumGray, margin: '4px 0' }} />

          <ToolBtn active={currentTool === 'pen'} onClick={() => setCurrentTool('pen')} tooltip="Penna (P)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/>
            </svg>
          </ToolBtn>

          <ToolBtn active={currentTool === 'eraser'} onClick={() => setCurrentTool('eraser')} tooltip="Gomma (E)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 20H7L3 16l10-10 7 7-4 4"/>
              <path d="M7 20v-4"/>
            </svg>
          </ToolBtn>

          <ToolBtn active={currentTool === 'text'} onClick={() => setCurrentTool('text')} tooltip="Testo (T)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 7 4 4 20 4 20 7"/>
              <line x1="9" y1="20" x2="15" y2="20"/>
              <line x1="12" y1="4" x2="12" y2="20"/>
            </svg>
          </ToolBtn>

          <div style={{ width: '40px', height: '1px', background: BRAND.mediumGray, margin: '4px 0' }} />

          <ToolBtn active={currentTool === 'line'} onClick={() => setCurrentTool('line')} tooltip="Linea (L)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="19" x2="19" y2="5"/>
            </svg>
          </ToolBtn>

          <ToolBtn active={currentTool === 'rectangle'} onClick={() => setCurrentTool('rectangle')} tooltip="Rettangolo (R)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            </svg>
          </ToolBtn>

          <ToolBtn active={currentTool === 'circle'} onClick={() => setCurrentTool('circle')} tooltip="Cerchio (C)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
            </svg>
          </ToolBtn>

          <div style={{ width: '40px', height: '1px', background: BRAND.mediumGray, margin: '4px 0' }} />

          <div style={{ padding: '8px' }}>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => setCurrentColor(e.target.value)}
              style={{ 
                width: '40px', 
                height: '40px', 
                border: `2px solid ${BRAND.mediumGray}`,
                borderRadius: '8px',
                cursor: 'pointer'
              }}
              title="Colore"
            />
          </div>

          <div style={{ fontSize: '10px', color: BRAND.darkGray, fontWeight: '500' }}>
            {lineWidth}px
          </div>
          <input
            type="range"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            style={{ width: '40px', cursor: 'pointer' }}
          />

          {currentTool === 'text' && (
            <>
              <div style={{ fontSize: '10px', color: BRAND.darkGray, fontWeight: '500', marginTop: '8px' }}>
                {fontSize}pt
              </div>
              <input
                type="range"
                min="10"
                max="72"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                style={{ width: '40px', cursor: 'pointer' }}
              />
            </>
          )}

          <div style={{ flex: 1 }} />

          <ActionBtn onClick={undo} disabled={historyStep <= 0} tooltip="Annulla (Ctrl+Z)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7v6h6"/>
              <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"/>
            </svg>
          </ActionBtn>

          <ActionBtn onClick={redo} disabled={historyStep >= history.length - 1} tooltip="Ripeti (Ctrl+Y)">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 7v6h-6"/>
              <path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"/>
            </svg>
          </ActionBtn>

          <ActionBtn onClick={saveSnapshot} tooltip="Snapshot">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </ActionBtn>

          <ActionBtn onClick={clearCanvas} tooltip="Cancella tutto">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </ActionBtn>

          <ActionBtn onClick={exportToPNG} tooltip="Esporta PNG">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </ActionBtn>
        </div>

        {/* Canvas */}
        <div style={{ flex: 2, position: 'relative', background: BRAND.white }}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} />
            <canvas
              ref={tempCanvasRef}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={() => {
                setIsDrawing(false)
                setIsDragging(false)
                if (tempContext && tempCanvasRef.current && !selectionRect) {
                  tempContext.clearRect(0, 0, tempCanvasRef.current.width, tempCanvasRef.current.height)
                }
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                cursor: getCursor()
              }}
            />
          </div>

          {/* Inline text input */}
          {textInput && (
            <div style={{
              position: 'absolute',
              left: textInput.x,
              top: textInput.y - fontSize,
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <input
                ref={textInputRef}
                value={textInput.value}
                onChange={e => setTextInput(prev => prev ? { ...prev, value: e.target.value } : null)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitText() }
                  if (e.key === 'Escape') { setTextInput(null) }
                }}
                onBlur={() => commitText()}
                style={{
                  minWidth: 120,
                  padding: '4px 8px',
                  fontSize: fontSize,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  color: currentColor,
                  background: 'rgba(255,255,255,0.95)',
                  border: `2px solid ${currentColor}`,
                  borderRadius: 6,
                  outline: 'none',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                }}
                placeholder="Scrivi... (Invio per confermare)"
              />
              <button
                onMouseDown={e => { e.preventDefault(); commitText() }}
                style={{ padding: '4px 8px', background: BRAND.navy, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >✓</button>
              <button
                onMouseDown={e => { e.preventDefault(); setTextInput(null) }}
                style={{ padding: '4px 8px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}
              >✕</button>
            </div>
          )}

          {!isWritingEnabled && !isMaster && (
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: BRAND.bordeaux,
              color: 'white',
              padding: '24px 40px',
              borderRadius: '16px',
              fontSize: '18px',
              fontWeight: '600',
              pointerEvents: 'none',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Scrittura disabilitata
            </div>
          )}

          {selectionRect && (
            <div style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: BRAND.navy,
              color: 'white',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '500',
              pointerEvents: 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
              zIndex: 999
            }}>
              Trascina per spostare • Canc per eliminare • Esc per deselezionare
            </div>
          )}

{/* Watermark visibile fisso - UNICO */}
<div style={{
  position: 'absolute',
  bottom: '20px',
  right: '20px',
  color: BRAND.bordeaux,
  fontSize: '14px',
  opacity: 0.6,
  fontWeight: '600',
  pointerEvents: 'none',
  letterSpacing: '0.3px',
  textShadow: 'none'  // NO OMBRE
}}>
  https://youtube.com/@MatHeightProject
</div>
        </div>


      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}

function IconButton({ onClick, color, children, tooltip }: any) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        width: '40px',
        height: '40px',
        border: 'none',
        borderRadius: '10px',
        background: 'transparent',
        color: color,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = BRAND.lightGray}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      {children}
    </button>
  )
}

function ToolBtn({ active, onClick, children, tooltip }: any) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        width: '48px',
        height: '48px',
        border: 'none',
        borderRadius: '10px',
        background: active ? BRAND.navy : 'transparent',
        color: active ? BRAND.white : BRAND.darkGray,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = BRAND.lightGray
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function ActionBtn({ onClick, disabled, children, tooltip, id }: any) {
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      style={{
        width: '48px',
        height: '48px',
        border: 'none',
        borderRadius: '10px',
        background: 'transparent',
        color: disabled ? BRAND.mediumGray : BRAND.darkGray,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        opacity: disabled ? 0.4 : 1
      }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = BRAND.lightGray
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}