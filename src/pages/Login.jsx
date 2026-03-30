import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import './Login.css';

// ── Costellazione canvas ──────────────────────────────
function ConstellationCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    let animId;

    const COLORS = [
      'rgba(0, 31, 80,',
      'rgba(100, 0, 0,',
      'rgba(30, 60, 120,',
    ];

    const NUM_POINTS   = 80;
    const MAX_DIST     = 160;
    const POINT_RADIUS = 1.8;
    const SPEED        = 0.3;

    let points = [];

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    function initPoints() {
      points = Array.from({ length: NUM_POINTS }, (_, i) => ({
        x:      Math.random() * canvas.width,
        y:      Math.random() * canvas.height,
        vx:     (Math.random() - 0.5) * SPEED,
        vy:     (Math.random() - 0.5) * SPEED,
        color:  COLORS[i % COLORS.length],
        phase:  Math.random() * Math.PI * 2,
        pSpeed: 0.005 + Math.random() * 0.01,
      }));
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      points.forEach(p => {
        p.x     += p.vx;
        p.y     += p.vy;
        p.phase += p.pSpeed;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      });

      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          const dx   = points[i].x - points[j].x;
          const dy   = points[i].y - points[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.35;
            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(points[j].x, points[j].y);
            ctx.strokeStyle = `${points[i].color}${alpha})`;
            ctx.lineWidth   = 0.6;
            ctx.stroke();
          }
        }
      }

      points.forEach(p => {
        const pulseAlpha = 0.4 + Math.sin(p.phase) * 0.25;
        ctx.beginPath();
        ctx.arc(p.x, p.y, POINT_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = `${p.color}${pulseAlpha})`;
        ctx.fill();

        const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, POINT_RADIUS * 4);
        grd.addColorStop(0, `${p.color}${pulseAlpha * 0.4})`);
        grd.addColorStop(1, `${p.color}0)`);
        ctx.beginPath();
        ctx.arc(p.x, p.y, POINT_RADIUS * 4, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
      });

      animId = requestAnimationFrame(draw);
    }

    resize();
    initPoints();
    draw();

    window.addEventListener('resize', () => { resize(); initPoints(); });
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="constellation-canvas" />;
}

// ── Login component ───────────────────────────────────
export default function Login() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [msgType, setMsgType] = useState('');

  async function handleSocialLogin(provider) {
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });

    if (error) {
      setMessage(`Errore durante il login con ${provider}.`);
      setMsgType('error');
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <ConstellationCanvas />

      <div className="login-card">
        {/* Brand */}
        <div className="brand">
          <div className="brand-line brand-line-top" />
          <h1 className="brand-name">MatHeight</h1>
          <div className="brand-line brand-line-bottom" />
        </div>

        <p className="brand-tagline">Accedi alla tua dashboard</p>

        {/* Messaggio */}
        {message && (
          <div className={`msg ${msgType}`} role="alert">
            {message}
          </div>
        )}

        {/* Social */}
        <div className="social-grid">
          <button
            className="btn-social btn-discord"
            onClick={() => handleSocialLogin('discord')}
            disabled={loading}
            type="button"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            Accedi con Discord
          </button>

          <button
            className="btn-social btn-google btn-coming-soon"
            disabled
            type="button"
            title="Prossimamente"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google <span className="coming-soon-badge">Presto</span>
          </button>
        </div>
        {/* Link registrazione */}
        <p className="register-link">
          Nuovo utente? <a href={`${import.meta.env.VITE_REGISTER_URL ?? '/registrati'}`}>Iscriviti</a>
        </p>
      </div>
    </div>
  );
}
