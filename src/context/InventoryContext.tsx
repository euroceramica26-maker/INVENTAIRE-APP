import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Article, InventoryEntry, EmplacementItem, SyncState } from '../types/inventory';
import {
  getStoredArticles,
  saveStoredArticles,
  getStoredEntries,
  saveStoredEntries,
  getStoredLocations,
  saveStoredLocations,
  getStoredFamilles,
  saveStoredFamilles,
  getStoredMachines,
  saveStoredMachines,
  getStoredOperator,
  saveStoredOperator,
  getStoredRoomCode,
  saveStoredRoomCode,
  getStoredLastLocation,
  saveStoredLastLocation,
  clearAllLocalDatabase,
  subscribeToSyncChannel
} from '../utils/storage';
import { INITIAL_ARTICLES, INITIAL_EMPLACEMENTS, INITIAL_FAMILLES, INITIAL_MACHINES } from '../data/initialCatalog';

interface InventoryContextType {
  articles: Article[];
  entries: InventoryEntry[];
  locations: EmplacementItem[];
  familles: string[];
  machines: string[];
  operator: string;
  lastLocation: string;
  setLastLocation: (loc: string) => void;
  syncState: SyncState;
  setOperator: (op: string) => void;
  addOrUpdateEntry: (entryData: Omit<InventoryEntry, 'id' | 'timestamp' | 'syncStatus'>, existingId?: string) => InventoryEntry;
  deleteEntry: (id: string) => void;
  addArticle: (art: Omit<Article, 'id'>) => Article;
  updateArticle: (art: Article) => void;
  deleteArticle: (id: string) => void;
  importArticlesBulk: (newArticles: Article[], newMachines?: string[], newFamilles?: string[], newEmplacements?: string[]) => void;
  addLocation: (loc: Omit<EmplacementItem, 'id'>) => void;
  importLocationsBulk: (locs: EmplacementItem[]) => void;
  addMachine: (machine: string) => void;
  addFamille: (famille: string) => void;
  findArticleByCodeOrDesignation: (query: string) => Article | undefined;
  searchArticles: (query: string, machineFilter?: string, familleFilter?: string) => Article[];
  triggerManualSync: () => Promise<void>;
  updateRoomCode: (code: string) => void;
  clearAllEntries: () => void;
  clearEntireDatabase: () => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [articles, setArticles] = useState<Article[]>(() => getStoredArticles());
  const [entries, setEntries] = useState<InventoryEntry[]>(() => getStoredEntries());
  const [locations, setLocations] = useState<EmplacementItem[]>(() => getStoredLocations());
  const [familles, setFamilles] = useState<string[]>(() => getStoredFamilles());
  const [machines, setMachines] = useState<string[]>(() => getStoredMachines());
  const [operator, setOperatorState] = useState<string>(() => getStoredOperator());
  const [lastLocation, setLastLocationState] = useState<string>(() => getStoredLastLocation());

  const setLastLocation = useCallback((loc: string) => {
    setLastLocationState(loc);
    saveStoredLastLocation(loc);
  }, []);
  
  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    lastSyncedAt: new Date().toLocaleTimeString('fr-FR'),
    pendingCount: 0,
    roomCode: getStoredRoomCode(),
    peerCount: 1
  });

  useEffect(() => {
    const handleOnline = () => setSyncState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setSyncState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeToSyncChannel((type, payload) => {
      if (type === 'ENTRIES_UPDATED') {
        setEntries(payload);
        setSyncState(prev => ({ ...prev, lastSyncedAt: new Date().toLocaleTimeString('fr-FR') }));
      } else if (type === 'ARTICLES_UPDATED') {
        setArticles(payload);
      } else if (type === 'LOCATIONS_UPDATED') {
        setLocations(payload);
      } else if (type === 'FAMILLES_UPDATED') {
        setFamilles(payload);
      } else if (type === 'MACHINES_UPDATED') {
        setMachines(payload);
      } else if (type === 'DATABASE_CLEARED') {
        setArticles([]);
        setEntries([]);
        setLocations([]);
        setFamilles([]);
        setMachines([]);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const setOperator = useCallback((op: string) => {
    setOperatorState(op);
    saveStoredOperator(op);
  }, []);

  const updateRoomCode = useCallback((code: string) => {
    const clean = code.toUpperCase().trim();
    saveStoredRoomCode(clean);
    setSyncState(prev => ({ ...prev, roomCode: clean }));
  }, []);

  const triggerManualSync = useCallback(async () => {
    setSyncState(prev => ({ ...prev, isSyncing: true }));
    await new Promise(r => setTimeout(r, 400));
    setSyncState(prev => ({
      ...prev,
      isSyncing: false,
      lastSyncedAt: new Date().toLocaleTimeString('fr-FR'),
      pendingCount: 0
    }));
  }, []);

  const addOrUpdateEntry = useCallback((entryData: Omit<InventoryEntry, 'id' | 'timestamp' | 'syncStatus'>, existingId?: string): InventoryEntry => {
    let updatedEntry: InventoryEntry;

    setEntries(prev => {
      const now = new Date().toISOString();
      if (existingId) {
        const index = prev.findIndex(e => e.id === existingId);
        if (index >= 0) {
          updatedEntry = {
            ...prev[index],
            ...entryData,
            timestamp: now,
            syncStatus: 'synced'
          };
          const next = [...prev];
          next[index] = updatedEntry;
          saveStoredEntries(next);
          return next;
        }
      }

      // Check if entry already exists for this article code & location
      const existingMatchIndex = prev.findIndex(
        e => e.code_article.toLowerCase() === entryData.code_article.toLowerCase() &&
             e.emplacement.toLowerCase() === entryData.emplacement.toLowerCase()
      );

      if (existingMatchIndex >= 0 && !existingId) {
        updatedEntry = {
          ...prev[existingMatchIndex],
          ...entryData,
          timestamp: now,
          syncStatus: 'synced'
        };
        const next = [...prev];
        next[existingMatchIndex] = updatedEntry;
        saveStoredEntries(next);
        return next;
      }

      updatedEntry = {
        ...entryData,
        id: `entry-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        timestamp: now,
        syncStatus: 'synced'
      };
      const next = [updatedEntry, ...prev];
      saveStoredEntries(next);
      return next;
    });

    if (entryData.emplacement && entryData.emplacement.trim()) {
      setLastLocation(entryData.emplacement.trim());
    }

    setSyncState(prev => ({ ...prev, lastSyncedAt: new Date().toLocaleTimeString('fr-FR') }));
    return updatedEntry!;
  }, [setLastLocation]);

  const deleteEntry = useCallback((id: string) => {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      saveStoredEntries(next);
      return next;
    });
  }, []);

  const clearAllEntries = useCallback(() => {
    setEntries([]);
    saveStoredEntries([]);
  }, []);

  const clearEntireDatabase = useCallback(() => {
    clearAllLocalDatabase();
    setArticles([]);
    setEntries([]);
    setLocations([]);
    setFamilles([]);
    setMachines([]);
  }, []);

  const addArticle = useCallback((artData: Omit<Article, 'id'>): Article => {
    const newArt: Article = {
      ...artData,
      id: `art-${Date.now()}`
    };
    setArticles(prev => {
      const next = [newArt, ...prev];
      saveStoredArticles(next);
      return next;
    });

    if (artData.machine) addMachine(artData.machine);
    if (artData.famille) addFamille(artData.famille);
    if (artData.emplacement) addLocation({ code: artData.emplacement, nom: artData.emplacement, zone: 'Général' });

    return newArt;
  }, []);

  const updateArticle = useCallback((updatedArt: Article) => {
    setArticles(prev => {
      const next = prev.map(a => a.id === updatedArt.id ? updatedArt : a);
      saveStoredArticles(next);
      return next;
    });
  }, []);

  const deleteArticle = useCallback((id: string) => {
    setArticles(prev => {
      const next = prev.filter(a => a.id !== id);
      saveStoredArticles(next);
      return next;
    });
  }, []);

  const addMachine = useCallback((machine: string) => {
    const trimmed = machine.trim();
    if (!trimmed) return;
    setMachines(prev => {
      if (prev.some(m => m.toLowerCase() === trimmed.toLowerCase())) return prev;
      const next = [...prev, trimmed];
      saveStoredMachines(next);
      return next;
    });
  }, []);

  const addFamille = useCallback((famille: string) => {
    const trimmed = famille.trim();
    if (!trimmed) return;
    setFamilles(prev => {
      if (prev.some(f => f.toLowerCase() === trimmed.toLowerCase())) return prev;
      const next = [...prev, trimmed];
      saveStoredFamilles(next);
      return next;
    });
  }, []);

  const addLocation = useCallback((loc: Omit<EmplacementItem, 'id'>) => {
    const newLoc: EmplacementItem = {
      ...loc,
      id: `loc-${Date.now()}`
    };
    setLocations(prev => {
      if (prev.some(l => l.code.toLowerCase() === loc.code.toLowerCase())) return prev;
      const next = [...prev, newLoc];
      saveStoredLocations(next);
      return next;
    });
  }, []);

  const importArticlesBulk = useCallback((
    newArticles: Article[],
    newMachines?: string[],
    newFamilles?: string[],
    newEmplacements?: string[]
  ) => {
    setArticles(prev => {
      const map = new Map<string, Article>();
      prev.forEach(a => map.set(a.code_article.toLowerCase(), a));
      newArticles.forEach(a => map.set(a.code_article.toLowerCase(), a));
      const next = Array.from(map.values());
      saveStoredArticles(next);
      return next;
    });

    if (newMachines && newMachines.length > 0) {
      setMachines(prev => {
        const set = new Set(prev);
        newMachines.forEach(m => set.add(m));
        const next = Array.from(set);
        saveStoredMachines(next);
        return next;
      });
    }

    if (newFamilles && newFamilles.length > 0) {
      setFamilles(prev => {
        const set = new Set(prev);
        newFamilles.forEach(f => set.add(f));
        const next = Array.from(set);
        saveStoredFamilles(next);
        return next;
      });
    }

    if (newEmplacements && newEmplacements.length > 0) {
      setLocations(prev => {
        const set = new Set(prev.map(l => l.code.toLowerCase()));
        const toAdd: EmplacementItem[] = [];
        newEmplacements.forEach((code, idx) => {
          if (!set.has(code.toLowerCase())) {
            set.add(code.toLowerCase());
            toAdd.push({
              id: `loc-bulk-${Date.now()}-${idx}`,
              code,
              nom: code,
              zone: 'Importé'
            });
          }
        });
        const next = [...prev, ...toAdd];
        saveStoredLocations(next);
        return next;
      });
    }
  }, []);

  const importLocationsBulk = useCallback((locs: EmplacementItem[]) => {
    setLocations(prev => {
      const map = new Map<string, EmplacementItem>();
      prev.forEach(l => map.set(l.code.toLowerCase(), l));
      locs.forEach(l => map.set(l.code.toLowerCase(), l));
      const next = Array.from(map.values());
      saveStoredLocations(next);
      return next;
    });
  }, []);

  const findArticleByCodeOrDesignation = useCallback((query: string): Article | undefined => {
    if (!query || !query.trim()) return undefined;
    const q = query.trim().toLowerCase();

    const exactCode = articles.find(a => a.code_article.toLowerCase() === q);
    if (exactCode) return exactCode;

    const exactRef = articles.find(a => a.reference.toLowerCase() === q);
    if (exactRef) return exactRef;

    const exactQr = articles.find(a => a.qr_code && a.qr_code.toLowerCase() === q);
    if (exactQr) return exactQr;

    const startsCode = articles.find(a => a.code_article.toLowerCase().startsWith(q));
    if (startsCode) return startsCode;

    const includesCode = articles.find(a => a.code_article.toLowerCase().includes(q));
    if (includesCode) return includesCode;

    const includesRef = articles.find(a => a.reference.toLowerCase().includes(q));
    if (includesRef) return includesRef;

    const includesDesig = articles.find(a => a.designation.toLowerCase().includes(q));
    if (includesDesig) return includesDesig;

    return undefined;
  }, [articles]);

  const searchArticles = useCallback((
    query: string,
    machineFilter = 'all',
    familleFilter = 'all'
  ): Article[] => {
    const q = query.trim().toLowerCase();
    
    return articles.filter(art => {
      if (machineFilter !== 'all' && art.machine !== machineFilter) return false;
      if (familleFilter !== 'all' && art.famille !== familleFilter) return false;

      if (!q) return true;

      return (
        art.code_article.toLowerCase().includes(q) ||
        art.designation.toLowerCase().includes(q) ||
        art.reference.toLowerCase().includes(q) ||
        art.emplacement.toLowerCase().includes(q) ||
        art.famille.toLowerCase().includes(q) ||
        art.machine.toLowerCase().includes(q)
      );
    });
  }, [articles]);

  return (
    <InventoryContext.Provider
      value={{
        articles,
        entries,
        locations,
        familles,
        machines,
        operator,
        lastLocation,
        setLastLocation,
        syncState,
        setOperator,
        addOrUpdateEntry,
        deleteEntry,
        addArticle,
        updateArticle,
        deleteArticle,
        importArticlesBulk,
        addLocation,
        importLocationsBulk,
        addMachine,
        addFamille,
        findArticleByCodeOrDesignation,
        searchArticles,
        triggerManualSync,
        updateRoomCode,
        clearAllEntries,
        clearEntireDatabase
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (!context) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
