import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase credentials')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipi per il database
export type TipoAttivita = 'studio' | 'uda' | 'extrascolastica'

export interface DiarioAttivita {
  id: string
  user_id: string
  tipo_attivita: TipoAttivita
  data_ora: string
  created_at: string
  updated_at: string
}

export interface DiarioStudio {
  id: string
  materia: string
  argomento: string
  dettagli: string | null
}

export interface DiarioUda {
  id: string
  uda_id: string | null
  titolo_uda: string
  descrizione_attivita: string | null
}

export interface DiarioExtrascolastica {
  id: string
  titolo_attivita: string
  descrizione_attivita: string | null
  competenze_ids: string[]
}

export interface Competenza {
  id: string
  nome: string
  descrizione: string | null
  ind_logico: number
  categoria: string | null
  created_at: string
}

export interface ProgrammaDidatticoBase {
  id: string
  classe: number
  materia: string
  programma_json: any
  ind_logico: number
  obiettivi_materia: string | null
  competenze_materia: string | null
}

export interface UdaDocumento {
  id: string
  user_id: string
  titolo: string
  tipo_scuola: string
  ind_logico: number
  created_at: string
}