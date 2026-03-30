import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

function App() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [materie, setMaterie] = useState([]);
  const [userId, setUserId] = useState(null);
  const [indLogico, setIndLogico] = useState(null);
  const [classeUtente, setClasseUtente] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [formData, setFormData] = useState({
    'in-scuola-nome': '',
    'in-scuola-codice': '',
    'in-scuola-indirizzo': '',
    'in-alunno-nome': '',
    'in-alunno-nascita': '',
    'in-as': '2026/27',
    'in-alunno-residenza': '',
    'in-classe': '1',
    'in-indirizzo-studio': '',
    'in-certificazioni': '',
    'in-percorso': '',
    'in-metodo': '',
    'in-ambiente': '',
    'in-verifiche': '',
    'in-valutazione': ''
  });

  // Array per attività extracurricolari
  const [attivitaExtra, setAttivitaExtra] = useState([
    { tipo: '', obiettivi: '' }
  ]);

  // Array per UDA selezionate
  const [udaDisponibili, setUdaDisponibili] = useState([]);
  const [udaSelezionate, setUdaSelezionate] = useState([]);

  // Carica dati utente (ind_logico e classe)
  useEffect(() => {
    const caricaDatiUtente = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error("Utente non autenticato");
          setLoadingUser(false);
          return;
        }

        setUserId(user.id);

        const { data: profilo, error } = await supabase
          .from('profili_utenti')
          .select('id_logico, classe')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        setIndLogico(profilo.id_logico);
        setClasseUtente(profilo.classe);
        
        // Aggiorna formData con la classe
        setFormData(prev => ({ ...prev, 'in-classe': profilo.classe?.toString() || '1' }));

        console.log("Dati utente caricati:", profilo);

        // Carica progettazione salvata
        try {
          const { data: progData, error: progError } = await supabase
            .from('programmi_didattici')
            .select('dati')
            .eq('utente_id', user.id)
            .single();

          if (progError && progError.code !== 'PGRST116') throw progError;
          
          if (progData?.dati) {
            const dati = progData.dati;
            
            // Quadro formativo
            if (dati.quadro_formativo) {
              setFormData(prev => ({
                ...prev,
                'in-percorso': dati.quadro_formativo.percorso || '',
                'in-metodo': dati.quadro_formativo.metodo || '',
                'in-ambiente': dati.quadro_formativo.ambiente || '',
                'in-verifiche': dati.quadro_formativo.verifiche || '',
                'in-valutazione': dati.quadro_formativo.valutazione || ''
              }));
            }

            // Attività extra
            if (dati.attivita_extra && dati.attivita_extra.length > 0) {
              setAttivitaExtra(dati.attivita_extra);
            }

            // UDA selezionate
            if (dati.uda_selezionate) {
              setUdaSelezionate(dati.uda_selezionate);
            }

            console.log("Progettazione caricata dal DB");
          }
        } catch (progErr) {
          console.error("Errore caricamento progettazione:", progErr);
        }

      } catch (err) {
        console.error("Errore caricamento dati utente:", err);
      } finally {
        setLoadingUser(false);
      }
    };

    caricaDatiUtente();
  }, []);

  const titles = [
    "Informativa", 
    "Dati Scuola", 
    "Dati Alunno", 
    "Quadro Formativo Generale", 
    "Programmazione delle Discipline",
    "Attività Extracurricolari",
    "UDA Associate"
  ];
  
  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const initMaterieDB = async () => {
    if (!indLogico || !classeUtente) {
      console.error("Dati utente non disponibili");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('programmi_didattici_base')
        .select('*')
        .eq('ind_logico', indLogico)
        .eq('classe', classeUtente);

      if (error) throw error;
      
      const formatted = data.map(m => {
        let args = [];
        if (m.programma_json) {
          m.programma_json.forEach(cat => { if (cat.argomenti) args = [...args, ...cat.argomenti]; });
        }
        return { 
          ...m, 
          // Campi vuoti inizialmente
          obiettivi: '', 
          competenze: '', 
          argomentiStr: '', 
          verifiche: '',
          // Salviamo i dati standard per il pulsante "Carica Standard"
          obiettivi_standard: m.obiettivi_materia || '',
          competenze_standard: m.competenze_materia || '',
          argomenti_standard: args.join(', ')
        };
      });
      setMaterie(formatted);
      console.log("Materie caricate:", formatted.length);
    } catch (err) {
      console.error("Errore DB:", err);
    } finally {
      setLoading(false);
    }
  };

  const moveStep = async (n) => {
    if (n === 1 && step === 3) {
      await initMaterieDB(); 
    }
    
    if (n === 1 && step === 5) {
      await caricaUDA();
    }
    
    if (n === 1 && step === 6) {
      // Salva automaticamente (silenzioso) prima di andare all'anteprima
      await salvaProgettazione(true);
      setShowPreview(true); 
      return; 
    }
    setStep(prev => prev + n);
  };

  // Carica UDA dell'utente
  const caricaUDA = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('uda_documenti')
        .select('id, titolo, html_generato, dati_compilazione')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setUdaDisponibili(data || []);
      console.log("UDA caricate:", data?.length || 0);
    } catch (err) {
      console.error("Errore caricamento UDA:", err);
    } finally {
      setLoading(false);
    }
  };

  // Salva progettazione in DB
  const salvaProgettazione = async (silenzioso = false) => {
    if (!userId) {
      if (!silenzioso) alert("Errore: utente non identificato");
      return;
    }

    try {
      const datiProgettazione = {
        quadro_formativo: {
          percorso: formData['in-percorso'],
          metodo: formData['in-metodo'],
          ambiente: formData['in-ambiente'],
          verifiche: formData['in-verifiche'],
          valutazione: formData['in-valutazione']
        },
        discipline: materie.map(m => ({
          materia: m.materia,
          obiettivi: m.obiettivi,
          competenze: m.competenze,
          argomenti: m.argomentiStr,
          verifiche: m.verifiche
        })),
        attivita_extra: attivitaExtra,
        uda_selezionate: udaSelezionate
      };

      const { error } = await supabase
        .from('programmi_didattici')
        .upsert({ 
          utente_id: userId, 
          dati: datiProgettazione 
        }, {
          onConflict: 'utente_id'
        });

      if (error) throw error;

      if (!silenzioso) {
        alert("✅ Progettazione salvata con successo!\n\n💡 Ricorda: i dati personali (scuola, alunno) NON sono stati salvati e dovrai reinserirli se ricarichi la pagina.");
      }
      console.log("Dati salvati:", datiProgettazione);
    } catch (err) {
      console.error("Errore salvataggio:", err);
      if (!silenzioso) {
        alert("❌ Errore durante il salvataggio: " + err.message);
      }
    }
  };

  // Gestione attività extracurricolari
  const aggiungiAttivita = () => {
    setAttivitaExtra([...attivitaExtra, { tipo: '', obiettivi: '' }]);
  };

  const rimuoviAttivita = (index) => {
    if (attivitaExtra.length > 1) {
      const nuoveAttivita = attivitaExtra.filter((_, i) => i !== index);
      setAttivitaExtra(nuoveAttivita);
    }
  };

  const updateAttivita = (index, field, value) => {
    const nuoveAttivita = [...attivitaExtra];
    nuoveAttivita[index][field] = value;
    setAttivitaExtra(nuoveAttivita);
  };

  const updateMateria = (index, field, value) => {
    const nuoveMaterie = [...materie];
    nuoveMaterie[index][field] = value;
    setMaterie(nuoveMaterie);
  };

  // Formatta i dati UDA per il PDF
  const formattaDatiUDA = (datiCompilazione) => {
    if (!datiCompilazione) return '';
    
    const dati = typeof datiCompilazione === 'string' 
      ? JSON.parse(datiCompilazione) 
      : datiCompilazione;
    
    let testoFormattato = '';
    
    // Campi da mostrare in ordine
    const campiDaMostrare = [
      { chiave: 'titolo', nome: 'TITOLO' },
      { chiave: 'materie', nome: 'MATERIE' },
      { chiave: 'processi', nome: 'PROCESSI' },
      { chiave: 'prodotto_finale', nome: 'PRODOTTO FINALE' },
      { chiave: 'competenze_europee', nome: 'COMPETENZE EUROPEE' }
    ];
    
    campiDaMostrare.forEach(({ chiave, nome }) => {
      const valore = dati[chiave];
      
      if (!valore) return;
      
      testoFormattato += `\n${nome}\n`;
      
      if (typeof valore === 'string' && valore.trim()) {
        testoFormattato += `${valore}\n`;
      } else if (Array.isArray(valore) && valore.length > 0) {
        valore.forEach((item, i) => {
          if (typeof item === 'string') {
            testoFormattato += `• ${item}\n`;
          } else if (typeof item === 'object' && item !== null) {
            // Se è un oggetto, prova a estrarre il contenuto
            const contenuto = item.testo || item.nome || item.descrizione || JSON.stringify(item);
            testoFormattato += `• ${contenuto}\n`;
          }
        });
      } else if (typeof valore === 'object' && !Array.isArray(valore) && valore !== null) {
        Object.entries(valore).forEach(([k, v]) => {
          testoFormattato += `• ${k}: ${v}\n`;
        });
      }
    });
    
    return testoFormattato;
  };

  const generaPDF = () => {
    try {
      console.log("=== INIZIO GENERAZIONE PDF ===");
      console.log("FormData completo:", formData);
      console.log("Numero materie:", materie.length);
      console.log("Attività extra:", attivitaExtra);

      const doc = new jsPDF('p', 'mm', 'a4');
      const bordeaux = [128, 0, 32];
      const navy = [30, 58, 138];
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const marginLeft = 15;
      const marginRight = 15;
      const maxWidth = pageWidth - marginLeft - marginRight;

      let y = 20;

      const safeText = (value, fallback = '---') => {
        const text = String(value || fallback);
        return text;
      };

      const checkPageBreak = (neededSpace) => {
        if (y + neededSpace > pageHeight - 25) {
          console.log("Nuova pagina necessaria a y:", y);
          doc.addPage();
          y = 20;
          return true;
        }
        return false;
      };

      // ==================== INTESTAZIONE ====================
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(navy[0], navy[1], navy[2]);
      
      const scuolaNome = safeText(formData['in-scuola-nome'], 'Nome scuola non inserito');
      const scuolaCodice = safeText(formData['in-scuola-codice'], 'Codice non inserito');
      
      doc.text(`Istituzione: ${scuolaNome}`, marginLeft, y);
      y += 7;
      doc.text(`Cod. Mecc: ${scuolaCodice}`, marginLeft, y);
      y += 6;
      
      doc.setLineWidth(0.5);
      doc.setDrawColor(navy[0], navy[1], navy[2]);
      doc.line(marginLeft, y, pageWidth - marginRight, y);
      y += 12;

      // ==================== TITOLO ====================
      doc.setFontSize(16);
      doc.setTextColor(bordeaux[0], bordeaux[1], bordeaux[2]);
      doc.text("PROGETTAZIONE DIDATTICA INIZIALE", pageWidth / 2, y, { align: "center" });
      y += 15;

      // ==================== DATI ALUNNO ====================
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text("DATI DELL'ALUNNO/A", marginLeft, y);
      y += 8;
      
      doc.setFontSize(10);
      const alunnoNome = safeText(formData['in-alunno-nome'], 'Nome non inserito').toUpperCase();
      
      doc.setFont("helvetica", "bold");
      doc.text("STUDENTE:", marginLeft, y);
      doc.setFont("helvetica", "normal");
      doc.text(alunnoNome, marginLeft + 35, y);
      y += 6;
      
      doc.setFont("helvetica", "bold");
      doc.text("DATA NASCITA:", marginLeft, y);
      doc.setFont("helvetica", "normal");
      doc.text(safeText(formData['in-alunno-nascita']), marginLeft + 35, y);
      y += 6;
      
      doc.setFont("helvetica", "bold");
      doc.text("RESIDENZA:", marginLeft, y);
      doc.setFont("helvetica", "normal");
      const residenzaText = safeText(formData['in-alunno-residenza']);
      const residenzaLines = doc.splitTextToSize(residenzaText, maxWidth - 35);
      doc.text(residenzaLines, marginLeft + 35, y);
      y += Math.max(6, residenzaLines.length * 5);
      
      doc.setFont("helvetica", "bold");
      doc.text("CLASSE:", marginLeft, y);
      doc.setFont("helvetica", "normal");
      const classeText = `${safeText(formData['in-classe'])} - ${safeText(formData['in-indirizzo-studio'])}`;
      doc.text(classeText, marginLeft + 35, y);
      y += 6;
      
      doc.setFont("helvetica", "bold");
      doc.text("A.S.:", marginLeft, y);
      doc.setFont("helvetica", "normal");
      doc.text(safeText(formData['in-as']), marginLeft + 35, y);
      y += 6;

      if (formData['in-certificazioni'] && formData['in-certificazioni'].trim()) {
        doc.setFont("helvetica", "bold");
        doc.text("CERTIFICAZIONI:", marginLeft, y);
        doc.setFont("helvetica", "normal");
        const certLines = doc.splitTextToSize(safeText(formData['in-certificazioni']), maxWidth - 35);
        doc.text(certLines, marginLeft + 35, y);
        y += Math.max(6, certLines.length * 5);
      }

      y += 10;
      checkPageBreak(50);

      // ==================== QUADRO FORMATIVO ====================
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(bordeaux[0], bordeaux[1], bordeaux[2]);
      doc.text("QUADRO FORMATIVO GENERALE", marginLeft, y);
      y += 10;

      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Percorso Formativo:", marginLeft, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const percorsoText = safeText(formData['in-percorso']);
      const percorsoLines = doc.splitTextToSize(percorsoText, maxWidth);
      doc.text(percorsoLines, marginLeft, y);
      y += percorsoLines.length * 5 + 5;
      
      checkPageBreak(40);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Metodologia:", marginLeft, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const metodoText = safeText(formData['in-metodo']);
      const metodoLines = doc.splitTextToSize(metodoText, maxWidth);
      doc.text(metodoLines, marginLeft, y);
      y += metodoLines.length * 5 + 5;

      checkPageBreak(40);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Ambiente di Apprendimento:", marginLeft, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const ambienteText = safeText(formData['in-ambiente']);
      const ambienteLines = doc.splitTextToSize(ambienteText, maxWidth);
      doc.text(ambienteLines, marginLeft, y);
      y += ambienteLines.length * 5 + 5;

      checkPageBreak(40);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Modalità di Verifica:", marginLeft, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const verificheText = safeText(formData['in-verifiche']);
      const verificheLines = doc.splitTextToSize(verificheText, maxWidth);
      doc.text(verificheLines, marginLeft, y);
      y += verificheLines.length * 5 + 5;

      checkPageBreak(40);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Modalità di Valutazione:", marginLeft, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const valutazioneText = safeText(formData['in-valutazione']);
      const valutazioneLines = doc.splitTextToSize(valutazioneText, maxWidth);
      doc.text(valutazioneLines, marginLeft, y);
      y += valutazioneLines.length * 5 + 12;

      // ==================== PROGRAMMAZIONE DISCIPLINE ====================
      checkPageBreak(50);
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(bordeaux[0], bordeaux[1], bordeaux[2]);
      doc.text("PROGRAMMAZIONE DELLE DISCIPLINE", marginLeft, y);
      y += 10;

      if (materie.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("Nessuna disciplina configurata", marginLeft, y);
        y += 10;
      } else {
        materie.forEach((materia, index) => {
          checkPageBreak(60);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(navy[0], navy[1], navy[2]);
          doc.text(`${index + 1}. ${safeText(materia.materia, 'Materia')}`, marginLeft, y);
          y += 8;

          doc.setTextColor(0, 0, 0);
          doc.setFontSize(9);

          if (materia.obiettivi && materia.obiettivi.trim()) {
            doc.setFont("helvetica", "bold");
            doc.text("Obiettivi:", marginLeft + 3, y);
            y += 5;
            doc.setFont("helvetica", "normal");
            const obiettiviLines = doc.splitTextToSize(safeText(materia.obiettivi), maxWidth - 6);
            doc.text(obiettiviLines, marginLeft + 3, y);
            y += obiettiviLines.length * 4 + 4;
            checkPageBreak(30);
          }

          if (materia.competenze && materia.competenze.trim()) {
            doc.setFont("helvetica", "bold");
            doc.text("Competenze:", marginLeft + 3, y);
            y += 5;
            doc.setFont("helvetica", "normal");
            const competenzeLines = doc.splitTextToSize(safeText(materia.competenze), maxWidth - 6);
            doc.text(competenzeLines, marginLeft + 3, y);
            y += competenzeLines.length * 4 + 4;
            checkPageBreak(30);
          }

          if (materia.argomentiStr && materia.argomentiStr.trim()) {
            doc.setFont("helvetica", "bold");
            doc.text("Argomenti:", marginLeft + 3, y);
            y += 5;
            doc.setFont("helvetica", "normal");
            const argomentiLines = doc.splitTextToSize(safeText(materia.argomentiStr), maxWidth - 6);
            doc.text(argomentiLines, marginLeft + 3, y);
            y += argomentiLines.length * 4 + 4;
            checkPageBreak(25);
          }

          if (materia.verifiche) {
            doc.setFont("helvetica", "bold");
            doc.text("N. Verifiche previste:", marginLeft + 3, y);
            doc.setFont("helvetica", "normal");
            doc.text(safeText(materia.verifiche), marginLeft + 50, y);
            y += 6;
          }

          y += 6;
        });
      }

      // ==================== ATTIVITÀ EXTRACURRICOLARI ====================
      const attivitaCompilate = attivitaExtra.filter(a => a.tipo.trim() || a.obiettivi.trim());
      
      if (attivitaCompilate.length > 0) {
        checkPageBreak(50);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(bordeaux[0], bordeaux[1], bordeaux[2]);
        doc.text("ATTIVITÀ EXTRACURRICOLARI", marginLeft, y);
        y += 10;

        attivitaCompilate.forEach((attivita, index) => {
          checkPageBreak(40);

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(navy[0], navy[1], navy[2]);
          doc.text(`${index + 1}. ${safeText(attivita.tipo, 'Attività')}`, marginLeft, y);
          y += 8;

          doc.setTextColor(0, 0, 0);
          doc.setFontSize(9);

          if (attivita.obiettivi && attivita.obiettivi.trim()) {
            doc.setFont("helvetica", "bold");
            doc.text("Obiettivi:", marginLeft + 3, y);
            y += 5;
            doc.setFont("helvetica", "normal");
            const obiettiviLines = doc.splitTextToSize(safeText(attivita.obiettivi), maxWidth - 6);
            doc.text(obiettiviLines, marginLeft + 3, y);
            y += obiettiviLines.length * 4 + 4;
          }

          y += 6;
        });
      }

      // ==================== UDA ASSOCIATE ====================
      if (udaSelezionate.length > 0) {
        checkPageBreak(50);
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(bordeaux[0], bordeaux[1], bordeaux[2]);
        doc.text("UDA ASSOCIATE", marginLeft, y);
        y += 10;

        console.log("UDA selezionate da includere:", udaSelezionate.length);

        // Recupera i dettagli delle UDA selezionate
        const udaDettagliate = udaDisponibili.filter(uda => udaSelezionate.includes(uda.id));

        udaDettagliate.forEach((uda, index) => {
          checkPageBreak(40);

          // Titolo UDA
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(navy[0], navy[1], navy[2]);
          doc.text(`${index + 1}. ${safeText(uda.titolo, 'UDA')}`, marginLeft, y);
          y += 10;

          // Contenuto dell'UDA
          if (uda.html_generato) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            
            // Estrai testo dall'HTML (rimuovi tag)
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = uda.html_generato;
            const testoUDA = tempDiv.textContent || tempDiv.innerText || '';
            
            // Dividi il testo in righe che si adattano alla pagina
            const righeUDA = doc.splitTextToSize(testoUDA.substring(0, 5000), maxWidth - 6);
            
            // Aggiungi le righe con controllo paginazione
            righeUDA.forEach((riga) => {
              if (y > pageHeight - 30) {
                doc.addPage();
                y = 20;
              }
              doc.text(riga, marginLeft + 3, y);
              y += 4;
            });

            y += 8;
          } else if (uda.dati_compilazione) {
            // Usa la funzione di formattazione
            const testoFormattato = formattaDatiUDA(uda.dati_compilazione);
            
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            
            // Dividi il testo in righe
            const righeUDA = doc.splitTextToSize(testoFormattato, maxWidth - 6);
            
            // Aggiungi le righe con controllo paginazione
            righeUDA.forEach((riga) => {
              if (y > pageHeight - 30) {
                doc.addPage();
                y = 20;
              }
              
              // Se la riga è un titolo (MAIUSCOLO), rendila bold
              if (riga === riga.toUpperCase() && riga.trim().length > 0 && !riga.match(/^\d/)) {
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text(riga, marginLeft + 3, y);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(9);
              } else {
                doc.text(riga, marginLeft + 3, y);
              }
              
              y += 4.5;
            });

            y += 8;
          } else {
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(100, 100, 100);
            doc.text("Contenuto UDA non disponibile", marginLeft + 3, y);
            y += 10;
          }

          // Separatore tra UDA
          if (index < udaDettagliate.length - 1) {
            checkPageBreak(10);
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.line(marginLeft, y, pageWidth - marginRight, y);
            y += 10;
          }
        });

        y += 10;
      }

      console.log("PDF completato, salvataggio in corso...");
      
      const nomeFile = formData['in-alunno-nome'] 
        ? formData['in-alunno-nome'].replace(/\s+/g, '_') 
        : 'Progetto_Didattico';
      
      const fileName = `${nomeFile}_${formData['in-as'].replace('/', '-')}.pdf`;
      doc.save(fileName);
      console.log("=== PDF SALVATO CORRETTAMENTE:", fileName, "===");
      
      alert(`PDF generato con successo!\n\nFile: ${fileName}\n\nMaterie incluse: ${materie.length}\nAttività extracurricolari: ${attivitaCompilate.length}\nUDA associate: ${udaSelezionate.length}`);
      
    } catch (error) {
      console.error("=== ERRORE GENERAZIONE PDF ===");
      console.error("Messaggio:", error.message);
      console.error("Stack:", error.stack);
      alert(`Errore nella generazione del PDF:\n${error.message}\n\nControlla la console per dettagli.`);
    }
  };

  // VISTA ANTEPRIMA
  if (showPreview) {
    const attivitaCompilate = attivitaExtra.filter(a => a.tipo.trim() || a.obiettivi.trim());
    
    return (
      <div id="preview-wrap" style={{display: 'block', background: '#525659', minHeight: '100vh', padding: '20px 0'}}>
        <div className="toolbar" style={{background:'#334155', padding:'15px', textAlign:'center', position:'sticky', top:0, zIndex:10}}>
          <button className="btn-nav" onClick={() => setShowPreview(false)} style={{marginRight:'10px'}}>← Modifica Dati</button>
          <button className="btn-nav btn-next" onClick={generaPDF} style={{background:'#1e3a8a', color:'white'}}>📥 Scarica PDF Definitivo</button>
        </div>
        
        <div className="page-a4" style={{background:'white', width:'210mm', margin:'20px auto', padding:'20mm', boxShadow:'0 0 10px rgba(0,0,0,0.5)', fontFamily:'Arial, sans-serif'}}>
          <h2 style={{color:'#800020', textAlign:'center', marginBottom:'20px'}}>ANTEPRIMA PROGETTAZIONE DIDATTICA</h2>
          <hr style={{border:'2px solid #1e3a8a', marginBottom:'20px'}}/>
          
          <div style={{marginBottom:'25px'}}>
            <h3 style={{color:'#1e3a8a', borderBottom:'2px solid #1e3a8a', paddingBottom:'5px'}}>Dati Istituzione</h3>
            <p><strong>Scuola:</strong> {formData['in-scuola-nome'] || '---'}</p>
            <p><strong>Codice Meccanografico:</strong> {formData['in-scuola-codice'] || '---'}</p>
            <p><strong>Indirizzo:</strong> {formData['in-scuola-indirizzo'] || '---'}</p>
          </div>
          
          <div style={{marginBottom:'25px'}}>
            <h3 style={{color:'#1e3a8a', borderBottom:'2px solid #1e3a8a', paddingBottom:'5px'}}>Dati Alunno</h3>
            <p><strong>Studente:</strong> {formData['in-alunno-nome'].toUpperCase() || '---'}</p>
            <p><strong>Data di Nascita:</strong> {formData['in-alunno-nascita'] || '---'}</p>
            <p><strong>Residenza:</strong> {formData['in-alunno-residenza'] || '---'}</p>
            <p><strong>Classe:</strong> {formData['in-classe']} - {formData['in-indirizzo-studio'] || '---'}</p>
            <p><strong>Anno Scolastico:</strong> {formData['in-as']}</p>
            {formData['in-certificazioni'] && (
              <p><strong>Certificazioni:</strong> {formData['in-certificazioni']}</p>
            )}
          </div>
          
          <div style={{marginBottom:'25px'}}>
            <h3 style={{color:'#1e3a8a', borderBottom:'2px solid #1e3a8a', paddingBottom:'5px'}}>Quadro Formativo Generale</h3>
            <div style={{marginBottom:'15px'}}>
              <p style={{fontWeight:'bold', marginBottom:'5px'}}>Percorso Formativo:</p>
              <p style={{fontSize:'0.9rem', lineHeight:'1.5'}}>{formData['in-percorso']}</p>
            </div>
            <div style={{marginBottom:'15px'}}>
              <p style={{fontWeight:'bold', marginBottom:'5px'}}>Metodologia:</p>
              <p style={{fontSize:'0.9rem', lineHeight:'1.5'}}>{formData['in-metodo']}</p>
            </div>
            <div style={{marginBottom:'15px'}}>
              <p style={{fontWeight:'bold', marginBottom:'5px'}}>Ambiente di Apprendimento:</p>
              <p style={{fontSize:'0.9rem', lineHeight:'1.5'}}>{formData['in-ambiente']}</p>
            </div>
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px'}}>
              <div>
                <p style={{fontWeight:'bold', marginBottom:'5px'}}>Verifiche:</p>
                <p style={{fontSize:'0.85rem'}}>{formData['in-verifiche']}</p>
              </div>
              <div>
                <p style={{fontWeight:'bold', marginBottom:'5px'}}>Valutazione:</p>
                <p style={{fontSize:'0.85rem'}}>{formData['in-valutazione']}</p>
              </div>
            </div>
          </div>
          
          <div style={{marginBottom:'25px'}}>
            <h3 style={{color:'#1e3a8a', borderBottom:'2px solid #1e3a8a', paddingBottom:'5px'}}>
              Programmazione Discipline ({materie.length})
            </h3>
            {materie.length === 0 ? (
              <p style={{fontStyle:'italic', color:'#666'}}>Nessuna disciplina configurata</p>
            ) : (
              <ul style={{listStyle:'none', padding:0}}>
                {materie.map((m, i) => (
                  <li key={i} style={{
                    border:'1px solid #ddd', 
                    padding:'15px', 
                    marginBottom:'12px', 
                    borderRadius:'8px',
                    background:'#f9f9f9'
                  }}>
                    <div style={{fontWeight:'bold', fontSize:'1.1rem', color:'#064e3b', marginBottom:'8px'}}>
                      {i + 1}. {m.materia}
                    </div>
                    <div style={{fontSize:'0.85rem', marginLeft:'15px'}}>
                      {m.obiettivi && (
                        <p><strong>Obiettivi:</strong> {m.obiettivi.substring(0, 100)}...</p>
                      )}
                      {m.competenze && (
                        <p><strong>Competenze:</strong> {m.competenze.substring(0, 100)}...</p>
                      )}
                      {m.argomentiStr && (
                        <p><strong>Argomenti:</strong> {m.argomentiStr.substring(0, 150)}...</p>
                      )}
                      {m.verifiche && (
                        <p><strong>Verifiche:</strong> {m.verifiche}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {attivitaCompilate.length > 0 && (
            <div>
              <h3 style={{color:'#1e3a8a', borderBottom:'2px solid #1e3a8a', paddingBottom:'5px'}}>
                Attività Extracurricolari ({attivitaCompilate.length})
              </h3>
              <ul style={{listStyle:'none', padding:0}}>
                {attivitaCompilate.map((att, i) => (
                  <li key={i} style={{
                    border:'1px solid #ddd', 
                    padding:'15px', 
                    marginBottom:'12px', 
                    borderRadius:'8px',
                    background:'#f0f9ff'
                  }}>
                    <div style={{fontWeight:'bold', fontSize:'1.1rem', color:'#1e3a8a', marginBottom:'8px'}}>
                      {i + 1}. {att.tipo || 'Attività'}
                    </div>
                    {att.obiettivi && (
                      <div style={{fontSize:'0.85rem', marginLeft:'15px'}}>
                        <p><strong>Obiettivi:</strong> {att.obiettivi}</p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {udaSelezionate.length > 0 && (
            <div style={{marginTop:'25px'}}>
              <h3 style={{color:'#1e3a8a', borderBottom:'2px solid #1e3a8a', paddingBottom:'5px'}}>
                UDA Associate ({udaSelezionate.length})
              </h3>
              <ul style={{listStyle:'none', padding:0}}>
                {udaDisponibili
                  .filter(uda => udaSelezionate.includes(uda.id))
                  .map((uda, i) => (
                  <li key={uda.id} style={{
                    border:'1px solid #ddd', 
                    padding:'15px', 
                    marginBottom:'12px', 
                    borderRadius:'8px',
                    background:'#f0fdf4'
                  }}>
                    <div style={{fontWeight:'bold', fontSize:'1.1rem', color:'#064e3b', marginBottom:'8px'}}>
                      {i + 1}. {uda.titolo}
                    </div>
                    <div style={{fontSize:'0.85rem', marginLeft:'15px', color:'#475569'}}>
                      {uda.html_generato ? (
                        <div style={{
                          marginTop:'10px',
                          padding:'10px',
                          background:'#ffffff',
                          borderRadius:'6px',
                          border:'1px solid #e5e7eb',
                          maxHeight:'200px',
                          overflow:'auto'
                        }}>
                          <div dangerouslySetInnerHTML={{__html: uda.html_generato.substring(0, 1000) + '...'}} />
                        </div>
                      ) : uda.dati_compilazione ? (
                        <div style={{
                          marginTop:'10px',
                          padding:'15px',
                          background:'#ffffff',
                          borderRadius:'6px',
                          border:'1px solid #e5e7eb',
                          maxHeight:'300px',
                          overflow:'auto'
                        }}>
                          <div dangerouslySetInnerHTML={{__html: formattaDatiUDA(uda.dati_compilazione).replace(/\n/g, '<br/>').replace(/  /g, '&nbsp;&nbsp;')}} />
                        </div>
                      ) : (
                        <p style={{fontStyle:'italic', color:'#9ca3af'}}>Nessun contenuto disponibile</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading iniziale
  if (loadingUser) {
    return (
      <div style={{
        display:'flex',
        justifyContent:'center',
        alignItems:'center',
        minHeight:'100vh',
        background:'#f8fafc'
      }}>
        <div style={{textAlign:'center'}}>
          <div style={{
            fontSize:'3rem',
            marginBottom:'20px',
            animation:'pulse 2s ease-in-out infinite'
          }}>
            📚
          </div>
          <h2 style={{color:'#1e3a8a', marginBottom:'10px'}}>
            Caricamento in corso...
          </h2>
          <p style={{color:'#64748b'}}>
            Sto recuperando i tuoi dati
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="wizard-container">
      <div className="progress-header">
        <span id="step-label">Step {step + 1} di 7</span>
        <span className="step-indicator" id="step-title">{titles[step]}</span>
      </div>

      {step === 0 && (
        <div className="step active">
          <h2>Benvenuto nel Generatore di Progettazione Didattica</h2>
          
          {/* Banner UDA */}
          <div style={{
            background:'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
            color:'white',
            padding:'20px',
            borderRadius:'10px',
            marginBottom:'20px',
            boxShadow:'0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
              <span style={{fontSize:'2.5rem'}}>💡</span>
              <div>
                <h3 style={{margin:'0 0 8px 0', fontSize:'1.1rem', fontWeight:'bold'}}>
                  Consiglio Importante
                </h3>
                <p style={{margin:0, fontSize:'0.95rem', lineHeight:'1.5'}}>
                  Per una progettazione didattica più completa e strutturata, ti consigliamo di 
                  <strong> completare prima le UDA</strong> (Unità di Apprendimento) nell'apposita sezione. 
                  Potrai poi associarle a questa progettazione.
                </p>
              </div>
            </div>
          </div>

          {/* Legenda dati salvati */}
          <div style={{
            background:'#f8fafc',
            border:'2px solid #e2e8f0',
            borderRadius:'10px',
            padding:'20px',
            marginBottom:'20px'
          }}>
            <h3 style={{margin:'0 0 15px 0', color:'#1e293b', fontSize:'1rem'}}>
              📊 Informazioni sul Salvataggio
            </h3>
            <div style={{display:'grid', gap:'12px'}}>
              <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                <div style={{
                  width:'24px',
                  height:'24px',
                  background:'#10b981',
                  borderRadius:'4px',
                  flexShrink:0
                }}></div>
                <span style={{fontSize:'0.9rem', color:'#475569'}}>
                  <strong>Verde:</strong> Questi dati vengono salvati nel database e potrai recuperarli in seguito
                </span>
              </div>
              <div style={{display:'flex', alignItems:'center', gap:'12px'}}>
                <div style={{
                  width:'24px',
                  height:'24px',
                  background:'#94a3b8',
                  borderRadius:'4px',
                  flexShrink:0
                }}></div>
                <span style={{fontSize:'0.9rem', color:'#475569'}}>
                  <strong>Grigio:</strong> Questi dati NON vengono salvati - dovrai reinserirli se ricarichi la pagina
                </span>
              </div>
            </div>
            <div style={{
              marginTop:'15px',
              padding:'12px',
              background:'#fef3c7',
              borderLeft:'4px solid #f59e0b',
              borderRadius:'4px'
            }}>
              <p style={{margin:0, fontSize:'0.85rem', color:'#92400e'}}>
                ⚠️ <strong>Importante:</strong> Ricorda di cliccare sul pulsante <strong>"💾 Salva Progettazione"</strong> 
                per salvare i tuoi progressi prima di uscire!
              </p>
            </div>
          </div>

          <div className="info-box">
            <p><strong>Come funziona questo strumento:</strong></p>
            <ul>
              <li><strong>Compilazione guidata:</strong> 7 passaggi per creare una progettazione completa</li>
              <li><strong>Salvataggio selettivo:</strong> Solo alcuni dati vengono salvati (vedi legenda sopra)</li>
              <li><strong>Generazione PDF:</strong> Al termine potrai scaricare il documento completo</li>
              <li><strong>Tempo stimato:</strong> Circa 10-15 minuti per la compilazione</li>
            </ul>
          </div>
          
          <p style={{marginTop:'20px', fontSize: '0.9rem', color: '#1e3a8a', fontWeight: '600'}}>
            Clicca su "Inizia" per procedere con la compilazione guidata.
          </p>
        </div>
      )}

      {step === 1 && (
        <div className="step active">
          <h2>Informazioni sull'Istituzione</h2>
          <label>Nome della Scuola *</label>
          <input 
            type="text" 
            id="in-scuola-nome" 
            value={formData['in-scuola-nome']} 
            onChange={handleChange} 
            placeholder="es. Istituto Comprensivo Statale 'Giuseppe Verdi'" 
          />
          <label>Codice Meccanografico *</label>
          <input 
            type="text" 
            id="in-scuola-codice" 
            value={formData['in-scuola-codice']} 
            onChange={handleChange} 
            placeholder="es. RMIC8XXXXX" 
          />
          <label>Indirizzo Scuola</label>
          <input 
            type="text" 
            id="in-scuola-indirizzo" 
            value={formData['in-scuola-indirizzo']} 
            onChange={handleChange} 
            placeholder="Via Roma 1, 00100 Roma (RM)" 
          />
        </div>
      )}

      {step === 2 && (
        <div className="step active">
          <h2>Dati dell'Alunno/a</h2>
          <label>Cognome e Nome *</label>
          <input 
            type="text" 
            id="in-alunno-nome" 
            value={formData['in-alunno-nome']} 
            onChange={handleChange} 
            placeholder="Rossi Mario" 
          />
          <div className="grid-2">
            <div>
              <label>Data di Nascita *</label>
              <input 
                type="text" 
                id="in-alunno-nascita" 
                value={formData['in-alunno-nascita']} 
                onChange={handleChange} 
                placeholder="01/01/2010" 
              />
            </div>
            <div>
              <label>Anno Scolastico *</label>
              <input 
                type="text" 
                id="in-as" 
                value={formData['in-as']} 
                onChange={handleChange} 
                placeholder="2026/27" 
              />
            </div>
          </div>
          <label>Residenza *</label>
          <input 
            type="text" 
            id="in-alunno-residenza" 
            value={formData['in-alunno-residenza']} 
            onChange={handleChange} 
            placeholder="Via Garibaldi 10, 00100 Roma (RM)" 
          />
          <div className="grid-2">
            <div>
              <label>Classe *</label>
              <select 
                id="in-classe" 
                value={formData['in-classe']} 
                disabled
                style={{
                  background:'#f3f4f6',
                  cursor:'not-allowed',
                  color:'#6b7280'
                }}
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
              <span className="help-text" style={{color:'#6b7280'}}>
                ℹ️ Caricata dal tuo profilo
              </span>
            </div>
            <div>
              <label>Indirizzo di Studio *</label>
              <input 
                type="text" 
                id="in-indirizzo-studio" 
                value={formData['in-indirizzo-studio']} 
                onChange={handleChange} 
                placeholder="es. Scuola Secondaria di I Grado" 
              />
            </div>
          </div>
          <label>Eventuali Certificazioni (DSA, L.104, BES, ecc.)</label>
          <input 
            type="text" 
            id="in-certificazioni" 
            value={formData['in-certificazioni']} 
            onChange={handleChange} 
            placeholder="es. DSA - Dislessia (L.170/2010)" 
          />
        </div>
      )}

      {step === 3 && (
        <div className="step active" style={{
          background: '#f0fdf4',
          padding: '25px',
          borderRadius: '10px',
          border: '2px solid #10b981'
        }}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
            <h2 style={{margin:0}}>Quadro Formativo Generale</h2>
            <div style={{
              background:'#10b981',
              color:'white',
              padding:'8px 16px',
              borderRadius:'6px',
              fontSize:'0.85rem',
              fontWeight:'bold'
            }}>
              💾 DATI SALVATI
            </div>
          </div>

          <p style={{marginBottom:'25px', color:'#059669', fontSize:'0.95rem', fontWeight:'500'}}>
            ℹ️ I dati inseriti in questa sezione verranno salvati nel database e potrai recuperarli in seguito.
          </p>

          {/* Percorso Formativo */}
          <div className="field-group" style={{marginBottom:'25px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
              <label style={{margin:0}}>Percorso Formativo *</label>
              <button 
                type="button"
                className="btn-std" 
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    'in-percorso': "Il progetto didattico si conforma alle Indicazioni Nazionali vigenti, strutturando un percorso volto a garantire il successo formativo attraverso la personalizzazione dei tempi e delle metodologie di apprendimento, nel pieno rispetto dei ritmi evolutivi dell'alunno."
                  }));
                }}
                style={{
                  padding:'6px 12px',
                  background:'#3b82f6',
                  color:'white',
                  border:'none',
                  borderRadius:'6px',
                  cursor:'pointer',
                  fontSize:'0.8rem'
                }}
              >
                📋 Carica Testo Standard
              </button>
            </div>
            <textarea 
              id="in-percorso" 
              value={formData['in-percorso']} 
              onChange={handleChange}
              rows="4"
              placeholder="Descrivi il percorso formativo personalizzato per l'alunno..."
              style={{width:'100%', padding:'12px', borderRadius:'8px', border:'2px solid #d1d5db'}}
            ></textarea>
          </div>

          {/* Metodologia */}
          <div className="field-group" style={{marginBottom:'25px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
              <label style={{margin:0}}>Metodologia *</label>
              <button 
                type="button"
                className="btn-std" 
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    'in-metodo': "Verrà adottata una metodologia di tipo induttivo-esperienziale, privilegiando il problem solving e l'approccio laboratoriale."
                  }));
                }}
                style={{
                  padding:'6px 12px',
                  background:'#3b82f6',
                  color:'white',
                  border:'none',
                  borderRadius:'6px',
                  cursor:'pointer',
                  fontSize:'0.8rem'
                }}
              >
                📋 Carica Testo Standard
              </button>
            </div>
            <textarea 
              id="in-metodo" 
              value={formData['in-metodo']} 
              onChange={handleChange}
              rows="3"
              placeholder="Descrivi la metodologia didattica che verrà utilizzata..."
              style={{width:'100%', padding:'12px', borderRadius:'8px', border:'2px solid #d1d5db'}}
            ></textarea>
          </div>

          {/* Ambiente di Apprendimento */}
          <div className="field-group" style={{marginBottom:'25px'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
              <label style={{margin:0}}>Ambiente di Apprendimento *</label>
              <button 
                type="button"
                className="btn-std" 
                onClick={() => {
                  setFormData(prev => ({
                    ...prev,
                    'in-ambiente': "L'alunno fruirà di un ambiente di apprendimento familiare e personalizzato, con spazi attrezzati e nuove tecnologie idonee alle sue necessità specifiche di apprendimento."
                  }));
                }}
                style={{
                  padding:'6px 12px',
                  background:'#3b82f6',
                  color:'white',
                  border:'none',
                  borderRadius:'6px',
                  cursor:'pointer',
                  fontSize:'0.8rem'
                }}
              >
                📋 Carica Testo Standard
              </button>
            </div>
            <textarea 
              id="in-ambiente" 
              value={formData['in-ambiente']} 
              onChange={handleChange}
              rows="3"
              placeholder="Descrivi l'ambiente di apprendimento..."
              style={{width:'100%', padding:'12px', borderRadius:'8px', border:'2px solid #d1d5db'}}
            ></textarea>
          </div>

          <div className="grid-2">
            {/* Modalità di Verifica */}
            <div className="field-group">
              <div style={{display:'flex', flexDirection:'column', gap:'8px', marginBottom:'8px'}}>
                <label style={{margin:0}}>Modalità di Verifica *</label>
                <button 
                  type="button"
                  className="btn-std" 
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      'in-verifiche': "Le verifiche saranno effettuate in itinere attraverso prove libere e/o strutturate e/o semistrutturate."
                    }));
                  }}
                  style={{
                    padding:'6px 12px',
                    background:'#3b82f6',
                    color:'white',
                    border:'none',
                    borderRadius:'6px',
                    cursor:'pointer',
                    fontSize:'0.8rem',
                    width:'fit-content'
                  }}
                >
                  📋 Carica Standard
                </button>
              </div>
              <textarea 
                id="in-verifiche" 
                value={formData['in-verifiche']} 
                onChange={handleChange}
                rows="3"
                placeholder="Descrivi le modalità di verifica..."
                style={{width:'100%', padding:'12px', borderRadius:'8px', border:'2px solid #d1d5db'}}
              ></textarea>
            </div>

            {/* Modalità di Valutazione */}
            <div className="field-group">
              <div style={{display:'flex', flexDirection:'column', gap:'8px', marginBottom:'8px'}}>
                <label style={{margin:0}}>Modalità di Valutazione *</label>
                <button 
                  type="button"
                  className="btn-std" 
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      'in-valutazione': "La valutazione sarà un'autovalutazione che avrà il carattere prevalentemente formativo e orientativo, finalizzata a monitorare i processi di apprendimento."
                    }));
                  }}
                  style={{
                    padding:'6px 12px',
                    background:'#3b82f6',
                    color:'white',
                    border:'none',
                    borderRadius:'6px',
                    cursor:'pointer',
                    fontSize:'0.8rem',
                    width:'fit-content'
                  }}
                >
                  📋 Carica Standard
                </button>
              </div>
              <textarea 
                id="in-valutazione" 
                value={formData['in-valutazione']} 
                onChange={handleChange}
                rows="3"
                placeholder="Descrivi le modalità di valutazione..."
                style={{width:'100%', padding:'12px', borderRadius:'8px', border:'2px solid #d1d5db'}}
              ></textarea>
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="step active" style={{
          background: '#f0fdf4',
          padding: '25px',
          borderRadius: '10px',
          border: '2px solid #10b981'
        }}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
            <h2 style={{margin:0}}>Programmazione delle Discipline</h2>
            <div style={{
              background:'#10b981',
              color:'white',
              padding:'8px 16px',
              borderRadius:'6px',
              fontSize:'0.85rem',
              fontWeight:'bold'
            }}>
              💾 DATI SALVATI
            </div>
          </div>

          <p style={{marginBottom:'25px', color:'#059669', fontSize:'0.95rem', fontWeight:'500'}}>
            ℹ️ Le discipline vengono caricate in base al tuo profilo. Puoi caricare i contenuti standard o personalizzarli. 
            Tutti i dati inseriti verranno salvati.
          </p>

          <div id="materie-dynamic-container">
            {loading && (
              <div style={{textAlign:'center', padding:'40px'}}>
                <p style={{color:'#1e3a8a', fontWeight:'bold', fontSize:'1.1rem'}}>
                  ⏳ Caricamento programmi didattici...
                </p>
              </div>
            )}
            {!loading && materie.length === 0 && (
              <div style={{textAlign:'center', padding:'40px', background:'#fff3cd', borderRadius:'8px'}}>
                <p style={{color:'#856404', fontWeight:'bold'}}>
                  ⚠️ Nessuna disciplina trovata per questa classe e indirizzo.
                </p>
                <p style={{color:'#856404', fontSize:'0.9rem'}}>
                  Verifica la connessione al database o contatta il supporto tecnico.
                </p>
              </div>
            )}
            {!loading && materie.map((m, i) => (
              <div 
                key={i} 
                className="materia-entry" 
                style={{
                  border:'2px solid #10b981', 
                  padding:'20px', 
                  borderRadius:'10px', 
                  marginBottom:'20px',
                  background:'#ffffff'
                }}
              >
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                  <b style={{color:'#064e3b', fontSize:'1.1rem'}}>
                    {i + 1}. {m.materia}
                  </b>
                  <button 
                    onClick={() => {
                      const nm = [...materie];
                      nm[i].obiettivi = m.obiettivi_standard || '';
                      nm[i].competenze = m.competenze_standard || '';
                      nm[i].argomentiStr = m.argomenti_standard || '';
                      setMaterie(nm);
                    }}
                    style={{
                      padding:'8px 15px',
                      background:'#3b82f6',
                      color:'white',
                      border:'none',
                      borderRadius:'6px',
                      cursor:'pointer',
                      fontSize:'0.9rem',
                      fontWeight:'600'
                    }}
                  >
                    📋 Carica Standard
                  </button>
                </div>
                
                <div className="grid-2" style={{marginBottom:'15px'}}>
                  <div>
                    <label style={{fontWeight:'bold', marginBottom:'5px', display:'block', color:'#064e3b'}}>Obiettivi</label>
                    <textarea 
                      placeholder="Inserisci gli obiettivi didattici..."
                      value={m.obiettivi} 
                      onChange={(e) => updateMateria(i, 'obiettivi', e.target.value)}
                      rows="4"
                      style={{width:'100%', padding:'10px', borderRadius:'6px', border:'2px solid #d1d5db'}}
                    ></textarea>
                  </div>
                  <div>
                    <label style={{fontWeight:'bold', marginBottom:'5px', display:'block', color:'#064e3b'}}>Competenze</label>
                    <textarea 
                      placeholder="Inserisci le competenze da sviluppare..."
                      value={m.competenze} 
                      onChange={(e) => updateMateria(i, 'competenze', e.target.value)}
                      rows="4"
                      style={{width:'100%', padding:'10px', borderRadius:'6px', border:'2px solid #d1d5db'}}
                    ></textarea>
                  </div>
                </div>
                
                <label style={{fontWeight:'bold', marginBottom:'5px', display:'block', color:'#064e3b'}}>Argomenti del Programma</label>
                <textarea 
                  placeholder="Elenca gli argomenti che verranno trattati..."
                  value={m.argomentiStr} 
                  onChange={(e) => updateMateria(i, 'argomentiStr', e.target.value)}
                  rows="3"
                  style={{width:'100%', padding:'10px', borderRadius:'6px', border:'2px solid #d1d5db', marginBottom:'15px'}}
                ></textarea>
                
                <label style={{fontWeight:'bold', marginBottom:'5px', display:'block', color:'#064e3b'}}>Numero Verifiche Previste</label>
                <input 
                  type="number" 
                  placeholder="es. 4" 
                  value={m.verifiche} 
                  onChange={(e) => updateMateria(i, 'verifiche', e.target.value)}
                  min="0"
                  max="20"
                  style={{width:'150px', padding:'10px', borderRadius:'6px', border:'2px solid #d1d5db'}}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="step active">
          <h2>Attività Extracurricolari</h2>
          <p style={{marginBottom:'20px', color:'#1e3a8a', fontSize:'0.95rem'}}>
            Inserisci eventuali attività extracurricolari previste per l'alunno. 
            Puoi aggiungere più attività utilizzando il pulsante "Aggiungi Attività".
          </p>
          
          <div id="attivita-container">
            {attivitaExtra.map((att, i) => (
              <div 
                key={i} 
                style={{
                  border:'2px solid #e5e7eb', 
                  padding:'20px', 
                  borderRadius:'10px', 
                  marginBottom:'20px',
                  background:'#f0f9ff',
                  position:'relative'
                }}
              >
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                  <b style={{color:'#1e3a8a', fontSize:'1.1rem'}}>
                    Attività {i + 1}
                  </b>
                  {attivitaExtra.length > 1 && (
                    <button 
                      onClick={() => rimuoviAttivita(i)}
                      style={{
                        padding:'6px 12px',
                        background:'#dc2626',
                        color:'white',
                        border:'none',
                        borderRadius:'6px',
                        cursor:'pointer',
                        fontSize:'0.9rem'
                      }}
                    >
                      🗑️ Rimuovi
                    </button>
                  )}
                </div>

                <div style={{marginBottom:'15px'}}>
                  <label style={{fontWeight:'bold', marginBottom:'5px', display:'block'}}>
                    Tipo di Attività
                  </label>
                  <input 
                    type="text"
                    placeholder="es. Laboratorio teatrale, Sport, Musica, Coding..."
                    value={att.tipo}
                    onChange={(e) => updateAttivita(i, 'tipo', e.target.value)}
                    style={{
                      width:'100%', 
                      padding:'10px', 
                      borderRadius:'6px', 
                      border:'1px solid #d1d5db',
                      fontSize:'1rem'
                    }}
                  />
                </div>

                <div>
                  <label style={{fontWeight:'bold', marginBottom:'5px', display:'block'}}>
                    Obiettivi da Raggiungere
                  </label>
                  <textarea 
                    placeholder="Descrivi gli obiettivi formativi di questa attività..."
                    value={att.obiettivi}
                    onChange={(e) => updateAttivita(i, 'obiettivi', e.target.value)}
                    rows="4"
                    style={{
                      width:'100%', 
                      padding:'10px', 
                      borderRadius:'6px', 
                      border:'1px solid #d1d5db'
                    }}
                  ></textarea>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={aggiungiAttivita}
            style={{
              padding:'12px 24px',
              background:'#059669',
              color:'white',
              border:'none',
              borderRadius:'8px',
              cursor:'pointer',
              fontSize:'1rem',
              fontWeight:'bold',
              width:'100%',
              marginTop:'10px'
            }}
          >
            ➕ Aggiungi Attività
          </button>
        </div>
      )}

      {step === 6 && (
        <div className="step active" style={{
          background: '#f0fdf4',
          padding: '25px',
          borderRadius: '10px',
          border: '2px solid #10b981'
        }}>
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px'}}>
            <h2 style={{margin:0}}>UDA Associate</h2>
            <div style={{
              background:'#10b981',
              color:'white',
              padding:'8px 16px',
              borderRadius:'6px',
              fontSize:'0.85rem',
              fontWeight:'bold'
            }}>
              💾 DATI SALVATI
            </div>
          </div>

          <p style={{marginBottom:'25px', color:'#059669', fontSize:'0.95rem', fontWeight:'500'}}>
            📚 Seleziona le Unità di Apprendimento (UDA) che vuoi includere nella progettazione didattica. 
            Le UDA selezionate verranno allegate al documento PDF finale.
          </p>

          {loading && (
            <div style={{textAlign:'center', padding:'40px'}}>
              <p style={{color:'#1e3a8a', fontWeight:'bold', fontSize:'1.1rem'}}>
                ⏳ Caricamento UDA...
              </p>
            </div>
          )}

          {!loading && udaDisponibili.length === 0 && (
            <div style={{textAlign:'center', padding:'40px', background:'#fef3c7', borderRadius:'8px', border:'2px solid #f59e0b'}}>
              <p style={{color:'#92400e', fontWeight:'bold', fontSize:'1.1rem', marginBottom:'10px'}}>
                📝 Non hai ancora creato nessuna UDA
              </p>
              <p style={{color:'#92400e', fontSize:'0.9rem', marginBottom:'15px'}}>
                Le UDA (Unità di Apprendimento) ti permettono di strutturare percorsi didattici completi.
              </p>
              <p style={{color:'#92400e', fontSize:'0.85rem'}}>
                💡 Puoi tornare indietro e creare le tue UDA, oppure continuare senza associarle.
              </p>
            </div>
          )}

          {!loading && udaDisponibili.length > 0 && (
            <div>
              <div style={{
                background:'#e0f2fe',
                padding:'15px',
                borderRadius:'8px',
                marginBottom:'20px',
                border:'1px solid #0ea5e9'
              }}>
                <p style={{margin:0, color:'#0c4a6e', fontSize:'0.9rem'}}>
                  ✅ Hai <strong>{udaDisponibili.length}</strong> UDA disponibili. 
                  Seleziona quelle che vuoi includere in questa progettazione.
                </p>
              </div>

              <div id="uda-container">
                {udaDisponibili.map((uda, i) => {
                  const isSelected = udaSelezionate.includes(uda.id);
                  return (
                    <div 
                      key={uda.id}
                      onClick={() => {
                        if (isSelected) {
                          setUdaSelezionate(udaSelezionate.filter(id => id !== uda.id));
                        } else {
                          setUdaSelezionate([...udaSelezionate, uda.id]);
                        }
                      }}
                      style={{
                        border: isSelected ? '3px solid #10b981' : '2px solid #e5e7eb',
                        background: isSelected ? '#f0fdf4' : '#ffffff',
                        padding:'20px',
                        borderRadius:'10px',
                        marginBottom:'15px',
                        cursor:'pointer',
                        transition:'all 0.2s',
                        position:'relative'
                      }}
                    >
                      {isSelected && (
                        <div style={{
                          position:'absolute',
                          top:'10px',
                          right:'10px',
                          background:'#10b981',
                          color:'white',
                          padding:'6px 12px',
                          borderRadius:'6px',
                          fontSize:'0.8rem',
                          fontWeight:'bold'
                        }}>
                          ✓ SELEZIONATA
                        </div>
                      )}

                      <div style={{display:'flex', alignItems:'start', gap:'15px'}}>
                        <div style={{
                          width:'50px',
                          height:'50px',
                          background: isSelected ? '#10b981' : '#e5e7eb',
                          borderRadius:'10px',
                          display:'flex',
                          alignItems:'center',
                          justifyContent:'center',
                          fontSize:'1.5rem',
                          flexShrink:0
                        }}>
                          📚
                        </div>

                        <div style={{flex:1}}>
                          <h3 style={{
                            margin:'0 0 8px 0',
                            color: isSelected ? '#064e3b' : '#1e293b',
                            fontSize:'1.1rem',
                            fontWeight:'bold'
                          }}>
                            {i + 1}. {uda.titolo}
                          </h3>

                          <p style={{
                            margin:0,
                            fontSize:'0.9rem',
                            color: isSelected ? '#059669' : '#475569',
                            fontStyle:'italic'
                          }}>
                            {isSelected ? '✅ Questa UDA verrà inclusa nel PDF' : '👆 Clicca per selezionare'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{
                marginTop:'20px',
                padding:'15px',
                background:'#dbeafe',
                borderRadius:'8px',
                border:'1px solid #3b82f6'
              }}>
                <p style={{margin:0, color:'#1e40af', fontSize:'0.9rem', fontWeight:'500'}}>
                  📊 UDA selezionate: <strong>{udaSelezionate.length}</strong> su {udaDisponibili.length}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="nav-btns" style={{display:'flex', gap:'15px', marginTop:'35px'}}>
        <button 
          className="btn-nav btn-prev" 
          onClick={() => moveStep(-1)} 
          disabled={step === 0}
          style={{
            flex:'0 0 auto',
            opacity: step === 0 ? 0.5 : 1,
            minWidth:'120px'
          }}
        >
          ← Indietro
        </button>

        {step > 0 && (
          <button 
            onClick={salvaProgettazione}
            style={{
              flex:'1',
              padding:'15px',
              background:'#10b981',
              color:'white',
              border:'none',
              borderRadius:'8px',
              cursor:'pointer',
              fontWeight:'bold',
              fontSize:'1rem',
              display:'flex',
              alignItems:'center',
              justifyContent:'center',
              gap:'8px'
            }}
          >
            💾 Salva Progettazione
          </button>
        )}

        <button 
          className="btn-nav btn-next" 
          onClick={() => moveStep(1)}
          style={{
            flex:'0 0 auto',
            minWidth:'180px'
          }}
        >
          {step === 0 ? "Inizia ▶" : step === 6 ? "Vai all'Anteprima →" : "Continua →"}
        </button>
      </div>
    </div>
  );
}

export default App;