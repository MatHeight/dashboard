import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(SB_URL, SB_KEY);

interface UserPermissions {
  hasAccess: (appId: string) => boolean;
  isLoading: boolean;
}

export function useUserPermissions(): UserPermissions {
  const [premiumApps, setPremiumApps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadUserPermissions() {
      try {
        // Ottieni sessione Supabase
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          console.warn('⚠️ Nessuna sessione attiva');
          setPremiumApps([]);
          setIsLoading(false);
          return;
        }

        const userId = session.user.id;

        // Carica abbonamenti attivi dell'utente
        const { data: abbonamenti, error } = await supabase
          .from('abbonamenti')
          .select('servizi(nome_servizio, id)')
          .eq('id_utente', userId)
          .gte('data_scadenza', new Date().toISOString());

        if (error) {
          console.error('Errore caricamento abbonamenti:', error);
          setPremiumApps([]);
          setIsLoading(false);
          return;
        }

        // Estrai i nomi dei servizi premium attivi
        // Filtra solo i servizi che iniziano con "AI_" o che sono premium
        const premiumServices = abbonamenti
          ?.map(abb => abb.servizi?.nome_servizio)
          .filter(Boolean) || [];

        // Mappa i nomi servizi agli ID app
        const appMapping: Record<string, string[]> = {
          'SELFAROO_AI': ['studio7'],
          'DIMMY_AI': ['studio8'],
          'AETHER_AI': ['studio9'],
          // Se l'utente ha un abbonamento "Premium" generico, sblocca tutto
          'Premium': ['studio7', 'studio8', 'studio9'],
        };

        const unlockedApps = new Set<string>();
        
        premiumServices.forEach(serviceName => {
          const apps = appMapping[serviceName];
          if (apps) {
            apps.forEach(appId => unlockedApps.add(appId));
          }
        });

        setPremiumApps(Array.from(unlockedApps));
        
      } catch (error) {
        console.error('Errore caricamento permessi:', error);
        setPremiumApps([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadUserPermissions();
  }, []);

  const hasAccess = (appId: string) => {
    // Se l'app ID è in premiumApps, l'utente ha accesso
    return premiumApps.includes(appId);
  };

  return { hasAccess, isLoading };
}