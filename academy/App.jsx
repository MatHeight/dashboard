import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

const CATEGORIES = [
  { id: 'teoria', label: 'TEORIA', color: '#0B3C5D' },
  { id: 'video', label: 'VIDEO', color: '#800020' },
  { id: 'flashcard', label: 'FLASHCARD', color: '#d97706' },
  { id: 'esercizi', label: 'ESERCIZI', color: '#059669' }
];

const ANTICLOCKWISE_ORDER = ['teoria', 'flashcard', 'esercizi', 'video'];

const SB_URL = import.meta.env.VITE_SUPABASE_URL || 'https://vwpigreayunxjusxpmjx.supabase.co';
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ3cGlncmVheXVueGp1c3hwbWp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NTM5MjEsImV4cCI6MjA4NTMyOTkyMX0.ad33Ubut-_qLAuM-aKSOzhlF5VbfghXbw2RxE0LxGTk';
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL || 'https://dashboard-co6.pages.dev';

const supabase = createClient(SB_URL, SB_KEY);

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// Funzione per renderizzare testo con LaTeX
function renderLatex(text) {
  if (!text) return null;
  
  const parts = [];
  let lastIndex = 0;
  
  const allParts = [];
  
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  let match;
  
  while ((match = blockRegex.exec(text)) !== null) {
    allParts.push({
      type: 'block',
      content: match[1],
      start: match.index,
      end: match.index + match[0].length
    });
  }
  
  const inlineRegex = /\$([^\$]+?)\$/g;
  while ((match = inlineRegex.exec(text)) !== null) {
    const isInsideBlock = allParts.some(
      part => part.type === 'block' && match.index >= part.start && match.index < part.end
    );
    
    if (!isInsideBlock) {
      allParts.push({
        type: 'inline',
        content: match[1],
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }
  
  allParts.sort((a, b) => a.start - b.start);
  
  lastIndex = 0;
  allParts.forEach((part, idx) => {
    if (part.start > lastIndex) {
      const normalText = text.substring(lastIndex, part.start);
      parts.push(<span key={`text-${idx}`}>{normalText}</span>);
    }
    
    try {
      if (part.type === 'block') {
        parts.push(
          <div key={`block-${idx}`} style={{ margin: '12px 0' }}>
            <BlockMath math={part.content} />
          </div>
        );
      } else {
        parts.push(
          <span key={`inline-${idx}`}>
            <InlineMath math={part.content} />
          </span>
        );
      }
    } catch (err) {
      parts.push(
        <span key={`error-${idx}`} style={{ color: '#dc2626', fontFamily: 'monospace', fontSize: '0.9em' }}>
          {part.type === 'block' ? `$$${part.content}$$` : `$${part.content}$`}
        </span>
      );
    }
    
    lastIndex = part.end;
  });
  
  if (lastIndex < text.length) {
    parts.push(<span key="text-final">{text.substring(lastIndex)}</span>);
  }
  
  return <>{parts}</>;
}

// --- ONDA ECG ---
const WaveSystem = () => {
  const [waveColorIndex, setWaveColorIndex] = useState(0);
  const [waveKey, setWaveKey] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWaveColorIndex((prev) => (prev + 1) % CATEGORIES.length);
      setWaveKey(prev => prev + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const path = "M 0 300 C 100 -150 200 750 300 300 C 400 -150 500 750 600 300 C 700 -150 800 750 900 300 C 1000 -150 1100 750 1200 300 C 1300 -150 1400 750 1500 300 C 1600 -150 1700 750 1800 300 C 1900 -150 2000 750 2200 300";

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden flex items-center">
      <svg width="100%" height="100%" viewBox="0 0 2000 600" preserveAspectRatio="none" className="opacity-20">
        <motion.path
          key={waveKey}
          d={path}
          fill="none"
          stroke={CATEGORIES[waveColorIndex].color}
          strokeWidth="3"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 9.5, ease: "linear" }}
        />
      </svg>
    </div>
  );
};

// --- FLASHCARD PLAYER ---
const FlashcardPlayer = ({ flashcardSet }) => {
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(() => [...flashcardSet.flashcards].sort(() => Math.random() - 0.5));

  useEffect(() => {
    setShuffled([...flashcardSet.flashcards].sort(() => Math.random() - 0.5));
    setCurrent(0);
    setFlipped(false);
  }, [flashcardSet]);

  const card = shuffled[current];
  if (!card) return null;

  const goNext = () => {
    setFlipped(false);
    setTimeout(() => setCurrent((prev) => (prev + 1) % shuffled.length), 200);
  };

  const goPrev = () => {
    setFlipped(false);
    setTimeout(() => setCurrent((prev) => (prev - 1 + shuffled.length) % shuffled.length), 200);
  };

  const reshuffle = () => {
    setFlipped(false);
    setTimeout(() => {
      setShuffled([...flashcardSet.flashcards].sort(() => Math.random() - 0.5));
      setCurrent(0);
    }, 200);
  };

  const progress = ((current + 1) / shuffled.length) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full h-full flex flex-col items-center justify-center gap-6 px-4 py-6"
    >
      <div className="w-full max-w-xl">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            {flashcardSet.argomento}
          </span>
          <span className="text-xs font-bold text-slate-400">
            {current + 1} / {shuffled.length}
          </span>
        </div>
        <div className="h-0.5 w-full bg-slate-100 rounded-full">
          <motion.div
            className="h-0.5 rounded-full"
            style={{ backgroundColor: '#d97706' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <div
        className="w-full max-w-xl cursor-pointer"
        style={{ perspective: '1200px' }}
        onClick={() => setFlipped(f => !f)}
      >
        <motion.div
          style={{ transformStyle: 'preserve-3d', position: 'relative', minHeight: '220px' }}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        >
          <div
            style={{ 
              backfaceVisibility: 'hidden', 
              WebkitBackfaceVisibility: 'hidden',
              borderColor: '#800020',
              borderWidth: '2px'
            }}
            className="absolute inset-0 rounded-2xl bg-white shadow-sm flex flex-col items-center justify-center p-8 text-center"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300 mb-4">domanda</p>
            <div className="text-lg font-semibold text-slate-800 leading-relaxed">
              {renderLatex(card.fronte)}
            </div>
            <p className="text-[10px] text-slate-300 mt-6" style={{ borderBottom: '2px solid #0B3C5D', paddingBottom: '2px' }}>
              tocca per girare
            </p>
          </div>

          <div
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderColor: '#800020',
              borderWidth: '2px'
            }}
            className="absolute inset-0 rounded-2xl bg-slate-50 flex flex-col items-center justify-center p-8 text-center"
          >
            <p className="text-[10px] font-black uppercase tracking-widest mb-4" style={{ color: '#d97706' }}>risposta</p>
            <div className="text-lg font-bold text-slate-800 leading-relaxed">
              {renderLatex(card.retro)}
            </div>
            {card.nota && (
              <div className="text-sm text-slate-400 mt-4 leading-relaxed">
                {renderLatex(card.nota)}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="flex items-center gap-3 w-full max-w-xl">
        <button
          onClick={goPrev}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
        >
          ← Precedente
        </button>
        <button
          onClick={reshuffle}
          className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-400 hover:bg-slate-50 transition-colors"
          title="Rimescola"
        >
          ⇌
        </button>
        <button
          onClick={goNext}
          className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
        >
          Successiva →
        </button>
      </div>
    </motion.div>
  );
};

// --- CARD RISORSA ---
const ResourceCard = ({ resource, onClick, isFlashcard }) => {
  const isVideo = !isFlashcard && resource.categoria === 'video';
  const catKey = isFlashcard ? 'flashcard' : resource.categoria;
  const displayName = isFlashcard ? resource.argomento : resource.nome;

  const gradients = {
    teoria:    'from-[#0B3C5D] via-[#1a5a8a] to-[#2d7ab8]',
    video:     'from-[#800020] via-[#a8002b] to-[#d00036]',
    flashcard: 'from-[#d97706] via-[#f59e0b] to-[#fbbf24]',
    esercizi:  'from-[#059669] via-[#10b981] to-[#34d399]'
  };

  // Grafico y = x^3
  const CubicGraph = () => (
    <svg viewBox="-50 -50 100 100" className="w-full h-full" fill="none"
      stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: 0.22 }}>
      <line x1="-46" y1="0" x2="46" y2="0" strokeWidth="0.8" opacity="0.5"/>
      <line x1="0" y1="-46" x2="0" y2="46" strokeWidth="0.8" opacity="0.5"/>
      <polyline points={
        Array.from({ length: 51 }, (_, i) => {
          const t = (i - 25) / 25; // -1 to 1
          const x = t * 44;
          const y = -(t * t * t) * 44;
          return `${x},${Math.max(-46, Math.min(46, y))}`;
        }).join(' ')
      } />
    </svg>
  );

  // Grafico y = arctan(x)
  const ArctanGraph = () => (
    <svg viewBox="-50 -50 100 100" className="w-full h-full" fill="none"
      stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: 0.22 }}>
      <line x1="-46" y1="0" x2="46" y2="0" strokeWidth="0.8" opacity="0.5"/>
      <line x1="0" y1="-46" x2="0" y2="46" strokeWidth="0.8" opacity="0.5"/>
      {/* asintoti orizzontali ±π/2 */}
      <line x1="-46" y1="-26" x2="46" y2="-26" strokeWidth="0.7" strokeDasharray="3,3" opacity="0.35"/>
      <line x1="-46" y1="26" x2="46" y2="26" strokeWidth="0.7" strokeDasharray="3,3" opacity="0.35"/>
      <polyline points={
        Array.from({ length: 61 }, (_, i) => {
          const x = (i - 30) * 1.53;
          const y = -Math.atan(x / 12) * 33;
          return `${x},${y}`;
        }).join(' ')
      } />
    </svg>
  );

  // Icona play statica
  const PlayIcon = () => (
    <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" style={{ opacity: 0.22 }}>
      <circle cx="24" cy="24" r="21" stroke="white" strokeWidth="2"/>
      <polygon points="19,15 37,24 19,33" fill="white"/>
    </svg>
  );

  // Simbolo ⟺ geometrico (due frecce orizzontali)
  const BiconditionalIcon = () => (
    <svg viewBox="0 0 80 30" className="w-16 h-8" fill="none"
      stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ opacity: 0.22 }}>
      {/* Linea centrale */}
      <line x1="8" y1="15" x2="72" y2="15"/>
      {/* Freccia sinistra */}
      <polyline points="18,7 8,15 18,23"/>
      {/* Freccia destra */}
      <polyline points="62,7 72,15 62,23"/>
    </svg>
  );

  const centerGraphic = {
    teoria:    <CubicGraph />,
    esercizi:  <ArctanGraph />,
    video:     <PlayIcon />,
    flashcard: <BiconditionalIcon />
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="group cursor-pointer"
    >
      <div
        className={`relative rounded-md overflow-hidden shadow-sm bg-gradient-to-br ${gradients[catKey]}`}
        style={{ aspectRatio: '3/4' }}
      >
        {/* Hover: solo gioco di luce, nessun movimento */}
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/12 transition-all duration-300 z-20 pointer-events-none" />
        {/* Sfumatura interna per leggibilità testo */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/20 z-10 pointer-events-none" />

        {/* Grafico / icona centrale */}
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          {centerGraphic[catKey]}
        </div>

        {/* Titolo: piena larghezza, si espande verso il basso */}
        <div className="absolute inset-x-0 top-0 p-2 z-30 pointer-events-none">
          <h3 className="text-white font-bold leading-tight drop-shadow w-full break-words text-[9px]">
            {displayName}
          </h3>
        </div>
      </div>
    </motion.div>
  );
};

// --- VIEWER EMBEDDED ---
const ResourceViewer = ({ resource }) => {
  const isVideo = resource.categoria === 'video';
  const iframeRef = useRef(null);

  const getYouTubeId = (url) => {
    if (url.includes('v=')) return url.split('v=')[1].split('&')[0];
    if (url.includes('youtu.be/')) return url.split('youtu.be/')[1].split('?')[0];
    if (url.includes('embed/')) return url.split('embed/')[1].split('?')[0];
    return url;
  };

  const handleIframeLoad = () => {
    if (!isVideo && iframeRef.current) {
      setTimeout(() => {
        iframeRef.current.contentWindow.postMessage(
          { type: 'OPEN_PDF', url: resource.url },
          '*'
        );
      }, 600);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-full rounded-xl overflow-hidden bg-slate-900 shadow-2xl"
    >
      {isVideo ? (
        <iframe
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${getYouTubeId(resource.url)}?rel=0&modestbranding=1`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full h-full"
        />
      ) : (
        <iframe
          ref={iframeRef}
          src="https://matheight-reader.pages.dev/"
          width="100%"
          height="100%"
          frameBorder="0"
          className="w-full h-full"
          onLoad={handleIframeLoad}
        />
      )}
    </motion.div>
  );
};

// --- SIDEBAR (desktop) ---
const Sidebar = ({ activeCat, setActiveCat, searchQuery, setSearchQuery, filteredCount, onBack }) => (
  <motion.aside
    initial={{ x: -300, opacity: 0 }}
    animate={{ x: 0, opacity: 1 }}
    exit={{ x: -300, opacity: 0 }}
    transition={{ type: "spring", damping: 25, stiffness: 200 }}
    className="w-72 border-r border-slate-100 bg-white/80 backdrop-blur-md flex flex-col p-6 z-20"
  >
    <button
      onClick={onBack}
      className="text-xs font-black uppercase opacity-30 hover:opacity-100 transition-opacity mb-8 text-left"
    >
      ← Hub
    </button>
    <nav className="flex flex-col gap-3 mb-6">
      {CATEGORIES.map((cat) => (
        <motion.button
          key={cat.id}
          onClick={() => setActiveCat(cat.id)}
          whileHover={{ x: 8 }}
          className={`relative flex items-center gap-4 p-4 rounded-xl transition-all ${
            activeCat === cat.id ? 'bg-slate-50 shadow-sm' : 'hover:bg-slate-50/50'
          }`}
        >
          <div
            className="h-10 w-1 rounded-full transition-all"
            style={{ backgroundColor: cat.color, opacity: activeCat === cat.id ? 1 : 0.3 }}
          />
          <span
            className="font-black text-xl tracking-tighter uppercase italic"
            style={{ color: cat.color, opacity: activeCat === cat.id ? 1 : 0.4 }}
          >
            {cat.label}
          </span>
        </motion.button>
      ))}
    </nav>
    {activeCat !== 'flashcard' && (
      <input
        type="text"
        placeholder="Cerca risorse..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 mb-4"
      />
    )}
    <div className="mt-auto pt-6 border-t border-slate-100">
      <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-2">
        {activeCat === 'flashcard' ? 'Argomenti disponibili' : 'Risorse disponibili'}
      </p>
      <p className="text-2xl font-black" style={{ color: CATEGORIES.find(c => c.id === activeCat)?.color }}>
        {filteredCount}
      </p>
    </div>
  </motion.aside>
);

// --- BOTTOMBAR (mobile) ---
const BottomBar = ({ activeCat, setActiveCat, onBack }) => (
  <motion.nav
    initial={{ y: 100, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    exit={{ y: 100, opacity: 0 }}
    transition={{ type: "spring", damping: 25, stiffness: 200 }}
    className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-100 flex items-center justify-around px-2 py-2 safe-area-inset-bottom"
    style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
  >
    <button
      onClick={onBack}
      className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all opacity-30 hover:opacity-100"
    >
      <span className="text-lg">⌂</span>
      <span className="text-[9px] font-black uppercase tracking-wide text-slate-500">Hub</span>
    </button>
    {CATEGORIES.map((cat) => (
      <button
        key={cat.id}
        onClick={() => setActiveCat(cat.id)}
        className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${
          activeCat === cat.id ? 'bg-slate-50' : 'opacity-40'
        }`}
      >
        <div
          className="w-1 h-5 rounded-full"
          style={{ backgroundColor: cat.color }}
        />
        <span
          className="text-[9px] font-black uppercase tracking-wide italic"
          style={{ color: cat.color }}
        >
          {cat.label}
        </span>
      </button>
    ))}
  </motion.nav>
);

// --- APP PRINCIPALE ---
export default function AcademyApp() {
  const [view, setView] = useState('LOADING');
  const [activeCat, setActiveCat] = useState('teoria');
  const [tick, setTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedResource, setSelectedResource] = useState(null);
  const [selectedFlashcardSet, setSelectedFlashcardSet] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [resources, setResources] = useState([]);
  const [flashcardSets, setFlashcardSets] = useState([]);
  const isMobile = useIsMobile();

  useEffect(() => {
    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          console.error('❌ Nessuna sessione attiva');
          window.location.href = DASHBOARD_URL;
          return;
        }

        const userId = session.user.id;

        const { data: profile, error: pError } = await supabase
          .from('profili_utenti')
          .select('nome, classe, indirizzo_reale, id_logico')
          .eq('id', userId)
          .single();

        if (pError) throw pError;
        setUserProfile(profile);

        if (profile.id_logico != null) {
          const { data: visData, error: visError } = await supabase
            .from('visibilita')
            .select('risorse(*)')
            .eq('classe', profile.classe)
            .eq('id_logico', profile.id_logico);

          if (visError) throw visError;
          const loadedResources = visData.map(v => v.risorse).filter(r => r !== null);
          setResources(loadedResources);

          const { data: fcData, error: fcError } = await supabase
            .from('visibilita_flashcard')
            .select('flashcard(*)')
            .eq('classe', profile.classe)
            .eq('id_logico', profile.id_logico);

          if (fcError) throw fcError;
          const loadedSets = fcData
            .map(v => v.flashcard)
            .filter(f => f !== null)
            .sort((a, b) => (a.ordine || 0) - (b.ordine || 0));
          setFlashcardSets(loadedSets);
        }

        setView('HUB');
      } catch (err) {
        console.error('❌ Errore init:', err);
        setView('ERROR');
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (view !== 'HUB') return;
    const interval = setInterval(() => {
      setTick((prev) => (prev + 1) % 4);
    }, 850);
    return () => clearInterval(interval);
  }, [view]);

  const filteredResources = resources
    .filter(r => {
      const matchCategory = r.categoria === activeCat;
      const matchSearch = r.nome.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    })
    .sort((a, b) => {
      const ordineA = a.ordine || '0';
      const ordineB = b.ordine || '0';
      const numA = parseFloat(ordineA);
      const numB = parseFloat(ordineB);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return String(ordineA).localeCompare(String(ordineB));
    });

  const flashcardArgomenti = flashcardSets.map(set => ({
    id: set.id,
    argomento: set.argomento,
    count: set.flashcards.length
  }));

  const filteredCount = activeCat === 'flashcard'
    ? flashcardSets.length
    : filteredResources.length;

  const getArcSpecs = (id) => {
    switch(id) {
      case 'teoria':    return { container: "bottom-0 right-0", path: "M 48 24 Q 24 24 24 48" };
      case 'flashcard': return { container: "top-0 right-0",   path: "M 24 0 Q 24 24 48 24" };
      case 'esercizi':  return { container: "top-0 left-0",    path: "M 0 24 Q 24 24 24 0" };
      case 'video':     return { container: "bottom-0 left-0", path: "M 24 48 Q 24 24 0 24" };
      default: return {};
    }
  };

  if (view === 'LOADING') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold text-slate-600">Caricamento Academy...</p>
        </div>
      </div>
    );
  }

  if (view === 'ERROR') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center text-red-600 max-w-md">
          <p className="font-bold text-xl mb-2">⚠️ Errore di accesso</p>
          <p className="text-sm mb-4">Impossibile accedere all'Academy</p>
          <a
            href={DASHBOARD_URL}
            className="inline-block px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm"
          >
            Torna alla Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col overflow-hidden font-sans select-none relative">

      {view === 'HUB' && <WaveSystem />}

      <header className="p-4 flex justify-between items-center border-b border-slate-50 bg-white/80 backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="text-xs font-black uppercase opacity-30 hover:opacity-100 transition-opacity"
            title="Torna alla Dashboard"
          >
            ← Dashboard
          </button>
          <div className="font-black tracking-tighter text-base italic leading-none">
            <span style={{ color: '#0B3C5D' }}>MATHEIGHT</span>
            <span style={{ color: '#800020' }}>ACADEMY</span>
          </div>
          {userProfile && (
            <div className="text-xs font-semibold">
              <span className="text-slate-400">|</span>
              <span className="ml-2" style={{ color: '#800020' }}>{userProfile.nome}</span>
              <span className="ml-1 text-slate-400">·</span>
              <span className="ml-1" style={{ color: '#0B3C5D' }}>
                {userProfile.classe}° {userProfile.indirizzo_reale || ''}
              </span>
            </div>
          )}
        </div>
        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
      </header>

      <div className={`flex flex-1 overflow-hidden relative ${isMobile && view === 'GALLERY' ? 'pb-16' : ''}`}>

        <AnimatePresence>
          {view === 'GALLERY' && !isMobile && (
            <Sidebar
              activeCat={activeCat}
              setActiveCat={(cat) => {
                setActiveCat(cat);
                setSelectedResource(null);
                setSelectedFlashcardSet(null);
                setSearchQuery('');
              }}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              filteredCount={filteredCount}
              onBack={() => {
                setView('HUB');
                setSelectedResource(null);
                setSelectedFlashcardSet(null);
              }}
            />
          )}
        </AnimatePresence>

        <main className="flex-1 flex flex-col relative overflow-hidden">
          <div className="flex-1 overflow-hidden p-6 z-10 flex flex-col">

            {view === 'HUB' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex items-center justify-center"
              >
                <div className="w-full max-w-lg">
                  <div className="grid grid-cols-2 gap-4">
                    {CATEGORIES.map((cat) => {
                      const specs = getArcSpecs(cat.id);
                      const isActive = ANTICLOCKWISE_ORDER[tick] === cat.id;
                      const count = cat.id === 'flashcard'
                        ? flashcardSets.length
                        : resources.filter(r => r.categoria === cat.id).length;

                      return (
                        <motion.button
                          key={cat.id}
                          onClick={() => { setActiveCat(cat.id); setView('GALLERY'); }}
                          whileHover={{ y: -8, boxShadow: "0px 20px 40px rgba(0,0,0,0.06)" }}
                          className="relative h-44 rounded-[24px] bg-white/70 backdrop-blur-xl border border-slate-100 flex flex-col items-start justify-end p-8 group overflow-hidden"
                        >
                          <div className={`absolute w-12 h-12 ${specs.container}`}>
                            <svg width="48" height="48" viewBox="0 0 48 48">
                              <motion.path
                                d={specs.path}
                                fill="none"
                                stroke={cat.color}
                                strokeWidth="4"
                                strokeLinecap="round"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={isActive ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                                transition={isActive
                                  ? { duration: 1.0, ease: "linear" }
                                  : { duration: 0.2, ease: "easeIn" }
                                }
                              />
                            </svg>
                          </div>
                          <div className="absolute top-4 right-4 text-xs font-black opacity-20" style={{ color: cat.color }}>
                            {count}
                          </div>
                          <div className="relative z-10 flex flex-col items-start pointer-events-none">
                            <div className="h-1 w-6 mb-4 opacity-30 group-hover:w-12 transition-all" style={{ backgroundColor: cat.color }} />
                            <span className="font-black text-2xl tracking-tighter uppercase italic leading-none" style={{ color: cat.color }}>
                              {cat.label}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'GALLERY' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex-1 flex flex-col overflow-hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2
                    className="text-3xl font-black italic uppercase"
                    style={{ color: CATEGORIES.find(c => c.id === activeCat)?.color }}
                  >
                    {activeCat === 'flashcard' && selectedFlashcardSet
                      ? selectedFlashcardSet.argomento
                      : CATEGORIES.find(c => c.id === activeCat)?.label}
                  </h2>
                  {(selectedResource || selectedFlashcardSet) && (
                    <button
                      onClick={() => {
                        setSelectedResource(null);
                        setSelectedFlashcardSet(null);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors text-sm font-bold"
                    >
                      <span>←</span>
                      <span>Torna alla gallery</span>
                    </button>
                  )}
                </div>

                {isMobile && !selectedResource && !selectedFlashcardSet && activeCat !== 'flashcard' && (
                  <input
                    type="text"
                    placeholder="Cerca risorse..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-300 mb-4"
                  />
                )}

                {activeCat === 'flashcard' ? (
                  selectedFlashcardSet ? (
                    <div className="flex-1 min-h-0 overflow-y-auto">
                      <FlashcardPlayer flashcardSet={selectedFlashcardSet} />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      {flashcardArgomenti.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                          <p className="text-lg font-semibold">Nessuna flashcard disponibile</p>
                          <p className="text-sm mt-2">Le flashcard verranno aggiunte presto</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 pb-6">
                          {flashcardArgomenti.map((item) => (
                            <ResourceCard
                              key={item.id}
                              resource={{ argomento: item.argomento }}
                              isFlashcard={true}
                              onClick={() => {
                                const set = flashcardSets.find(s => s.id === item.id);
                                setSelectedFlashcardSet(set);
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  selectedResource ? (
                    <div className="flex-1 min-h-0">
                      <ResourceViewer resource={selectedResource} />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      {filteredResources.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                          <p className="text-lg font-semibold">Nessuna risorsa trovata</p>
                          <p className="text-sm mt-2">Prova a modificare la ricerca</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2 pb-6">
                          {filteredResources.map((resource, idx) => (
                            <ResourceCard
                              key={resource.id || idx}
                              resource={resource}
                              isFlashcard={false}
                              onClick={() => setSelectedResource(resource)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                )}
              </motion.div>
            )}
          </div>

          {!isMobile && (
            <footer className="py-6 border-t border-slate-50 flex justify-center bg-white/80 backdrop-blur-md z-20">
              <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.5em]">
                Hybrid Motion Control
              </p>
            </footer>
          )}
        </main>
      </div>

      <AnimatePresence>
        {view === 'GALLERY' && isMobile && (
          <BottomBar
            activeCat={activeCat}
            setActiveCat={(cat) => {
              setActiveCat(cat);
              setSelectedResource(null);
              setSelectedFlashcardSet(null);
              setSearchQuery('');
            }}
            onBack={() => {
              setView('HUB');
              setSelectedResource(null);
              setSelectedFlashcardSet(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}