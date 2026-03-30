export interface MicroApp {
  id: string;
  label: string;
  url?: string;
  description?: string;
  priority?: 'high' | 'normal' | 'low';
  openInNewTab?: boolean;
  isPremium?: boolean;
}

export const AREA_NORMATIVA = [
{ label: "Decreto Caivano - L. 159/23", url: "https://www.gazzettaufficiale.it/eli/id/2023/09/15/23G00135/SG" },
  { label: "Nota MIM n.7557 del 22/2/24", url: "https://www.mim.gov.it/-/nota-n-7557-del-22-febbraio-2024" },
  { label: "Linee Guida Istruzione Parentale", url: "https://www.mim.gov.it/istruzione-parentale" },
  { label: "D.Lgs 62/17", url: "https://www.gazzettaufficiale.it/eli/id/2017/05/16/17G00070/sq" },
  { label: "Nota MIM n.4155 del 7/2/23", url: "https://www.mim.gov.it/-/circolare-n-4155-del-7-febbraio-2023" },
  { label: "D.Lgs 297/94", url: "https://www.gazzettaufficiale.it/eli/id/1994/05/19/094G0291/sg" },
  { label: "Decreto Ministeriale n. 5 dell'8/2/21", url: "https://www.mim.gov.it/-/decreto-ministeriale-n-5-del-8-febbraio-2021" },
  { label: "Bisogni Educativi Speciali", url: "https://www.mim.gov.it/bisogni-educativi-speciali" },
  { label: "Legge 170/10", url: "https://www.gazzettaufficiale.it/eli/id/2010/10/18/010G0192/sg" },
  { label: "Decreto Ministeriale 12 luglio 2011", url: "https://www.istruzione.it/esame_di_stato/Primo_Ciclo/normativa/allegati/prot5669_11.pdf" },
  { label: "Direttiva Ministeriale 27 dicembre 2012", url: "https://www.mim.gov.it/documents/20182/0/Direttiva+Ministeriale+27+Dicembre+2012.pdf/e1ee3673-cf97-441c-b14d-7ae5f386c78c" },
  { label: "Inclusione scolastica D.Lgs 66/2017", url: "https://www.gazzettaufficiale.it/eli/id/2017/05/16/17G00074/sg" },
  { label: "Nuovo Decreto per l'inclusione scolastica D.Lgs 62/2024", url: "https://www.gazzettaufficiale.it/eli/id/2024/05/14/24G00079/SG" },
  { label: "Ordinanza Ministeriale n. 67 del 31 marzo 2025", url: "https://www.mim.gov.it/-/ordinanza-ministeriale-n-67-del-31-marzo-2025" },
  { label: "L. 104/92", url: "https://www.gazzettaufficiale.it/eli/id/1992/02/17/092G0108/sg" }
];

export const AREA_DOCUMENTI: MicroApp[] = [
  { 
    id: 'doc1', 
    label: 'Dichiarazione Istruzione Parentale', 
    url: 'https://dip-as7.pages.dev/', 
    description: 'Compila e scarica il modulo' // 👈 MODIFICA QUI
  },
  { 
    id: 'doc2', 
    label: 'Autocertificazione Capacità Tecniche ed Economiche', 
    url: 'https://acte.pages.dev/', 
    description: 'Compila e scarica il modulo', // 👈 MODIFICA QUI
    priority: 'high' 
  },
    { 
    id: 'doc3', 
    label: 'Genera Piano Didattico Educativo', 
    url: '/ped/', 
    description: 'Genera il PED', // 👈 MODIFICA QUI
    priority: 'high',
   openInNewTab: true	
  },
  { 
    id: 'doc4', 
    label: 'Richiesta Esame di Idoneità o Esame di Stato', 
    url: 'https://dexami.pages.dev/', 
    description: 'Compila e scarica il modulo' // 👈 MODIFICA QUI
  },
  { 
    id: 'doc5', 
    label: 'Genera PDP - Piano Didattico Personalizzato', 
    url: 'https://pdp-m013.pages.dev/', 
    description: 'Compila e scarica il modulo' // 👈 MODIFICA QUI
  },
  { 
    id: 'doc6', 
    label: 'Piano Didattico Educativo Svolto', 
    url: '/pde/', 
    description: 'Visualizza e Stampa le attività svolte' // 👈 MODIFICA QUI
  },
   { 
    id: 'doc7', 
    label: 'Scadenze', 
    url: '#', 
    description: 'Visualizza e Stampa le scadenze' // 👈 MODIFICA QUI
  },
];

export const AREA_STUDIO: MicroApp[] = [
  { 
    id: 'studio1', 
    label: 'REGISTRO', 
    url: '/diario/', 
    description: 'Registra le attività svolte', // 👈 MODIFICA QUI
    openInNewTab: true
  },
  { 
    id: 'studio2', 
    label: 'RISORSE', 
    url: '#', 
    description: 'Appunti, slide e video', // 👈 MODIFICA QUI
    openInNewTab: true
  },
  { 
    id: 'studio3', 
    label: 'UDA', 
    url: '/uda/', 
    description: 'Crea o scegli Unità didattiche d\'apprendimento', // 👈 MODIFICA QUI
	openInNewTab: true
  },
  { 
    id: 'studio4', 
    label: 'STRUMENTI', 
    url: 'https://struments-6jc.pages.dev/', 
    description: 'Correttore ortografico, calcolatrice scientifica e peech to text', // 👈 MODIFICA QUI
    openInNewTab: true
  },
  { 
    id: 'studio5', 
    label: 'MAPPE', 
    url: '/concept-map/', 
    description: 'Crea mappe concettuali', // 👈 MODIFICA QUI
    openInNewTab: true 
  },
  { 
    id: 'studio6', 
    label: 'ACADEMY', 
    url: '/academy/', 
    description: 'Repository di matematica', // 👈 MODIFICA QUI
    openInNewTab: true
  },
  
  // ========================================
  // 🔒 APP PREMIUM
  // ========================================
  { 
    id: 'studio7', 
    label: 'SELFAROO_AI', 
    url: '#', // 👈 MODIFICA QUI: inserisci URL quando pronto
    description: 'Generatore di verifiche e compiti per autovalutazione', // 👈 MODIFICA QUI
    isPremium: true,
    openInNewTab: true
  },
  { 
    id: 'studio8', 
    label: 'DIMMY_AI', 
    url: '#', // 👈 MODIFICA QUI: inserisci URL quando pronto
    description: ' Il compagno di banco per l\'apprendimento attivo tramite il learning by teaching.', // 👈 MODIFICA QUI
    isPremium: true,
    openInNewTab: true
  },
  { 
    id: 'studio9', 
    label: 'AETHER_AI', 
    url: '#', // 👈 MODIFICA QUI: inserisci URL quando pronto
    description: 'Q&A per lo scambio rapido di richieste sintetiche e risposte puntuali ', // 👈 MODIFICA QUI
    isPremium: true,
    openInNewTab: true
  }
];