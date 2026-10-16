import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
import { syncService, RemoteServerState } from '../utils/syncService';
import { matchScannedDataWithArticles, ScanMatchResult } from '../utils/scanParser';

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
  deleteLocation: (id: string) => void;
  importLocationsBulk: (locs: EmplacementItem[]) => void;
  addMachine: (machine: string) => void;
  deleteMachine: (machine: string) => void;
  addFamille: (famille: string) => void;
  deleteFamille: (famille: string) => void;
  findArticleByCodeOrDesignation: (query: string) => Article | undefined;
  matchScannedArticle: (query: string) => ScanMatchResult;
  searchArticles: (query: string, machineFilter?: string, familleFilter?: string) => Article[];
  triggerManualSync: () => Promise<void>;
  updateRoomCode: (code: string) => void;
  clearAllEntries: () => void;
  clearEntireDatabase: () => void;
  loadDemoSampleData: () => void;
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

  const [syncState, setSyncState] = useState<SyncState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSyncing: false,
    lastSyncedAt: new Date().toLocaleTimeString('fr-FR'),
    pendingCount: 0,
    roomCode: getStoredRoomCode(),
    peerCount: 1
  });

  const isRemoteUpdatingRef = useRef<boolean>(false);

  const setLastLocation = useCallback((loc: string) => {
    const trimmed = loc.trim();
    if (!trimmed) return;
    setLastLocationState(trimmed);
    saveStoredLastLocation(trimmed);
    if (!isRemoteUpdatingRef.current) {
      syncService.sendAction('SET_LAST_LOCATION', trimmed);
    }
  }, []);

  // Multi-device WebSocket & HTTP Real-Time Sync
  useEffect(() => {
    // 1. Start WebSocket connection
    syncService.start();

    // 2. Subscribe to remote state updates from other devices
    const unsubscribeState = syncService.subscribeState((remote: RemoteServerState) => {
      isRemoteUpdatingRef.current = true;
      try {
        if (Array.isArray(remote.articles)) {
          setArticles(remote.articles);
          saveStoredArticles(remote.articles);
        }
        if (Array.isArray(remote.entries)) {
          setEntries(remote.entries);
          saveStoredEntries(remote.entries);
        }
        if (Array.isArray(remote.locations)) {
          setLocations(remote.locations);
          saveStoredLocations(remote.locations);
        }
        if (Array.isArray(remote.familles)) {
          setFamilles(remote.familles);
          saveStoredFamilles(remote.familles);
        }
        if (Array.isArray(remote.machines)) {
          setMachines(remote.machines);
          saveStoredMachines(remote.machines);
        }
        if (typeof remote.lastLocation === 'string' && remote.lastLocation) {
          setLastLocationState(remote.lastLocation);
          saveStoredLastLocation(remote.lastLocation);
        }
        setSyncState((prev) => ({
          ...prev,
          lastSyncedAt: new Date().toLocaleTimeString('fr-FR'),
          isSyncing: false
        }));
      } finally {
        setTimeout(() => {
          isRemoteUpdatingRef.current = false;
        }, 50);
      }
    });

    // 3. Subscribe to real-time client / device count
    const unsubscribeCount = syncService.subscribeClientCount((count) => {
      setSyncState((prev) => ({ ...prev, peerCount: Math.max(1, count) }));
    });

    // 4. Subscribe to socket connection status
    const unsubscribeStatus = syncService.subscribeStatus((connected) => {
      setSyncState((prev) => ({ ...prev, isOnline: connected }));
    });

    // 5. Subscribe to same-browser BroadcastChannel
    const unsubscribeChannel = subscribeToSyncChannel((type, payload) => {
      if (type === 'ENTRIES_UPDATED') {
        setEntries(payload);
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
      unsubscribeState();
      unsubscribeCount();
      unsubscribeStatus();
      unsubscribeChannel();
    };
  }, []);

  const setOperator = useCallback((op: string) => {
    setOperatorState(op);
    saveStoredOperator(op);
  }, []);

  const updateRoomCode = useCallback((code: string) => {
    const clean = code.toUpperCase().trim();
    saveStoredRoomCode(clean);
    setSyncState((prev) => ({ ...prev, roomCode: clean }));
  }, []);

  const triggerManualSync = useCallback(async () => {
    setSyncState((prev) => ({ ...prev, isSyncing: true }));
    try {
      const data = await syncService.fetchInitialState();
      if (!data) {
        // If server had no data yet, push local data to server
        syncService.sendFullSync({
          articles,
          entries,
          locations,
          familles,
          machines,
          lastLocation
        });
      }
    } finally {
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncedAt: new Date().toLocaleTimeString('fr-FR'),
        pendingCount: 0
      }));
    }
  }, [articles, entries, locations, familles, machines, lastLocation]);

  const addOrUpdateEntry = useCallback(
    (
      entryData: Omit<InventoryEntry, 'id' | 'timestamp' | 'syncStatus'>,
      existingId?: string
    ): InventoryEntry => {
      let updatedEntry: InventoryEntry;

      setEntries((prev) => {
        const now = new Date().toISOString();
        if (existingId) {
          const index = prev.findIndex((e) => e.id === existingId);
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
          (e) =>
            e.code_article.toLowerCase() === entryData.code_article.toLowerCase() &&
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

      // Broadcast to other devices in real-time
      syncService.sendAction('ADD_ENTRY', updatedEntry!);

      setSyncState((prev) => ({ ...prev, lastSyncedAt: new Date().toLocaleTimeString('fr-FR') }));
      return updatedEntry!;
    },
    [setLastLocation]
  );

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      saveStoredEntries(next);
      return next;
    });
    // Broadcast delete to other devices
    syncService.sendAction('DELETE_ENTRY', id);
  }, []);

  const clearAllEntries = useCallback(() => {
    setEntries([]);
    saveStoredEntries([]);
    syncService.sendAction('CLEAR_ENTRIES', null);
  }, []);

  const clearEntireDatabase = useCallback(() => {
    clearAllLocalDatabase();
    setArticles([]);
    setEntries([]);
    setLocations([]);
    setFamilles([]);
    setMachines([]);
    setLastLocationState('');
    syncService.sendAction('CLEAR_DATABASE', null);
  }, []);

  const loadDemoSampleData = useCallback(() => {
    setArticles(INITIAL_ARTICLES);
    saveStoredArticles(INITIAL_ARTICLES);
    setLocations(INITIAL_EMPLACEMENTS);
    saveStoredLocations(INITIAL_EMPLACEMENTS);
    setFamilles(INITIAL_FAMILLES);
    saveStoredFamilles(INITIAL_FAMILLES);
    setMachines(INITIAL_MACHINES);
    saveStoredMachines(INITIAL_MACHINES);

    syncService.sendAction('LOAD_DEMO', {
      articles: INITIAL_ARTICLES,
      locations: INITIAL_EMPLACEMENTS,
      familles: INITIAL_FAMILLES,
      machines: INITIAL_MACHINES
    });
  }, []);

  const addArticle = useCallback((artData: Omit<Article, 'id'>): Article => {
    const newArt: Article = {
      ...artData,
      id: `art-${Date.now()}`
    };
    setArticles((prev) => {
      const next = [newArt, ...prev];
      saveStoredArticles(next);
      return next;
    });

    if (artData.machine) addMachine(artData.machine);
    if (artData.famille) addFamille(artData.famille);
    if (artData.emplacement)
      addLocation({ code: artData.emplacement, nom: artData.emplacement, zone: 'Général' });

    syncService.sendAction('ADD_ARTICLE', newArt);
    return newArt;
  }, []);

  const updateArticle = useCallback((updatedArt: Article) => {
    setArticles((prev) => {
      const next = prev.map((a) => (a.id === updatedArt.id ? updatedArt : a));
      saveStoredArticles(next);
      return next;
    });
    syncService.sendAction('UPDATE_ARTICLE', updatedArt);
  }, []);

  const deleteArticle = useCallback((id: string) => {
    setArticles((prev) => {
      const next = prev.filter((a) => a.id !== id);
      saveStoredArticles(next);
      return next;
    });
    syncService.sendAction('DELETE_ARTICLE', id);
  }, []);

  const addMachine = useCallback((machine: string) => {
    const trimmed = machine.trim();
    if (!trimmed) return;
    setMachines((prev) => {
      if (prev.some((m) => m.toLowerCase() === trimmed.toLowerCase())) return prev;
      const next = [...prev, trimmed];
      saveStoredMachines(next);
      return next;
    });
    syncService.sendAction('ADD_MACHINE', trimmed);
  }, []);

  const deleteMachine = useCallback((machine: string) => {
    setMachines((prev) => {
      const next = prev.filter((m) => m.toLowerCase() !== machine.toLowerCase());
      saveStoredMachines(next);
      return next;
    });
    syncService.sendAction('DELETE_MACHINE', machine);
  }, []);

  const addFamille = useCallback((famille: string) => {
    const trimmed = famille.trim();
    if (!trimmed) return;
    setFamilles((prev) => {
      if (prev.some((f) => f.toLowerCase() === trimmed.toLowerCase())) return prev;
      const next = [...prev, trimmed];
      saveStoredFamilles(next);
      return next;
    });
    syncService.sendAction('ADD_FAMILLE', trimmed);
  }, []);

  const deleteFamille = useCallback((famille: string) => {
    setFamilles((prev) => {
      const next = prev.filter((f) => f.toLowerCase() !== famille.toLowerCase());
      saveStoredFamilles(next);
      return next;
    });
    syncService.sendAction('DELETE_FAMILLE', famille);
  }, []);

  const addLocation = useCallback((loc: Omit<EmplacementItem, 'id'>) => {
    const newLoc: EmplacementItem = {
      ...loc,
      id: `loc-${Date.now()}`
    };
    setLocations((prev) => {
      if (prev.some((l) => l.code.toLowerCase() === loc.code.toLowerCase())) return prev;
      const next = [...prev, newLoc];
      saveStoredLocations(next);
      return next;
    });
    syncService.sendAction('ADD_LOCATION', newLoc);
  }, []);

  const deleteLocation = useCallback((id: string) => {
    setLocations((prev) => {
      const next = prev.filter((l) => l.id !== id && l.code !== id);
      saveStoredLocations(next);
      return next;
    });
    syncService.sendAction('DELETE_LOCATION', id);
  }, []);

  const importArticlesBulk = useCallback(
    (
      newArticles: Article[],
      newMachines?: string[],
      newFamilles?: string[],
      newEmplacements?: string[]
    ) => {
      setArticles((prev) => {
        const map = new Map<string, Article>();
        prev.forEach((a) => map.set(a.code_article.toLowerCase(), a));
        newArticles.forEach((a) => map.set(a.code_article.toLowerCase(), a));
        const next = Array.from(map.values());
        saveStoredArticles(next);
        return next;
      });

      if (newMachines && newMachines.length > 0) {
        setMachines((prev) => {
          const set = new Set(prev);
          newMachines.forEach((m) => set.add(m));
          const next = Array.from(set);
          saveStoredMachines(next);
          return next;
        });
      }

      if (newFamilles && newFamilles.length > 0) {
        setFamilles((prev) => {
          const set = new Set(prev);
          newFamilles.forEach((f) => set.add(f));
          const next = Array.from(set);
          saveStoredFamilles(next);
          return next;
        });
      }

      if (newEmplacements && newEmplacements.length > 0) {
        setLocations((prev) => {
          const set = new Set(prev.map((l) => l.code.toLowerCase()));
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

      syncService.sendAction('IMPORT_ARTICLES', {
        newArticles,
        newMachines,
        newFamilles,
        newEmplacements
      });
    },
    []
  );

  const importLocationsBulk = useCallback((locs: EmplacementItem[]) => {
    setLocations((prev) => {
      const map = new Map<string, EmplacementItem>();
      prev.forEach((l) => map.set(l.code.toLowerCase(), l));
      locs.forEach((l) => map.set(l.code.toLowerCase(), l));
      const next = Array.from(map.values());
      saveStoredLocations(next);
      return next;
    });

    syncService.sendAction('IMPORT_LOCATIONS', { newLocations: locs });
  }, []);

  const matchScannedArticle = useCallback(
    (query: string): ScanMatchResult => {
      return matchScannedDataWithArticles(query, articles, entries);
    },
    [articles, entries]
  );

  const findArticleByCodeOrDesignation = useCallback(
    (query: string): Article | undefined => {
      if (!query || !query.trim()) return undefined;
      const res = matchScannedDataWithArticles(query, articles, entries);
      if (res.matchedArticle) return res.matchedArticle;

      const q = query.trim().toLowerCase();
      const exactCode = articles.find((a) => a.code_article.toLowerCase() === q);
      if (exactCode) return exactCode;

      const exactRef = articles.find((a) => a.reference.toLowerCase() === q);
      if (exactRef) return exactRef;

      const exactQr = articles.find((a) => a.qr_code && a.qr_code.toLowerCase() === q);
      if (exactQr) return exactQr;

      const startsCode = articles.find((a) => a.code_article.toLowerCase().startsWith(q));
      if (startsCode) return startsCode;

      const includesCode = articles.find((a) => a.code_article.toLowerCase().includes(q));
      if (includesCode) return includesCode;

      const includesRef = articles.find((a) => a.reference.toLowerCase() === q);
      if (includesRef) return includesRef;

      const includesDesig = articles.find((a) => a.designation.toLowerCase().includes(q));
      if (includesDesig) return includesDesig;

      return undefined;
    },
    [articles, entries]
  );

  const searchArticles = useCallback(
    (query: string, machineFilter = 'all', familleFilter = 'all'): Article[] => {
      const q = query.trim().toLowerCase();

      return articles.filter((art) => {
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
    },
    [articles]
  );

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
        deleteLocation,
        importLocationsBulk,
        addMachine,
        deleteMachine,
        addFamille,
        deleteFamille,
        findArticleByCodeOrDesignation,
        matchScannedArticle,
        searchArticles,
        triggerManualSync,
        updateRoomCode,
        clearAllEntries,
        clearEntireDatabase,
        loadDemoSampleData
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
