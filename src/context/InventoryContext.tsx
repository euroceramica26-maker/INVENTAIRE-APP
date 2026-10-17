import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Article,
  InventoryEntry,
  EmplacementItem,
  SyncState,
  QualiteEtat,
  InventoryCampaign,
  CreateInventoryOptions,
  AdminAuthState
} from '../types/inventory';
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
  subscribeToSyncChannel,
  getStoredInventories,
  saveStoredInventories,
  getStoredActiveInventoryId,
  saveStoredActiveInventoryId,
  getStoredAdminAuth,
  saveStoredAdminAuth,
  clearStoredAdminAuth
} from '../utils/storage';
import { INITIAL_ARTICLES, INITIAL_EMPLACEMENTS, INITIAL_FAMILLES, INITIAL_MACHINES } from '../data/initialCatalog';
import { syncService, RemoteServerState } from '../utils/syncService';
import { matchScannedDataWithArticles, ScanMatchResult } from '../utils/scanParser';

interface InventoryContextType {
  // Articles & Entries Data
  articles: Article[];
  entries: InventoryEntry[];
  locations: EmplacementItem[];
  familles: string[];
  machines: string[];
  operator: string;
  setOperator: (op: string) => void;
  lastLocation: string;
  setLastLocation: (loc: string) => void;
  syncState: SyncState;

  // Admin Auth & Control Total
  isAdmin: boolean;
  adminUser: string | null;
  loginAdmin: (login: string, mdp: string) => boolean;
  logoutAdmin: () => void;
  isAdminLoginModalOpen: boolean;
  setIsAdminLoginModalOpen: (open: boolean) => void;
  adminActionMessage: string;
  setAdminActionMessage: (msg: string) => void;
  requestAdminAction: (action: () => void, message?: string) => void;

  // Multi-inventories Management
  inventories: InventoryCampaign[];
  activeInventoryId: string;
  activeInventory: InventoryCampaign | undefined;
  createInventory: (options: CreateInventoryOptions) => InventoryCampaign;
  switchInventory: (id: string) => void;
  updateInventory: (updated: Partial<InventoryCampaign> & { id: string }) => void;
  deleteInventory: (id: string) => void;
  closeInventory: (id: string) => void;
  reopenInventory: (id: string) => void;

  // Entries & Catalog Operations
  addOrUpdateEntry: (entryData: Omit<InventoryEntry, 'id' | 'timestamp' | 'syncStatus'>, existingId?: string) => InventoryEntry;
  deleteEntry: (id: string) => void;
  addArticle: (art: Omit<Article, 'id'>) => Article;
  addManualArticle: (
    art: Omit<Article, 'id'>,
    quantite?: number,
    qualite?: QualiteEtat,
    notes?: string
  ) => { article: Article; entry: InventoryEntry };
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

  // Multi-Inventories Campaigns State
  const [inventories, setInventories] = useState<InventoryCampaign[]>(() => getStoredInventories());
  const [activeInventoryId, setActiveInventoryId] = useState<string>(() => {
    const storedId = getStoredActiveInventoryId();
    const all = getStoredInventories();
    if (storedId && all.some((i) => i.id === storedId)) return storedId;
    return all[0]?.id || 'inv-default-01';
  });

  // Admin Auth State (login: ouaradtech, mdp: Ouaradtech26@)
  const [adminAuth, setAdminAuth] = useState<AdminAuthState>(() => getStoredAdminAuth());
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [adminActionMessage, setAdminActionMessage] = useState<string>('');
  const pendingAdminActionRef = useRef<(() => void) | null>(null);

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

  const addArticle = useCallback((artData: Omit<Article, 'id'>): Article => {
    let savedArt: Article;
    const artStatus = artData.status || 'saisi';

    setArticles((prev) => {
      const existingIdx = prev.findIndex(
        (a) => a.code_article.toLowerCase() === artData.code_article.toLowerCase()
      );
      if (existingIdx >= 0) {
        savedArt = {
          ...prev[existingIdx],
          ...artData,
          status: artStatus
        };
        const next = [...prev];
        next[existingIdx] = savedArt;
        saveStoredArticles(next);
        syncService.sendAction('UPDATE_ARTICLE', savedArt);
        return next;
      }

      savedArt = {
        ...artData,
        status: artStatus,
        id: `art-${Date.now()}-${Math.floor(Math.random() * 1000)}`
      };
      const next = [savedArt, ...prev];
      saveStoredArticles(next);
      syncService.sendAction('ADD_ARTICLE', savedArt);
      return next;
    });

    if (artData.machine) addMachine(artData.machine);
    if (artData.famille) addFamille(artData.famille);
    if (artData.emplacement)
      addLocation({ code: artData.emplacement, nom: artData.emplacement, zone: 'Général' });

    return savedArt!;
  }, [addMachine, addFamille, addLocation]);

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

  const addOrUpdateEntry = useCallback(
    (
      entryData: Omit<InventoryEntry, 'id' | 'timestamp' | 'syncStatus'>,
      existingId?: string
    ): InventoryEntry => {
      let updatedEntry: InventoryEntry;
      const now = new Date().toISOString();

      setEntries((prev) => {
        const codeMatch = (entryData.code_article || '').trim().toLowerCase();
        const locMatch = (entryData.emplacement || '').trim().toLowerCase();

        if (existingId) {
          const index = prev.findIndex((e) => e.id === existingId);
          if (index >= 0) {
            updatedEntry = {
              ...prev[index],
              ...entryData,
              status: 'saisi',
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
            (e.code_article || '').trim().toLowerCase() === codeMatch &&
            (e.emplacement || '').trim().toLowerCase() === locMatch
        );

        if (existingMatchIndex >= 0 && !existingId) {
          updatedEntry = {
            ...prev[existingMatchIndex],
            ...entryData,
            status: 'saisi',
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
          status: 'saisi',
          timestamp: now,
          syncStatus: 'synced'
        };
        const next = [updatedEntry, ...prev];
        saveStoredEntries(next);
        return next;
      });

      // Synchronize article in the articles list: add it if missing, and change status to 'saisi'
      setArticles((prevArts) => {
        const artIdx = prevArts.findIndex(
          (a) => a.code_article.toLowerCase() === entryData.code_article.toLowerCase()
        );
        if (artIdx >= 0) {
          const nextArts = [...prevArts];
          const curr = nextArts[artIdx];
          nextArts[artIdx] = {
            ...curr,
            designation: entryData.designation || curr.designation,
            reference: entryData.reference || curr.reference,
            famille: entryData.famille || curr.famille,
            machine: entryData.machine || curr.machine,
            unite: entryData.unite || curr.unite,
            emplacement: entryData.emplacement || curr.emplacement,
            status: 'saisi'
          };
          saveStoredArticles(nextArts);
          syncService.sendAction('UPDATE_ARTICLE', nextArts[artIdx]);
          return nextArts;
        } else {
          // If not in articles, add to articles list with status: 'saisi'
          const newArt: Article = {
            id: entryData.articleId || `art-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            code_article: entryData.code_article,
            designation: entryData.designation || entryData.code_article,
            reference: entryData.reference || '',
            famille: entryData.famille || 'Général',
            machine: entryData.machine || 'Standard',
            unite: entryData.unite || 'Pièce',
            emplacement: entryData.emplacement || '',
            quantite: entryData.quantite,
            status: 'saisi'
          };
          const nextArts = [newArt, ...prevArts];
          saveStoredArticles(nextArts);
          syncService.sendAction('ADD_ARTICLE', newArt);
          return nextArts;
        }
      });

      if (entryData.machine) addMachine(entryData.machine);
      if (entryData.famille) addFamille(entryData.famille);
      if (entryData.emplacement && entryData.emplacement.trim()) {
        addLocation({ code: entryData.emplacement, nom: entryData.emplacement, zone: 'Général' });
        setLastLocation(entryData.emplacement.trim());
      }

      // Broadcast to other devices in real-time
      syncService.sendAction('ADD_ENTRY', updatedEntry!);

      setSyncState((prev) => ({ ...prev, lastSyncedAt: new Date().toLocaleTimeString('fr-FR') }));
      return updatedEntry!;
    },
    [setLastLocation, addMachine, addFamille, addLocation]
  );

  const addManualArticle = useCallback(
    (
      artData: Omit<Article, 'id'>,
      quantite = 1,
      qualite: QualiteEtat = 'conforme',
      notes = 'Saisie manuelle'
    ): { article: Article; entry: InventoryEntry } => {
      // 1. Add/Update in articles list with status: 'saisi'
      const savedArticle = addArticle({
        ...artData,
        status: 'saisi',
        quantite: quantite
      });

      // 2. Add to entries list (saisis) with status: 'valide'
      const entry = addOrUpdateEntry({
        articleId: savedArticle.id,
        code_article: savedArticle.code_article,
        designation: savedArticle.designation,
        reference: savedArticle.reference,
        famille: savedArticle.famille || 'Général',
        machine: savedArticle.machine || 'Standard',
        unite: savedArticle.unite || 'Pièce',
        emplacement: savedArticle.emplacement || lastLocation || 'Non assigné',
        quantite: quantite,
        qualite: qualite,
        notes: notes,
        operator: operator,
        status: 'valide'
      });

      return { article: savedArticle, entry };
    },
    [addArticle, addOrUpdateEntry, lastLocation, operator]
  );

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const targetEntry = prev.find((e) => e.id === id);
      const next = prev.filter((e) => e.id !== id);
      saveStoredEntries(next);

      if (targetEntry) {
        const remaining = next.some(
          (e) => e.code_article.toLowerCase() === targetEntry.code_article.toLowerCase()
        );
        if (!remaining) {
          setArticles((prevArts) => {
            const artIdx = prevArts.findIndex(
              (a) => a.code_article.toLowerCase() === targetEntry.code_article.toLowerCase()
            );
            if (artIdx >= 0) {
              const nextArts = [...prevArts];
              nextArts[artIdx] = { ...nextArts[artIdx], status: 'a_faire' };
              saveStoredArticles(nextArts);
              syncService.sendAction('UPDATE_ARTICLE', nextArts[artIdx]);
              return nextArts;
            }
            return prevArts;
          });
        }
      }
      return next;
    });
    // Broadcast delete to other devices
    syncService.sendAction('DELETE_ENTRY', id);
  }, []);

  const clearAllEntries = useCallback(() => {
    setEntries([]);
    saveStoredEntries([]);
    // Update all articles status back to 'a_faire'
    setArticles((prev) => {
      const next = prev.map((a) => ({ ...a, status: 'a_faire' as const }));
      saveStoredArticles(next);
      return next;
    });
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

  // Derive active inventory
  const activeInventory = useMemo(() => {
    return inventories.find((i) => i.id === activeInventoryId) || inventories[0];
  }, [inventories, activeInventoryId]);

  // Synchronize current working state into active inventory campaign
  useEffect(() => {
    if (!activeInventoryId) return;
    setInventories((prev) => {
      const idx = prev.findIndex((i) => i.id === activeInventoryId);
      if (idx === -1) return prev;
      const current = prev[idx];
      // Compare if anything changed
      if (
        current.articles === articles &&
        current.entries === entries &&
        current.locations === locations &&
        current.familles === familles &&
        current.machines === machines &&
        current.lastLocation === lastLocation
      ) {
        return prev;
      }
      const updatedCampaign: InventoryCampaign = {
        ...current,
        articles,
        entries,
        locations,
        familles,
        machines,
        lastLocation
      };
      const next = [...prev];
      next[idx] = updatedCampaign;
      saveStoredInventories(next);
      return next;
    });
  }, [articles, entries, locations, familles, machines, lastLocation, activeInventoryId]);

  // Admin authentication (login: ouaradtech, mdp: Ouaradtech26@)
  const loginAdmin = useCallback((login: string, mdp: string): boolean => {
    if (login.trim().toLowerCase() === 'ouaradtech' && mdp === 'Ouaradtech26@') {
      const auth: AdminAuthState = {
        isAdmin: true,
        username: 'ouaradtech',
        lastLogin: new Date().toISOString()
      };
      setAdminAuth(auth);
      saveStoredAdminAuth(auth);
      if (pendingAdminActionRef.current) {
        const action = pendingAdminActionRef.current;
        pendingAdminActionRef.current = null;
        setTimeout(() => action(), 80);
      }
      return true;
    }
    return false;
  }, []);

  const logoutAdmin = useCallback(() => {
    const auth: AdminAuthState = { isAdmin: false, username: null, lastLogin: null };
    setAdminAuth(auth);
    clearStoredAdminAuth();
  }, []);

  const requestAdminAction = useCallback(
    (action: () => void, message?: string) => {
      if (adminAuth.isAdmin) {
        action();
      } else {
        setAdminActionMessage(
          message || 'Contrôle total réservé à l\'administrateur (ouaradtech) pour toute modification ou suppression.'
        );
        pendingAdminActionRef.current = action;
        setIsAdminLoginModalOpen(true);
      }
    },
    [adminAuth.isAdmin]
  );

  // Multi-inventory campaigns management
  const switchInventory = useCallback(
    (id: string) => {
      if (id === activeInventoryId) return;
      const target = inventories.find((i) => i.id === id);
      if (!target) return;

      // 1. Flush current lists into old active inventory
      const updatedInventories = inventories.map((inv) => {
        if (inv.id === activeInventoryId) {
          return {
            ...inv,
            articles,
            entries,
            locations,
            familles,
            machines,
            lastLocation
          };
        }
        return inv;
      });
      saveStoredInventories(updatedInventories);
      setInventories(updatedInventories);

      // 2. Set active inventory
      setActiveInventoryId(target.id);
      saveStoredActiveInventoryId(target.id);

      // 3. Load target inventory's own separate lists
      const loadedArticles = target.articles || [];
      const loadedEntries = target.entries || [];
      const loadedLocations = target.locations || [];
      const loadedFamilles = target.familles || [];
      const loadedMachines = target.machines || [];
      const loadedLastLoc = target.lastLocation || '';

      setArticles(loadedArticles);
      saveStoredArticles(loadedArticles);
      setEntries(loadedEntries);
      saveStoredEntries(loadedEntries);
      setLocations(loadedLocations);
      saveStoredLocations(loadedLocations);
      setFamilles(loadedFamilles);
      saveStoredFamilles(loadedFamilles);
      setMachines(loadedMachines);
      saveStoredMachines(loadedMachines);
      setLastLocationState(loadedLastLoc);
      saveStoredLastLocation(loadedLastLoc);

      syncService.sendAction('SWITCH_INVENTORY', { inventoryId: target.id });
    },
    [activeInventoryId, inventories, articles, entries, locations, familles, machines, lastLocation]
  );

  const createInventory = useCallback(
    (options: CreateInventoryOptions): InventoryCampaign => {
      const newId = `inv-${Date.now()}`;
      // Initial articles list: if copyFromCatalog, clone with quantite=0 and status='a_faire'
      const initialArticles = options.copyFromCatalog
        ? articles.map((a) => ({ ...a, quantite: 0, status: 'a_faire' as const }))
        : [];

      const newCampaign: InventoryCampaign = {
        id: newId,
        titre: options.titre.trim(),
        code: options.code.trim() || `INV-${String(inventories.length + 1).padStart(2, '0')}`,
        description: options.description?.trim() || '',
        dateCreation: new Date().toISOString(),
        statut: 'en_cours',
        responsable: options.responsable?.trim() || 'ouaradtech',
        articles: initialArticles,
        entries: [],
        locations: [...locations],
        familles: [...familles],
        machines: [...machines],
        lastLocation: lastLocation || ''
      };

      const nextList = [newCampaign, ...inventories];
      setInventories(nextList);
      saveStoredInventories(nextList);

      if (options.switchToNew !== false) {
        setActiveInventoryId(newId);
        saveStoredActiveInventoryId(newId);
        setArticles(newCampaign.articles);
        saveStoredArticles(newCampaign.articles);
        setEntries(newCampaign.entries);
        saveStoredEntries(newCampaign.entries);
      }

      syncService.sendAction('CREATE_INVENTORY', newCampaign);
      return newCampaign;
    },
    [articles, entries, locations, familles, machines, lastLocation, inventories]
  );

  const updateInventory = useCallback((updated: Partial<InventoryCampaign> & { id: string }) => {
    setInventories((prev) => {
      const next = prev.map((inv) => (inv.id === updated.id ? { ...inv, ...updated } : inv));
      saveStoredInventories(next);
      return next;
    });
    syncService.sendAction('UPDATE_INVENTORY', updated);
  }, []);

  const deleteInventory = useCallback(
    (id: string) => {
      setInventories((prev) => {
        if (prev.length <= 1) {
          return prev;
        }
        const next = prev.filter((inv) => inv.id !== id);
        saveStoredInventories(next);

        if (activeInventoryId === id) {
          const fallback = next[0];
          if (fallback) {
            setActiveInventoryId(fallback.id);
            saveStoredActiveInventoryId(fallback.id);
            setArticles(fallback.articles || []);
            saveStoredArticles(fallback.articles || []);
            setEntries(fallback.entries || []);
            saveStoredEntries(fallback.entries || []);
          }
        }
        return next;
      });
      syncService.sendAction('DELETE_INVENTORY', id);
    },
    [activeInventoryId]
  );

  const closeInventory = useCallback((id: string) => {
    setInventories((prev) => {
      const next = prev.map((inv) =>
        inv.id === id ? { ...inv, statut: 'cloture' as const, dateCloture: new Date().toISOString() } : inv
      );
      saveStoredInventories(next);
      return next;
    });
  }, []);

  const reopenInventory = useCallback((id: string) => {
    setInventories((prev) => {
      const next = prev.map((inv) =>
        inv.id === id ? { ...inv, statut: 'en_cours' as const, dateCloture: undefined } : inv
      );
      saveStoredInventories(next);
      return next;
    });
  }, []);

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

        // Admin Auth & Control
        isAdmin: adminAuth.isAdmin,
        adminUser: adminAuth.username,
        loginAdmin,
        logoutAdmin,
        isAdminLoginModalOpen,
        setIsAdminLoginModalOpen,
        adminActionMessage,
        setAdminActionMessage,
        requestAdminAction,

        // Multi-Inventories Campaigns
        inventories,
        activeInventoryId,
        activeInventory,
        createInventory,
        switchInventory,
        updateInventory,
        deleteInventory,
        closeInventory,
        reopenInventory,

        // Data Operations
        addOrUpdateEntry,
        deleteEntry,
        addArticle,
        addManualArticle,
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
