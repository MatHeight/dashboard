import React, { useState, useRef, useEffect } from 'react';
import { Trash2, Link, Unlink, Palette, Tag, Printer, Square, Diamond, Circle, Plus } from 'lucide-react';

const COLORS = ['#1a2847', '#800020', '#2c5282', '#5a67d8', '#48bb78', '#ed8936', '#9f7aea', '#e53e3e', '#38b2ac', '#d69e2e', '#ec4899', '#10b981', '#6366f1', '#f59e0b', '#8b5cf6'];
const BG = '#fdf8f0';

const getDynamicFontSize = (width, height) => {
  const area = width * height;
  if (area < 5000) return 10;
  if (area < 10000) return 12;
  if (area < 20000) return 14;
  if (area < 40000) return 16;
  if (area < 80000) return 20;
  return 24;
};

const getEdgePoint = (from, to) => {
  const fw = (from.width || 150) / 2;
  const fh = (from.height || 50) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return { x: from.x, y: from.y };
  const angle = Math.atan2(dy, dx);
  const tx = Math.abs(Math.cos(angle)) > 0 ? fw / Math.abs(Math.cos(angle)) : Infinity;
  const ty = Math.abs(Math.sin(angle)) > 0 ? fh / Math.abs(Math.sin(angle)) : Infinity;
  const t = Math.min(tx, ty);
  return { x: from.x + Math.cos(angle) * t, y: from.y + Math.sin(angle) * t };
};

export default function ConceptMapApp() {
  const [nodes, setNodes] = useState([]);
  const [labels, setLabels] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedNodes, setSelectedNodes] = useState([]);
  const [selectedLabels, setSelectedLabels] = useState([]);
  const [selectedConnections, setSelectedConnections] = useState([]);
  const [dragging, setDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizingNode, setResizingNode] = useState(null);
  const [editingNode, setEditingNode] = useState(null);
  const [editingLabel, setEditingLabel] = useState(null);
  const [studentName, setStudentName] = useState('');
  const [teacherSignature, setTeacherSignature] = useState('');
  const [colorPickerNode, setColorPickerNode] = useState(null);
  const [shapeMenu, setShapeMenu] = useState(false);
  const [katexLoaded, setKatexLoaded] = useState(false);
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const nodeCountRef = useRef(0);

  useEffect(() => {
    if (!document.getElementById('katex-css')) {
      const l = document.createElement('link');
      l.id = 'katex-css'; l.rel = 'stylesheet';
      l.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
      document.head.appendChild(l);
    }
    if (!window.katex) {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
      s.onload = () => setKatexLoaded(true);
      document.head.appendChild(s);
    } else setKatexLoaded(true);
  }, []);

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'concept-print-styles';
    style.innerHTML = `
      @media print {
        body * { visibility: hidden !important; }
        #app-print-area, #app-print-area * { visibility: visible !important; }
        #app-print-area {
          position: fixed !important;
          top: 0 !important; left: 0 !important;
          width: 100% !important;
          background: white !important;
        }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('concept-print-styles');
      if (el) document.head.removeChild(el);
    };
  }, []);

  const renderLatex = (text) => {
    if (!katexLoaded || !window.katex) return text;
    try {
      let r = text.replace(/\$\$([^\$]+)\$\$/g, (_, f) => {
        try { return window.katex.renderToString(f, { throwOnError: false, displayMode: true }); } catch { return _; }
      });
      r = r.replace(/\$([^\$]+)\$/g, (_, f) => {
        try { return window.katex.renderToString(f, { throwOnError: false, displayMode: false }); } catch { return _; }
      });
      return r;
    } catch { return text; }
  };

  const getNextPosition = () => {
    const canvas = canvasRef.current;
    const baseX = canvas ? canvas.clientWidth / 2 : 400;
    const baseY = canvas ? canvas.clientHeight / 2 : 250;
    const slot = nodeCountRef.current % 8;
    const row = Math.floor(nodeCountRef.current / 8);
    nodeCountRef.current += 1;
    return { x: baseX - 160 + slot * 50, y: baseY - 80 + row * 70 };
  };

  const createNode = (shape) => {
    const pos = getNextPosition();
    setNodes(prev => [...prev, {
      id: Date.now(), x: pos.x, y: pos.y,
      text: shape === 'diamond' ? 'Decisione' : shape === 'circle' ? 'Concetto' : 'Nuovo concetto',
      color: '#1a2847', shape,
      width: shape === 'rect' ? 150 : 130,
      height: shape === 'rect' ? 50 : 130,
    }]);
    setShapeMenu(false);
    setSelectedNodes([]); setSelectedLabels([]); setSelectedConnections([]);
  };

  const createLabel = () => {
    const pos = getNextPosition();
    setLabels(prev => [...prev, { id: Date.now(), x: pos.x, y: pos.y + 30, text: 'Etichetta' }]);
    setSelectedNodes([]); setSelectedLabels([]); setSelectedConnections([]);
  };

  const startDrag = (e, type, item) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setDragging({ type, id: item.id });
    setDragOffset({ x: e.clientX - rect.left - item.x, y: e.clientY - rect.top - item.y });
  };

  const startResize = (e, nodeId, corner) => {
    e.stopPropagation();
    setResizingNode({ id: nodeId, corner });
  };

  const handleMouseMove = (e) => {
    if (resizingNode) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setNodes(prev => prev.map(n => {
        if (n.id !== resizingNode.id) return n;
        const nn = { ...n };
        const halfW = n.width / 2, halfH = n.height / 2;
        if (resizingNode.corner === 'se') {
          nn.width = Math.max(80, mouseX - (n.x - halfW));
          nn.height = Math.max(40, mouseY - (n.y - halfH));
        } else if (resizingNode.corner === 'sw') {
          const right = n.x + halfW;
          nn.width = Math.max(80, right - mouseX);
          nn.x = right - nn.width / 2;
          nn.height = Math.max(40, mouseY - (n.y - halfH));
        } else if (resizingNode.corner === 'ne') {
          nn.width = Math.max(80, mouseX - (n.x - halfW));
          const bottom = n.y + halfH;
          nn.height = Math.max(40, bottom - mouseY);
          nn.y = bottom - nn.height / 2;
        } else if (resizingNode.corner === 'nw') {
          const right = n.x + halfW;
          const bottom = n.y + halfH;
          nn.width = Math.max(80, right - mouseX);
          nn.height = Math.max(40, bottom - mouseY);
          nn.x = right - nn.width / 2;
          nn.y = bottom - nn.height / 2;
        }
        return nn;
      }));
      return;
    }
    if (!dragging) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    if (dragging.type === 'node')
      setNodes(prev => prev.map(n => n.id === dragging.id ? { ...n, x, y } : n));
    else
      setLabels(prev => prev.map(l => l.id === dragging.id ? { ...l, x, y } : l));
  };

  const handleMouseUp = () => { setDragging(null); setResizingNode(null); };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, dragOffset, nodes, labels, resizingNode]);

  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current || e.target === svgRef.current) {
      setSelectedNodes([]); setSelectedLabels([]); setSelectedConnections([]);
      setColorPickerNode(null); setShapeMenu(false);
    }
  };

  const toggleNode = (id) => {
    setSelectedConnections([]); setSelectedLabels([]);
    setSelectedNodes(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const toggleLabel = (id) => {
    setSelectedConnections([]); setSelectedNodes([]);
    setSelectedLabels(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const toggleConnection = (id, e) => {
    e.stopPropagation();
    setSelectedNodes([]); setSelectedLabels([]);
    setSelectedConnections(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  };

  const createConnection = () => {
    if (selectedNodes.length === 2) {
      const [a, b] = selectedNodes;
      const exists = connections.some(c => (c.from === a && c.to === b) || (c.from === b && c.to === a));
      if (!exists) setConnections(prev => [...prev, { id: Date.now(), from: a, to: b }]);
      setSelectedNodes([]);
    }
  };

  const disconnectSelected = () => {
    if (selectedConnections.length > 0) {
      setConnections(prev => prev.filter(c => !selectedConnections.includes(c.id)));
      setSelectedConnections([]);
    }
  };

  const deleteSelected = () => {
    setNodes(prev => prev.filter(n => !selectedNodes.includes(n.id)));
    setLabels(prev => prev.filter(l => !selectedLabels.includes(l.id)));
    setConnections(prev => prev.filter(c =>
      !selectedNodes.includes(c.from) && !selectedNodes.includes(c.to) && !selectedConnections.includes(c.id)
    ));
    setSelectedNodes([]); setSelectedLabels([]); setSelectedConnections([]);
  };

  const getNode = (id) => nodes.find(n => n.id === id);
  const hasSelection = selectedNodes.length > 0 || selectedLabels.length > 0 || selectedConnections.length > 0;

  const handlePrint = () => {
    setSelectedNodes([]); setSelectedLabels([]); setSelectedConnections([]);
    setColorPickerNode(null); setShapeMenu(false);
    setTimeout(() => window.print(), 100);
  };

  // ---- NODE RENDERER ----
  const renderResizeHandles = (nodeId) => (
    ['se', 'sw', 'ne', 'nw'].map(corner => (
      <div key={corner}
        onMouseDown={(e) => startResize(e, nodeId, corner)}
        style={{
          position: 'absolute', width: 14, height: 14, background: '#3b82f6',
          borderRadius: '50%', zIndex: 10, cursor: `${corner}-resize`,
          ...(corner.includes('s') ? { bottom: 0 } : { top: 0 }),
          ...(corner.includes('e') ? { right: 0 } : { left: 0 }),
          transform: `translate(${corner.includes('e') ? '50%' : '-50%'}, ${corner.includes('s') ? '50%' : '-50%'})`
        }}
      />
    ))
  );

  const renderNode = (node) => {
    const isSelected = selectedNodes.includes(node.id);
    const editing = editingNode === node.id;
    const nw = node.width || 150;
    const nh = node.height || (node.shape === 'rect' ? 50 : 130);
    const fontSize = getDynamicFontSize(nw, nh);
    const shadow = isSelected ? '0 0 0 4px rgba(96,165,250,0.6)' : '0 2px 8px rgba(0,0,0,.15)';

    const sharedHandlers = {
      onMouseDown: (e) => startDrag(e, 'node', node),
      onDoubleClick: (e) => { e.stopPropagation(); setEditingNode(node.id); },
      onClick: (e) => { e.stopPropagation(); toggleNode(node.id); setColorPickerNode(null); },
    };

    const editInput = () => (
      <input type="text" value={node.text}
        onChange={(e) => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, text: e.target.value } : n))}
        onBlur={() => setEditingNode(null)}
        onKeyDown={(e) => e.key === 'Enter' && setEditingNode(null)}
        autoFocus
        style={{ background: 'transparent', border: 'none', borderBottom: '1px solid white', outline: 'none', color: 'white', textAlign: 'center', width: '80%', fontSize }}
      />
    );

    if (node.shape === 'diamond') {
      const hw = nw / 2, hh = nh / 2;
      return (
        <div key={node.id} {...sharedHandlers}
          style={{ position: 'absolute', left: node.x - hw, top: node.y - hh, width: nw, height: nh, backgroundColor: node.color, transform: 'rotate(45deg)', cursor: 'move', boxShadow: shadow, borderRadius: 4 }}>
          <div style={{ transform: 'rotate(-45deg)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', textAlign: 'center', padding: 4 }}>
            {editing ? editInput() : <div style={{ fontSize, fontWeight: 500, textAlign: 'center', width: '100%' }} dangerouslySetInnerHTML={{ __html: renderLatex(node.text) }} />}
          </div>
          {colorPickerNode === node.id && (
            <div style={{ position: 'absolute', top: hh + 10, left: -20, background: 'white', borderRadius: 8, padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 200, boxShadow: '0 4px 12px rgba(0,0,0,.15)', transform: 'rotate(-45deg)', zIndex: 50 }}>
              {COLORS.map(c => <button key={c} onClick={(e) => { e.stopPropagation(); setNodes(prev => prev.map(n => n.id === node.id ? { ...n, color: c } : n)); setColorPickerNode(null); }} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: '2px solid #e5e7eb', cursor: 'pointer' }} />)}
            </div>
          )}
          {isSelected && !editing && renderResizeHandles(node.id)}
        </div>
      );
    }

    if (node.shape === 'circle') {
      return (
        <div key={node.id} {...sharedHandlers}
          style={{ position: 'absolute', left: node.x - nw / 2, top: node.y - nh / 2, width: nw, height: nh, backgroundColor: node.color, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'move', userSelect: 'none', textAlign: 'center', boxShadow: shadow }}>
          {editing ? editInput() : <div style={{ color: 'white', fontSize, fontWeight: 500, padding: 8, textAlign: 'center', width: '100%' }} dangerouslySetInnerHTML={{ __html: renderLatex(node.text) }} />}
          {isSelected && !editing && renderResizeHandles(node.id)}
        </div>
      );
    }

    // rect
    return (
      <div key={node.id} {...sharedHandlers}
        style={{ position: 'absolute', left: node.x - nw / 2, top: node.y - nh / 2, width: nw, height: nh, backgroundColor: node.color, color: 'white', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'move', userSelect: 'none', padding: 8, boxSizing: 'border-box', boxShadow: shadow }}>
        {editing ? (
          <input type="text" value={node.text}
            onChange={(e) => setNodes(prev => prev.map(n => n.id === node.id ? { ...n, text: e.target.value } : n))}
            onBlur={() => setEditingNode(null)}
            onKeyDown={(e) => e.key === 'Enter' && setEditingNode(null)}
            autoFocus
            style={{ background: 'transparent', border: 'none', borderBottom: '1px solid white', outline: 'none', color: 'white', textAlign: 'center', width: '100%', fontSize }}
          />
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize, fontWeight: 500, textAlign: 'center', flex: 1 }} dangerouslySetInnerHTML={{ __html: renderLatex(node.text) }} />
            <button onClick={(e) => { e.stopPropagation(); setColorPickerNode(colorPickerNode === node.id ? null : node.id); }}
              style={{ position: 'absolute', bottom: 2, right: 2, opacity: 0.6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'white', padding: 2, display: 'flex', alignItems: 'center' }}>
              <Palette size={12} />
            </button>
          </div>
        )}
        {colorPickerNode === node.id && (
          <div style={{ position: 'absolute', top: '100%', marginTop: 4, left: 0, background: 'white', borderRadius: 8, padding: 8, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 200, boxShadow: '0 4px 12px rgba(0,0,0,.15)', zIndex: 50 }}>
            {COLORS.map(c => <button key={c} onClick={(e) => { e.stopPropagation(); setNodes(prev => prev.map(n => n.id === node.id ? { ...n, color: c } : n)); setColorPickerNode(null); }} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: '2px solid #e5e7eb', cursor: 'pointer' }} />)}
          </div>
        )}
        {isSelected && !editing && renderResizeHandles(node.id)}
      </div>
    );
  };

  // ---- MAIN RENDER ----
  return (
    <div id="app-print-area" style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', background: BG }}>

      {/* Header — nascosto in stampa */}
      <div className="no-print" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,.08)' }}>
        <div style={{ height: 4, background: '#1a2847' }} />
        <div style={{ padding: '12px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ height: 1, background: '#1a2847', width: 192, marginBottom: 4 }} />
            <h1 style={{ fontSize: 22, fontWeight: 300, letterSpacing: '.05em', color: '#1f2937', margin: 0 }}>MatHeight</h1>
            <div style={{ height: 1, background: '#800020', width: 192, marginTop: 4 }} />
          </div>
          <span style={{ fontSize: 13, color: '#6b7280', letterSpacing: '.04em' }}>Concept Map Creator</span>
          <button onClick={handlePrint}
            style={{ padding: '8px 16px', background: '#800020', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <Printer size={14} /> Stampa / PDF
          </button>
        </div>
      </div>

      {/* Toolbar — nascosta in stampa */}
      <div className="no-print" style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '10px 32px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setShapeMenu(!shapeMenu)}
            style={{ padding: '8px 14px', background: '#1a2847', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
            <Plus size={14} /> Aggiungi nodo ▾
          </button>
          {shapeMenu && (
            <div style={{ position: 'absolute', top: '100%', marginTop: 4, left: 0, background: 'white', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.12)', border: '1px solid #e5e7eb', zIndex: 200, overflow: 'hidden', minWidth: 160 }}>
              {[
                { shape: 'rect', icon: <Square size={15} />, label: 'Rettangolo' },
                { shape: 'circle', icon: <Circle size={15} />, label: 'Cerchio' },
                { shape: 'diamond', icon: <Diamond size={15} />, label: 'Rombo' },
              ].map(({ shape, icon, label }) => (
                <button key={shape} onClick={() => createNode(shape)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f3f4f6'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <span style={{ color: '#1a2847' }}>{icon}</span> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button onClick={createLabel}
          style={{ padding: '8px 14px', background: '#5a67d8', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
          <Tag size={14} /> Aggiungi etichetta
        </button>

        <div style={{ width: 1, height: 28, background: '#e5e7eb', margin: '0 4px' }} />

        <button onClick={createConnection} disabled={selectedNodes.length !== 2}
          title={selectedNodes.length < 2 ? 'Seleziona 2 nodi per collegare' : 'Collega i nodi selezionati'}
          style={{ padding: '8px 14px', background: selectedNodes.length === 2 ? '#2c5282' : '#e5e7eb', color: selectedNodes.length === 2 ? 'white' : '#9ca3af', border: 'none', borderRadius: 6, cursor: selectedNodes.length === 2 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
          <Link size={14} /> Collega
          {selectedNodes.length > 0 && <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '0 6px', fontSize: 11 }}>{selectedNodes.length}/2</span>}
        </button>

        <button onClick={disconnectSelected} disabled={selectedConnections.length === 0}
          title="Clicca su una linea di connessione per selezionarla, poi usa questo bottone"
          style={{ padding: '8px 14px', background: selectedConnections.length > 0 ? '#d97706' : '#e5e7eb', color: selectedConnections.length > 0 ? 'white' : '#9ca3af', border: 'none', borderRadius: 6, cursor: selectedConnections.length > 0 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
          <Unlink size={14} /> Scollega
        </button>

        <div style={{ width: 1, height: 28, background: '#e5e7eb', margin: '0 4px' }} />

        <button onClick={deleteSelected} disabled={!hasSelection}
          style={{ padding: '8px 14px', background: hasSelection ? '#dc2626' : '#e5e7eb', color: hasSelection ? 'white' : '#9ca3af', border: 'none', borderRadius: 6, cursor: hasSelection ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
          <Trash2 size={14} /> Elimina
        </button>

        <div style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
          Doppio clic per modificare • Clic su una linea per selezionarla • <code style={{ background: '#f3f4f6', padding: '1px 4px', borderRadius: 3 }}>$formula$</code> LaTeX
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <svg ref={svgRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 5 }}
          onClick={handleCanvasClick}>
          {connections.map(conn => {
            const f = getNode(conn.from), t = getNode(conn.to);
            if (!f || !t) return null;
            const ep1 = getEdgePoint(f, t), ep2 = getEdgePoint(t, f);
            const isSel = selectedConnections.includes(conn.id);
            const mx = (ep1.x + ep2.x) / 2, my = (ep1.y + ep2.y) / 2;
            return (
              <g key={conn.id}>
                <line x1={ep1.x} y1={ep1.y} x2={ep2.x} y2={ep2.y}
                  stroke="transparent" strokeWidth={18} style={{ cursor: 'pointer' }}
                  onClick={(e) => toggleConnection(conn.id, e)} />
                <line x1={ep1.x} y1={ep1.y} x2={ep2.x} y2={ep2.y}
                  stroke={isSel ? '#f59e0b' : '#1a2847'}
                  strokeWidth={isSel ? 3 : 2}
                  strokeDasharray={isSel ? '7 3' : undefined}
                  style={{ pointerEvents: 'none' }} />
                {isSel && <circle cx={mx} cy={my} r={7} fill="#f59e0b" style={{ pointerEvents: 'none' }} />}
              </g>
            );
          })}
        </svg>

        <div ref={canvasRef} onClick={handleCanvasClick}
          style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 10 }}>
          {nodes.map(node => renderNode(node))}
          {labels.map(label => (
            <div key={label.id}
              onMouseDown={(e) => startDrag(e, 'label', label)}
              onDoubleClick={(e) => { e.stopPropagation(); setEditingLabel(label.id); }}
              onClick={(e) => { e.stopPropagation(); toggleLabel(label.id); }}
              style={{ position: 'absolute', left: label.x - 50, top: label.y - 15, minWidth: 100, textAlign: 'center', padding: '6px 12px', background: 'white', border: selectedLabels.includes(label.id) ? '2px solid #60a5fa' : '1px solid #d1d5db', borderRadius: 6, cursor: 'move', userSelect: 'none', boxShadow: '0 1px 4px rgba(0,0,0,.08)', zIndex: 15 }}>
              {editingLabel === label.id ? (
                <input type="text" value={label.text}
                  onChange={(e) => setLabels(prev => prev.map(l => l.id === label.id ? { ...l, text: e.target.value } : l))}
                  onBlur={() => setEditingLabel(null)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingLabel(null)}
                  autoFocus
                  style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #9ca3af', outline: 'none', textAlign: 'center', width: '100%', fontSize: 12 }}
                />
              ) : (
                <span style={{ fontSize: 12, color: '#1f2937' }}>{label.text}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer — senza bordo superiore, visibile in stampa */}
      <div style={{ background: 'white', padding: '16px 32px' }}>
        <div style={{ maxWidth: 768, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Nome e Cognome</label>
            <input type="text" value={studentName} onChange={(e) => setStudentName(e.target.value)}
              style={{ width: '100%', border: 'none', borderBottom: '2px solid #d1d5db', outline: 'none', padding: '4px 8px', fontSize: 13, background: 'transparent' }}
              placeholder="" />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 }}>Firma del docente/Commissione</label>
            <input type="text" value={teacherSignature} onChange={(e) => setTeacherSignature(e.target.value)}
              style={{ width: '100%', border: 'none', borderBottom: '2px solid #d1d5db', outline: 'none', padding: '4px 8px', fontSize: 13, background: 'transparent' }}
              placeholder="" />
          </div>
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 500, color: '#800020', margin: 0 }}>
          https://www.youtube.com/@MatHeightProject
        </p>
      </div>

    </div>
  );
}