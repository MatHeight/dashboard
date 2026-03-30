import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const BDX  = [128, 0,  32];
const NAVY = [30,  58, 138];
const TEAL = [15, 118, 110];

const TIPO_SCUOLA_LABEL = {
  elementari:    'Scuola Primaria',
  medie:         'Scuola Secondaria di I Grado',
  liceotecnico:  'Liceo / Istituto Tecnico',
  professionale: 'Istituto Professionale',
};

const S = {
  page: {
    minHeight: '100vh',
    background: '#f1f5f9',
    padding: '28px 16px',
    fontFamily: 'Segoe UI, Arial, sans-serif',
  },
  wrap: { maxWidth: '700px', margin: '0 auto' },
  card: {
    background: '#fff',
    borderRadius: '6px',
    boxShadow: '0 1px 8px rgba(30,58,138,.10)',
    padding: '32px',
    marginBottom: '20px',
    border: '1px solid #e2e8f0',
  },
  h2: {
    fontSize: '1.1rem', fontWeight: 700, color: `rgb(${BDX})`,
    marginTop: 0, marginBottom: '20px',
    borderBottom: `2px solid rgb(${BDX})`,
    paddingBottom: '8px', textTransform: 'uppercase', letterSpacing: '.06em',
  },
  label: {
    display: 'block', fontWeight: 600, fontSize: '.82rem', color: '#475569',
    textTransform: 'uppercase', letterSpacing: '.05em',
    marginBottom: '5px', marginTop: '18px',
  },
  input: {
    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1',
    borderRadius: '4px', fontSize: '.95rem', color: '#1e293b',
    background: '#fafafa', outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%', padding: '9px 12px', border: '1px solid #cbd5e1',
    borderRadius: '4px', fontSize: '.95rem', color: '#1e293b',
    background: '#fafafa', outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  btnPrimary: {
    padding: '11px 28px', background: `rgb(${NAVY})`, color: '#fff',
    border: 'none', borderRadius: '4px', fontWeight: 700, fontSize: '.95rem',
    cursor: 'pointer', letterSpacing: '.02em', fontFamily: 'inherit',
  },
  btnGhost: {
    padding: '11px 28px', background: '#e2e8f0', color: '#334155',
    border: 'none', borderRadius: '4px', fontWeight: 600, fontSize: '.95rem',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' },
  helpText: { fontSize: '.78rem', color: '#94a3b8', marginTop: '4px', display: 'block' },
  notice: (bg, border, text) => ({
    background: bg, border: `1px solid ${border}`, borderRadius: '4px',
    padding: '10px 14px', marginBottom: '16px', fontSize: '.82rem', color: text,
  }),
};

const safe = (v, fb = '-') => String(v ?? '').trim() || fb;

function pdfHeader(doc, scuola, codice, as, pW, mL, mR) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text(safe(scuola, 'Istituzione'), mL, 9);
  doc.setFont('helvetica', 'normal');
  if (codice) doc.text(`Cod. Mecc.: ${codice}`, mL + 80, 9);
  doc.text(`A.S. ${safe(as)}`, pW - mR, 9, { align: 'right' });
  doc.setDrawColor(180, 180, 200);
  doc.setLineWidth(0.25);
  doc.line(mL, 11.5, pW - mR, 11.5);
}

function pdfFooter(doc, n, pW, pH, mL, mR) {
  doc.setDrawColor(180, 180, 200);
  doc.setLineWidth(0.25);
  doc.line(mL, pH - 12, pW - mR, pH - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 150);
  doc.text('Progetto Didattico Educativo Svolto  -  Istruzione Parentale', mL, pH - 7);
  doc.text(`Pag. ${n}`, pW - mR, pH - 7, { align: 'right' });
}

export default function App() {
  const [step,        setStep]        = useState(0);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [generating,  setGenerating]  = useState(false);
  const [userId,      setUserId]      = useState(null);
  const [attivita,    setAttivita]    = useState([]);
  const [udaList,     setUdaList]     = useState([]);

  // Stessi campi di App.jsx step 1 e step 2
  const [fd, setFd] = useState({
    // Step 1 - Dati Istituzione
    'in-scuola-nome':      '',
    'in-scuola-codice':    '',
    'in-scuola-indirizzo': '',
    // Step 2 - Dati Alunno
    'in-alunno-nome':      '',
    'in-alunno-nascita':   '',
    'in-as':               '',
    'in-alunno-residenza': '',
    'in-classe':           '1',
    'in-indirizzo-studio': '',
    'in-certificazioni':   '',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setUserId(session.user.id);
      setLoadingUser(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setUserId(s?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const ch = e => setFd(prev => ({ ...prev, [e.target.id]: e.target.value }));

  const caricaTutto = async () => {
    setLoadingData(true);
    try {
      const { data: base, error: e1 } = await supabase
        .from('diario_attivita').select('*')
        .eq('user_id', userId).order('data_ora', { ascending: true });
      if (e1) throw e1;

      const attComplete = await Promise.all((base || []).map(async att => {
        let d = {};
        if (att.tipo_attivita === 'studio') {
          const { data } = await supabase.from('diario_studio')
            .select('materia, argomento, dettagli').eq('id', att.id).single();
          d = data || {};
        } else if (att.tipo_attivita === 'uda') {
          const { data } = await supabase.from('diario_uda')
            .select('titolo_uda, descrizione_attivita').eq('id', att.id).single();
          d = data || {};
        } else if (att.tipo_attivita === 'extrascolastica') {
          const { data } = await supabase.from('diario_extrascolastiche')
            .select('titolo_attivita, descrizione_attivita, competenze_ids').eq('id', att.id).single();
          if (data?.competenze_ids?.length > 0) {
            const { data: comps } = await supabase.from('competenze')
              .select('nome').in('id', data.competenze_ids);
            d = { ...data, competenze: comps?.map(c => c.nome) || [] };
          } else d = data || {};
        }
        return { ...att, d };
      }));
      setAttivita(attComplete);

      const { data: uda, error: e2 } = await supabase
        .from('uda_documenti')
        .select('id, titolo, tipo_scuola, stato, dati_compilazione, html_generato, created_at')
        .eq('user_id', userId).order('created_at', { ascending: true });
      if (e2) throw e2;
      setUdaList(uda || []);
    } catch (err) {
      alert('Errore nel caricamento dati: ' + err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const goNext = async () => {
    if (step === 2) { await caricaTutto(); setStep(3); }
    else setStep(s => s + 1);
  };
  const goBack = () => setStep(s => Math.max(0, s - 1));

  const formattaUdaHtml = (dc) => {
    if (!dc) return '';
    const dati = typeof dc === 'string' ? JSON.parse(dc) : dc;
    const campi = [
      ['titolo','Titolo'], ['materie','Discipline'], ['traguardi','Traguardi di competenza'],
      ['competenze_europee','Competenze europee'], ['obiettivi','Obiettivi di apprendimento'],
      ['processi','Processi attivati'], ['prodotto_finale','Prodotto finale'],
      ['metodologia','Metodologia'], ['valutazione','Valutazione'], ['tempi','Tempi'],
    ];
    return campi.map(([k, n]) => {
      const v = dati[k];
      if (!v) return '';
      const content = Array.isArray(v)
        ? `<ul style="margin:3px 0 0 14px;padding:0">${v.map(i => `<li>${typeof i === 'string' ? i : i?.testo || i?.nome || JSON.stringify(i)}</li>`).join('')}</ul>`
        : `<span>${v}</span>`;
      return `<div style="margin-bottom:9px"><strong style="color:rgb(${NAVY});font-size:.82rem;text-transform:uppercase;letter-spacing:.04em">${n}</strong><br/>${content}</div>`;
    }).join('');
  };

  const generaPDF = () => {
    setGenerating(true);
    setTimeout(() => {
      try { _buildPDF(); }
      catch (err) { console.error(err); alert('Errore:\n' + err.message); setGenerating(false); }
    }, 80);
  };

  const _buildPDF = () => {
    const doc  = new jsPDF('p', 'mm', 'a4');
    const pW   = doc.internal.pageSize.getWidth();
    const pH   = doc.internal.pageSize.getHeight();
    const mL   = 20, mR = 20;
    const maxW = pW - mL - mR;
    let y      = 16;
    let pgNum  = 1;

    const newPage = () => {
      pdfFooter(doc, pgNum, pW, pH, mL, mR);
      doc.addPage(); pgNum++;
      pdfHeader(doc, fd['in-scuola-nome'], fd['in-scuola-codice'], fd['in-as'], pW, mL, mR);
      y = 20;
    };
    const chk = (needed) => { if (y + needed > pH - 18) newPage(); };

    const secTitle = (label, color) => {
      const c = color || BDX;
      chk(16);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...c);
      doc.text(label.toUpperCase(), mL, y);
      doc.setDrawColor(...c); doc.setLineWidth(0.5);
      doc.line(mL, y + 2.5, pW - mR, y + 2.5);
      doc.setDrawColor(180, 180, 200); doc.setLineWidth(0.25); // reset
      y += 10; doc.setTextColor(0, 0, 0);
    };

    const rowKV = (label, value) => {
      chk(8);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(80, 80, 110);
      doc.text(label, mL, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(15, 15, 15);
      const lines = doc.splitTextToSize(safe(value), maxW - 58);
      doc.text(lines, mL + 58, y);
      y += Math.max(7, lines.length * 5.5);
    };

    // INTESTAZIONE
    pdfHeader(doc, fd['in-scuola-nome'], fd['in-scuola-codice'], fd['in-as'], pW, mL, mR);
    y = 20;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY);
    doc.text(safe(fd['in-scuola-nome'], 'Istituzione scolastica'), mL, y); y += 5.5;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 110);
    if (fd['in-scuola-codice'])    { doc.text(`Codice Meccanografico: ${fd['in-scuola-codice']}`, mL, y); y += 5; }
    if (fd['in-scuola-indirizzo']) { doc.text(fd['in-scuola-indirizzo'], mL, y); y += 5; }

    y += 5;
    doc.setDrawColor(...NAVY); doc.setLineWidth(0.6);
    doc.line(mL, y, pW - mR, y);
    doc.setDrawColor(180, 180, 200); doc.setLineWidth(0.25);
    y += 12;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...BDX);
    doc.text('PROGETTO DIDATTICO EDUCATIVO SVOLTO', pW / 2, y, { align: 'center' }); y += 8;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
    doc.text('Istruzione Parentale  -  Rendiconto delle attivita\' formative svolte', pW / 2, y, { align: 'center' }); y += 18;

    // DATI ALUNNO
    secTitle("Dati dell'Alunno/a", NAVY);
    rowKV('STUDENTE:', (fd['in-alunno-nome'] || '').toUpperCase() || '-');
    if (fd['in-alunno-nascita'])   rowKV('DATA DI NASCITA:', fd['in-alunno-nascita']);
    if (fd['in-alunno-residenza']) rowKV('RESIDENZA:', fd['in-alunno-residenza']);
    rowKV('CLASSE:', `${safe(fd['in-classe'])} - ${safe(fd['in-indirizzo-studio'])}`);
    rowKV('ANNO SCOLASTICO:', safe(fd['in-as']));
    if (fd['in-certificazioni'])   rowKV('CERTIFICAZIONI:', fd['in-certificazioni']);
    y += 10;

    // RIEPILOGO
    const studi  = attivita.filter(a => a.tipo_attivita === 'studio');
    const udaAtt = attivita.filter(a => a.tipo_attivita === 'uda');
    const extra  = attivita.filter(a => a.tipo_attivita === 'extrascolastica');

    // PERCORSI DI STUDIO
    if (studi.length > 0) {
      secTitle('Percorsi di Studio', NAVY);
      const perMat = {};
      studi.forEach(a => { const m = a.d?.materia || 'N.D.'; (perMat[m] = perMat[m] || []).push(a); });

      Object.entries(perMat).forEach(([mat, voci]) => {
        chk(18);
        doc.setFillColor(235, 243, 255); doc.setDrawColor(...NAVY); doc.setLineWidth(0.3);
        doc.roundedRect(mL, y - 1, maxW, 10, 1.5, 1.5, 'FD');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...NAVY);
        doc.text(mat, mL + 4, y + 6.5);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(80, 80, 110);
        doc.text(`${voci.length} ${voci.length === 1 ? 'sessione' : 'sessioni'}`, pW - mR - 4, y + 6.5, { align: 'right' });
        doc.setDrawColor(180, 180, 200); doc.setLineWidth(0.25);
        y += 14;

        voci.forEach((att, idx) => {
          const dataStr = new Date(att.data_ora).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
          const argom = safe(att.d?.argomento);
          const dett  = att.d?.dettagli;
          const rowH  = dett ? 20 : 11;
          chk(rowH);
          if (idx % 2 === 0) { doc.setFillColor(248, 250, 253); doc.rect(mL, y - 3, maxW, rowH, 'F'); }
          doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(50, 65, 130);
          doc.text(dataStr, mL + 3, y + 2);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(20, 20, 20);
          const al = doc.splitTextToSize(argom, maxW - 50);
          doc.text(al, mL + 48, y + 2); y += al.length * 5.2 + 2;
          if (dett) {
            chk(8); doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(100, 100, 120);
            const dl = doc.splitTextToSize(dett, maxW - 10);
            doc.text(dl, mL + 6, y); y += dl.length * 4.5 + 2;
          }
          y += 2;
        });
        y += 6;
      });
    }

    // UNITA' DI APPRENDIMENTO
    if (udaAtt.length > 0) {
      chk(18); secTitle("Unita' di Apprendimento Svolte", TEAL);
      udaAtt.forEach((att, idx) => {
        const dataStr = new Date(att.data_ora).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
        const titolo = safe(att.d?.titolo_uda);
        const descr  = att.d?.descrizione_attivita;
        const rowH   = descr ? 20 : 11;
        chk(rowH);
        if (idx % 2 === 0) { doc.setFillColor(235, 250, 245); doc.rect(mL, y - 3, maxW, rowH, 'F'); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...TEAL);
        doc.text(dataStr, mL + 3, y + 2);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(10, 55, 45);
        const tl = doc.splitTextToSize(titolo, maxW - 50);
        doc.text(tl, mL + 48, y + 2); y += tl.length * 5.2 + 2;
        if (descr) {
          chk(8); doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(55, 95, 85);
          const dl = doc.splitTextToSize(descr, maxW - 10);
          doc.text(dl, mL + 6, y); y += dl.length * 4.5 + 2;
        }
        y += 4;
      });
      y += 6;
    }

    // ATTIVITA' FORMATIVE ESTERNE
    if (extra.length > 0) {
      chk(18); secTitle("Attivita' Formative Esterne", [100, 36, 210]);
      extra.forEach((att, idx) => {
        const dataStr = new Date(att.data_ora).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });
        const titolo = safe(att.d?.titolo_attivita);
        const descr  = att.d?.descrizione_attivita;
        const comps  = att.d?.competenze;
        const rowH   = (descr || comps?.length > 0) ? 22 : 11;
        chk(rowH);
        if (idx % 2 === 0) { doc.setFillColor(248, 244, 255); doc.rect(mL, y - 3, maxW, rowH, 'F'); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 36, 210);
        doc.text(dataStr, mL + 3, y + 2);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(45, 18, 75);
        const tl = doc.splitTextToSize(titolo, maxW - 50);
        doc.text(tl, mL + 48, y + 2); y += tl.length * 5.2 + 2;
        if (descr) {
          chk(7); doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(85, 55, 115);
          const dl = doc.splitTextToSize(descr, maxW - 10);
          doc.text(dl, mL + 6, y); y += dl.length * 4.5 + 2;
        }
        if (comps?.length > 0) {
          chk(7);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(100, 36, 210);
          doc.text('Competenze sviluppate:', mL + 6, y);
          doc.setFont('helvetica', 'normal'); doc.setTextColor(65, 28, 100);
          const cl = doc.splitTextToSize(comps.join('  -  '), maxW - 52);
          doc.text(cl, mL + 52, y); y += cl.length * 4.5 + 2;
        }
        y += 4;
      });
      y += 6;
    }

    pdfFooter(doc, pgNum, pW, pH, mL, mR);

    // ALLEGATI UDA
    udaList.forEach((u, uIdx) => {
      doc.addPage(); pgNum++;
      pdfHeader(doc, fd['in-scuola-nome'], fd['in-scuola-codice'], fd['in-as'], pW, mL, mR);
      y = 20;

      doc.setFillColor(...NAVY); doc.rect(mL, y, maxW, 12, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      doc.text(`ALLEGATO ${uIdx + 1}  -  UNITA' DI APPRENDIMENTO`, mL + 5, y + 8);
      y += 18;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(...BDX);
      const titLines = doc.splitTextToSize(safe(u.titolo), maxW);
      doc.text(titLines, mL, y); y += titLines.length * 7 + 6;

      const tipoLabel = TIPO_SCUOLA_LABEL[u.tipo_scuola] || u.tipo_scuola || '-';
      [
        ['Tipologia:', tipoLabel],
        ['Stato:', u.stato || '-'],
        ['Data:', u.created_at ? new Date(u.created_at).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' }) : '-'],
      ].forEach(([l, v]) => {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(80, 80, 110);
        doc.text(l, mL, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
        doc.text(safe(v), mL + 28, y); y += 5.5;
      });

      y += 4;
      doc.setDrawColor(...NAVY); doc.setLineWidth(0.4);
      doc.line(mL, y, pW - mR, y);
      doc.setDrawColor(180, 180, 200); doc.setLineWidth(0.25);
      y += 9;

      if (u.html_generato) {
        const tmp = document.createElement('div');
        tmp.innerHTML = u.html_generato;
        tmp.querySelectorAll('h1,h2,h3,h4,p,li,td').forEach(el => {
          const tag  = el.tagName.toLowerCase();
          const text = el.textContent?.trim();
          if (!text) return;
          if (['h1','h2','h3','h4'].includes(tag)) {
            chk(14); doc.setFont('helvetica', 'bold');
            doc.setFontSize(tag === 'h1' ? 11 : 10); doc.setTextColor(...NAVY);
            doc.splitTextToSize(text, maxW).forEach(l => { chk(7); doc.text(l, mL, y); y += 6.5; });
            doc.setTextColor(0, 0, 0);
          } else if (tag === 'li') {
            chk(7); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
            doc.splitTextToSize('\u2022 ' + text, maxW - 6).forEach(l => { chk(6); doc.text(l, mL + 5, y); y += 5.2; });
          } else {
            chk(7); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
            doc.splitTextToSize(text, maxW).forEach(l => { chk(6); doc.text(l, mL, y); y += 5.2; });
          }
        });
      } else if (u.dati_compilazione) {
        const dc = typeof u.dati_compilazione === 'string' ? JSON.parse(u.dati_compilazione) : u.dati_compilazione;
        const CAMPI = [
          ['titolo','Titolo'], ['materie','Discipline coinvolte'],
          ['traguardi','Traguardi di competenza'], ['competenze_europee','Competenze europee'],
          ['obiettivi','Obiettivi di apprendimento'], ['processi','Processi attivati'],
          ['prodotto_finale','Prodotto finale'], ['metodologia','Metodologia'],
          ['strumenti','Strumenti e risorse'], ['valutazione',"Modalita' di valutazione"],
          ['tempi','Tempi di svolgimento'], ['risorse','Risorse'], ['descrizione','Descrizione'],
        ];
        const shown = new Set();
        CAMPI.forEach(([k, n]) => {
          const v = dc[k];
          if (!v || (Array.isArray(v) && v.length === 0)) return;
          shown.add(k);
          chk(16);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
          doc.text(n.toUpperCase(), mL, y);
          doc.setDrawColor(...NAVY); doc.setLineWidth(0.25);
          doc.line(mL, y + 2, mL + maxW * 0.45, y + 2);
          doc.setDrawColor(180, 180, 200); doc.setLineWidth(0.25);
          y += 7;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20, 20, 20);
          if (typeof v === 'string') {
            doc.splitTextToSize(v, maxW).forEach(l => { chk(6); doc.text(l, mL + 3, y); y += 5.2; });
          } else if (Array.isArray(v)) {
            v.forEach(item => {
              const t = typeof item === 'string' ? item : item?.testo || item?.nome || JSON.stringify(item);
              doc.splitTextToSize('\u2022 ' + t, maxW - 6).forEach(l => { chk(6); doc.text(l, mL + 3, y); y += 5.2; });
            });
          } else {
            Object.entries(v).forEach(([ck, cv]) => {
              doc.splitTextToSize(`${ck}: ${cv}`, maxW - 6).forEach(l => { chk(6); doc.text(l, mL + 3, y); y += 5.2; });
            });
          }
          y += 4;
        });
        Object.entries(dc).forEach(([k, v]) => {
          if (shown.has(k) || !v) return;
          chk(12);
          doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TEAL);
          doc.text(k.replace(/_/g, ' ').toUpperCase(), mL, y); y += 5;
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(20, 20, 20);
          const t = typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : JSON.stringify(v);
          doc.splitTextToSize(t, maxW).forEach(l => { chk(6); doc.text(l, mL + 3, y); y += 4.8; });
          y += 4;
        });
      } else {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(140, 140, 140);
        doc.text('Contenuto non disponibile.', mL, y); y += 10;
      }
      pdfFooter(doc, pgNum, pW, pH, mL, mR);
    });

    const nome  = (fd['in-alunno-nome'] || 'Discente').replace(/\s+/g, '_');
    const asStr = (fd['in-as'] || 'AS').replace('/', '-');
    doc.save(`PDES_${nome}_${asStr}.pdf`);
    setGenerating(false);
  };

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (loadingUser) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f1f5f9' }}>
        <p style={{ color:`rgb(${NAVY})`, fontWeight:600 }}>Caricamento...</p>
      </div>
    );
  }

  if (!userId) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#f1f5f9' }}>
        <div style={{ ...S.card, maxWidth:'400px', textAlign:'center' }}>
          <p style={{ color:'#dc2626', fontWeight:600 }}>Sessione non trovata. Torna alla dashboard e riprova.</p>
        </div>
      </div>
    );
  }

  // ── PREVIEW (step 3) ──────────────────────────────────────────────────────
  if (step === 3) {
    if (loadingData) {
      return (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'#525659' }}>
          <p style={{ color:'#fff', fontWeight:600, fontSize:'1.1rem' }}>Caricamento dati in corso...</p>
        </div>
      );
    }

    const studi  = attivita.filter(a => a.tipo_attivita === 'studio');
    const udaAtt = attivita.filter(a => a.tipo_attivita === 'uda');
    const extra  = attivita.filter(a => a.tipo_attivita === 'extrascolastica');
    const perMat = {};
    studi.forEach(a => { const m = a.d?.materia || 'N.D.'; (perMat[m] = perMat[m] || []).push(a); });
    const fmtDate = iso => new Date(iso).toLocaleDateString('it-IT', { day:'2-digit', month:'long', year:'numeric' });

    const secH = (color) => ({
      color, borderBottom: `2px solid ${color}`, paddingBottom: '6px',
      marginBottom: '12px', marginTop: 0, fontSize: '11pt', fontWeight: 'bold',
      textTransform: 'uppercase', letterSpacing: '.05em',
    });
    const tdDate = (color) => ({
      padding: '5px 8px', width: '145px', color, fontWeight: 'bold',
      verticalAlign: 'top', fontSize: '8.5pt', whiteSpace: 'nowrap',
    });
    const tdContent = { padding: '5px 8px', verticalAlign: 'top', fontSize: '9.5pt' };

    return (
      <div style={{ background:'#525659', minHeight:'100vh', padding:'20px 0', fontFamily:'Arial, sans-serif' }}>

        {/* Toolbar sticky */}
        <div style={{
          background:'#2d3748', padding:'12px 24px', position:'sticky', top:0, zIndex:10,
          display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
          boxShadow:'0 2px 8px rgba(0,0,0,.5)',
        }}>
          <button onClick={goBack} style={{
            padding:'9px 20px', background:'#4a5568', color:'#e2e8f0',
            border:'none', borderRadius:'4px', fontWeight:600, cursor:'pointer', fontSize:'.88rem',
          }}>
            &larr; Modifica Dati
          </button>
          <button onClick={generaPDF} disabled={generating} style={{
            padding:'9px 24px', background:`rgb(${NAVY})`, color:'#fff',
            border:'none', borderRadius:'4px', fontWeight:700,
            cursor: generating ? 'wait' : 'pointer', fontSize:'.88rem',
            opacity: generating ? .65 : 1,
          }}>
            {generating ? 'Generazione in corso...' : 'Scarica PDF Definitivo'}
          </button>
        </div>

        {/* Foglio A4 simulato */}
        <div style={{
          background:'white', width:'210mm', margin:'24px auto',
          padding:'22mm 20mm', boxShadow:'0 0 24px rgba(0,0,0,.6)',
          fontFamily:'Arial, sans-serif', fontSize:'10pt', lineHeight:'1.55', color:'#111',
        }}>

          {/* Intestazione istituzione */}
          <div style={{ marginBottom:'8px' }}>
            <div style={{ fontWeight:'bold', color:`rgb(${NAVY})`, fontSize:'11pt' }}>
              {fd['in-scuola-nome'] || 'Istituzione scolastica'}
            </div>
            {fd['in-scuola-codice'] && (
              <div style={{ fontSize:'9pt', color:'#555' }}>Cod. Mecc.: {fd['in-scuola-codice']}</div>
            )}
            {fd['in-scuola-indirizzo'] && (
              <div style={{ fontSize:'9pt', color:'#555' }}>{fd['in-scuola-indirizzo']}</div>
            )}
          </div>
          <hr style={{ border:'none', borderTop:`2px solid rgb(${NAVY})`, margin:'8px 0 16px' }} />

          {/* Titolo */}
          <h1 style={{ color:`rgb(${BDX})`, textAlign:'center', fontSize:'15pt', fontWeight:'bold', margin:'0 0 6px', letterSpacing:'.03em' }}>
            PROGETTO DIDATTICO EDUCATIVO SVOLTO
          </h1>
          <p style={{ textAlign:'center', color:`rgb(${NAVY})`, fontSize:'9pt', margin:'0 0 24px' }}>
            Istruzione Parentale &mdash; Rendiconto delle attivit&agrave; formative svolte
          </p>

          {/* Dati alunno */}
          <div style={{ marginBottom:'22px' }}>
            <h3 style={secH(`rgb(${NAVY})`)}>Dati dell&apos;Alunno / Alunna</h3>
            <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'9.5pt' }}>
              <tbody>
                {[
                  ['STUDENTE',       (fd['in-alunno-nome'] || '').toUpperCase() || '-'],
                  fd['in-alunno-nascita']   ? ['DATA DI NASCITA', fd['in-alunno-nascita']]   : null,
                  fd['in-alunno-residenza'] ? ['RESIDENZA',       fd['in-alunno-residenza']] : null,
                  ['CLASSE',         `${fd['in-classe']} - ${fd['in-indirizzo-studio'] || '-'}`],
                  ['ANNO SCOLASTICO',fd['in-as'] || '-'],
                  fd['in-certificazioni']   ? ['CERTIFICAZIONI',  fd['in-certificazioni']]   : null,
                ].filter(Boolean).map(([l, v]) => (
                  <tr key={l}>
                    <td style={{ fontWeight:'bold', width:'175px', paddingBottom:'5px', color:'#555', verticalAlign:'top', fontSize:'8.5pt' }}>{l}</td>
                    <td style={{ paddingBottom:'5px' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Percorsi di Studio */}
          {studi.length > 0 && (
            <div style={{ marginBottom:'24px' }}>
              <h3 style={secH(`rgb(${NAVY})`)}>Percorsi di Studio</h3>
              {Object.entries(perMat).map(([mat, voci]) => (
                <div key={mat} style={{ marginBottom:'16px' }}>
                  <div style={{ background:'#ebf2ff', borderLeft:`4px solid rgb(${NAVY})`, padding:'6px 12px', marginBottom:'4px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontWeight:'bold', color:`rgb(${NAVY})`, fontSize:'10pt' }}>{mat}</span>
                    <span style={{ fontSize:'8pt', color:'#556' }}>{voci.length} {voci.length === 1 ? 'sessione' : 'sessioni'}</span>
                  </div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9pt' }}>
                    <tbody>
                      {voci.map((a, i) => (
                        <tr key={a.id} style={{ background: i % 2 === 0 ? '#f8fafc' : '#fff' }}>
                          <td style={tdDate(`rgb(${NAVY})`)}>{fmtDate(a.data_ora)}</td>
                          <td style={tdContent}>
                            <div>{a.d?.argomento || '-'}</div>
                            {a.d?.dettagli && <div style={{ fontSize:'8pt', color:'#666', fontStyle:'italic', marginTop:'2px' }}>{a.d.dettagli}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}

          {/* UDA */}
          {udaAtt.length > 0 && (
            <div style={{ marginBottom:'24px' }}>
              <h3 style={secH(`rgb(${TEAL})`)}>Unit&agrave; di Apprendimento Svolte</h3>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9pt' }}>
                <tbody>
                  {udaAtt.map((a, i) => (
                    <tr key={a.id} style={{ background: i % 2 === 0 ? '#edfaf5' : '#fff' }}>
                      <td style={tdDate(`rgb(${TEAL})`)}>{fmtDate(a.data_ora)}</td>
                      <td style={tdContent}>
                        <div style={{ fontWeight:'600' }}>{a.d?.titolo_uda || '-'}</div>
                        {a.d?.descrizione_attivita && <div style={{ fontSize:'8pt', color:'#666', fontStyle:'italic', marginTop:'2px' }}>{a.d.descrizione_attivita}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Extrascolastica */}
          {extra.length > 0 && (
            <div style={{ marginBottom:'24px' }}>
              <h3 style={secH('#6424d2')}>Attivit&agrave; Formative Esterne</h3>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'9pt' }}>
                <tbody>
                  {extra.map((a, i) => (
                    <tr key={a.id} style={{ background: i % 2 === 0 ? '#f5eeff' : '#fff' }}>
                      <td style={tdDate('#6424d2')}>{fmtDate(a.data_ora)}</td>
                      <td style={tdContent}>
                        <div style={{ fontWeight:'600' }}>{a.d?.titolo_attivita || '-'}</div>
                        {a.d?.descrizione_attivita && <div style={{ fontSize:'8pt', color:'#666', fontStyle:'italic', marginTop:'2px' }}>{a.d.descrizione_attivita}</div>}
                        {a.d?.competenze?.length > 0 && (
                          <div style={{ fontSize:'7.5pt', color:'#6424d2', marginTop:'3px' }}>
                            <strong>Competenze sviluppate:</strong> {a.d.competenze.join('  -  ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Allegati UDA */}
          {udaList.length > 0 && (
            <div>
              <h3 style={secH(`rgb(${BDX})`)}>
                Allegati &mdash; Unit&agrave; di Apprendimento ({udaList.length})
              </h3>
              {udaList.map((u, i) => (
                <div key={u.id} style={{ border:`1px solid rgb(${NAVY})`, borderLeft:`4px solid rgb(${NAVY})`, borderRadius:'3px', padding:'14px', marginBottom:'12px', background:'#fafbff' }}>
                  <div style={{ fontWeight:'bold', color:`rgb(${NAVY})`, fontSize:'10pt', marginBottom:'4px' }}>
                    Allegato {i + 1} &mdash; {u.titolo}
                  </div>
                  <div style={{ fontSize:'8pt', color:'#666', marginBottom:'8px' }}>
                    {TIPO_SCUOLA_LABEL[u.tipo_scuola] || u.tipo_scuola} &nbsp;&middot;&nbsp;
                    Stato: {u.stato} &nbsp;&middot;&nbsp;
                    {u.created_at && new Date(u.created_at).toLocaleDateString('it-IT')}
                  </div>
                  {u.html_generato ? (
                    <div style={{ background:'#fff', border:'1px solid #dde', borderRadius:'3px', padding:'10px', maxHeight:'200px', overflow:'auto', fontSize:'8pt' }}
                      dangerouslySetInnerHTML={{ __html: u.html_generato }} />
                  ) : u.dati_compilazione ? (
                    <div style={{ background:'#fff', border:'1px solid #dde', borderRadius:'3px', padding:'10px', maxHeight:'200px', overflow:'auto', fontSize:'8pt' }}
                      dangerouslySetInnerHTML={{ __html: formattaUdaHtml(u.dati_compilazione) }} />
                  ) : (
                    <p style={{ fontStyle:'italic', color:'#999', fontSize:'8pt', margin:0 }}>Nessun contenuto disponibile.</p>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>{/* fine A4 */}
      </div>
    );
  }

  // ── FORM (step 0-2) ───────────────────────────────────────────────────────
  const STEPS = ['Informativa', 'Dati Scuola', "Dati Alunno"];

  return (
    <div style={S.page}>
      <div style={S.wrap}>

        {/* Header */}
        <div style={{ ...S.card, padding:'18px 26px', marginBottom:'18px', borderLeft:`5px solid rgb(${BDX})` }}>
          <h1 style={{ fontSize:'1.1rem', fontWeight:700, color:`rgb(${BDX})`, margin:0, letterSpacing:'.03em' }}>
            Progetto Didattico Educativo Svolto
          </h1>
          <p style={{ margin:'4px 0 0', fontSize:'.82rem', color:'#64748b' }}>
            Documento ufficiale &mdash; Istruzione Parentale
          </p>
        </div>

        {/* Progress */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'22px' }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ flex:1, textAlign:'center' }}>
              <div style={{ height:'4px', borderRadius:'3px', background: i <= step ? `rgb(${BDX})` : '#cbd5e1', marginBottom:'4px', transition:'background .3s' }} />
              <span style={{ fontSize:'.7rem', fontWeight: i === step ? 700 : 400, color: i === step ? `rgb(${BDX})` : '#94a3b8' }}>{s}</span>
            </div>
          ))}
        </div>

        {/* Step 0: Informativa */}
        {step === 0 && (
          <div style={S.card}>
            <h2 style={S.h2}>Informativa</h2>
            <p style={{ color:'#475569', lineHeight:'1.75', marginBottom:'16px', fontSize:'.95rem' }}>
              Questo strumento genera il <strong>Progetto Didattico Educativo Svolto</strong>,
              il documento che raccoglie tutte le attivit&agrave; formative
              svolte nell&apos;ambito dell&apos;istruzione parentale nell&apos;anno scolastico di riferimento.
            </p>
            <div style={S.notice('#fef9c3','#fde047','#78350f')}>
              <strong>Nota sul salvataggio:</strong> i dati inseriti nei prossimi step (scuola e alunno)
              non vengono salvati nel database e dovranno essere reinseriti ad ogni generazione.
            </div>
            <div style={S.notice('#eff6ff','#bfdbfe','#1e40af')}>
              <strong>Il documento include:</strong>
              <ul style={{ margin:'6px 0 0 16px', lineHeight:'2', fontSize:'.88rem' }}>
                <li>Intestazione istituzionale e dati dell&apos;alunno/a</li>
                <li>Dettaglio dei percorsi di studio per disciplina</li>
                <li>Dettaglio delle Unit&agrave; di Apprendimento svolte</li>
                <li>Dettaglio delle attivit&agrave; formative esterne</li>
                <li>Unit&agrave; di Apprendimento complete come allegati</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 1: Dati Scuola — identico ad App.jsx */}
        {step === 1 && (
          <div style={S.card}>
            <h2 style={S.h2}>Informazioni sull&apos;Istituzione</h2>

            <label style={S.label} htmlFor="in-scuola-nome">Nome della Scuola *</label>
            <input style={S.input} type="text" id="in-scuola-nome"
              value={fd['in-scuola-nome']} onChange={ch}
              placeholder="es. Istituto Comprensivo Statale 'Giuseppe Verdi'" />

            <label style={S.label} htmlFor="in-scuola-codice">Codice Meccanografico *</label>
            <input style={S.input} type="text" id="in-scuola-codice"
              value={fd['in-scuola-codice']} onChange={ch}
              placeholder="es. RMIC8XXXXX" />

            <label style={S.label} htmlFor="in-scuola-indirizzo">Indirizzo Scuola</label>
            <input style={S.input} type="text" id="in-scuola-indirizzo"
              value={fd['in-scuola-indirizzo']} onChange={ch}
              placeholder="Via Roma 1, 00100 Roma (RM)" />
          </div>
        )}

        {/* Step 2: Dati Alunno — identico ad App.jsx */}
        {step === 2 && (
          <div style={S.card}>
            <h2 style={S.h2}>Dati dell&apos;Alunno/a</h2>

            <label style={S.label} htmlFor="in-alunno-nome">Cognome e Nome *</label>
            <input style={S.input} type="text" id="in-alunno-nome"
              value={fd['in-alunno-nome']} onChange={ch}
              placeholder="Rossi Mario" />

            <div style={S.grid2}>
              <div>
                <label style={S.label} htmlFor="in-alunno-nascita">Data di Nascita *</label>
                <input style={S.input} type="text" id="in-alunno-nascita"
                  value={fd['in-alunno-nascita']} onChange={ch}
                  placeholder="01/01/2010" />
              </div>
              <div>
                <label style={S.label} htmlFor="in-as">Anno Scolastico *</label>
                <input style={S.input} type="text" id="in-as"
                  value={fd['in-as']} onChange={ch}
                  placeholder="2025/26" />
              </div>
            </div>

            <label style={S.label} htmlFor="in-alunno-residenza">Residenza *</label>
            <input style={S.input} type="text" id="in-alunno-residenza"
              value={fd['in-alunno-residenza']} onChange={ch}
              placeholder="Via Garibaldi 10, 00100 Roma (RM)" />

            <div style={S.grid2}>
              <div>
                <label style={S.label} htmlFor="in-classe">Classe *</label>
                <select style={S.select} id="in-classe"
                  value={fd['in-classe']} onChange={ch}>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>
              <div>
                <label style={S.label} htmlFor="in-indirizzo-studio">Indirizzo di Studio *</label>
                <input style={S.input} type="text" id="in-indirizzo-studio"
                  value={fd['in-indirizzo-studio']} onChange={ch}
                  placeholder="es. Scuola Secondaria di I Grado" />
              </div>
            </div>

            <label style={S.label} htmlFor="in-certificazioni">
              Eventuali Certificazioni (DSA, L.104, BES, ecc.)
            </label>
            <input style={S.input} type="text" id="in-certificazioni"
              value={fd['in-certificazioni']} onChange={ch}
              placeholder="es. DSA - Dislessia (L.170/2010)" />
          </div>
        )}

        {/* Navigazione */}
        <div style={{ display:'flex', gap:'12px', marginTop:'4px' }}>
          <button style={{ ...S.btnGhost, opacity: step === 0 ? .45 : 1 }} onClick={goBack} disabled={step === 0}>
            &larr; Indietro
          </button>
          <button style={{ ...S.btnPrimary, flex:1 }} onClick={goNext}>
            {step === 0 ? 'Inizia' : step === 2 ? "Vai all'Anteprima \u2192" : 'Continua \u2192'}
          </button>
        </div>

      </div>
    </div>
  );
}