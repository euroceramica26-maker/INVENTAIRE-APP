import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Article,
  InventoryEntry,
  EmplacementItem,
  SyncState,
  QualiteEtat,
  InventoryCampaign,
  CreateInventoryOptions,
  AdminAuthState,
  AppUser
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
  clearStoredAdminAuth,
  getStoredUsers,
  saveStoredUsers,
  getStoredCurrentUser,
  saveStoredCurrentUser,
  clearStoredCurrentUser
} from '../utils/storage';
import { ADMIN_CREDENTIALS } from '../utils/auth';
import { isValidLocation } from '../utils/excelImport';
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

  // Session & User Authentication (Mandatory at startup)
  currentUser: AppUser | null;
  users: AppUser[];
  loginUser: (username: string, motDePasse: string) => { success: boolean; message?: string };
  logoutUser: () => void;
  createUser: (userData: Omit<AppUser, 'id' | 'dateCreation'>) => { success: boolean; message?: string; user?: AppUser };
  updateUser: (userData: AppUser) => { success: boolean; message?: string };
  deleteUser: (userId: string) => { success: boolean; message?: string };
  toggleUserActive: (userId: string) => void;

  // Admin Auth & Control Total
  isAdmin: boolean;
  adminUser: string | null;
  loginAdmin: (login: string, mdp: string) => boolean;
  verifyAdminPassword: (password: string) => boolean;
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
  deleteEntriesBulk: (ids: string[]) => void;
  addArticle: (art: Omit<Article, 'id'>) => Article;
  addManualArticle: (
    art: Omit<Article, 'id'>,
    quantite?: number,
    qualite?: QualiteEtat,
    notes?: string
  ) => { article: Article; entry: InventoryEntry };
  updateArticle: (art: Article) => void;
  deleteArticle: (id: string) => void;
  deleteArticlesBulk: (ids: string[]) => void;
  deleteCombinedRowsBulk: (items: { id: string; code_article: string; isSaisi: boolean }[]) => void;
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
    return all[0]?.id || 'inv-principal';
  });

  // Admin Auth State (login: ouaradtech, mdp: Ouaradtech26@)
  const [adminAuth, setAdminAuth] = useState<AdminAuthState>(() => getStoredAdminAuth());
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [adminActionMessage, setAdminActionMessage] = useState<string>('');
  const pendingAdminActionRef = useRef<(() => void) | null>(null);

  // User Accounts & Mandatory Session State
  const [users, setUsers] = useState<AppUser[]>(() => getStoredUsers());
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredCurrentUser());

  // Keep operator and admin state in sync with currentUser
  useEffect(() => {
    if (currentUser) {
      const opName = currentUser.nom || currentUser.username;
      setOperatorState(opName);
      saveStoredOperator(opName);
      if (currentUser.role === 'admin') {
        setAdminAuth({
          isAdmin: true,
          username: currentUser.username,
          lastLogin: new Date().toISOString()
        });
      }
    }
  }, [currentUser]);

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
          if (remote.articles.length > 0) {
            setArticles(remote.articles);
            saveStoredArticles(remote.articles);
          } else {
            const localArticles = getStoredArticles();
            if (localArticles.length > 0) {
              syncService.sendAction('IMPORT_ARTICLES', {
                newArticles: localArticles,
                newMachines: getStoredMachines(),
                newFamilles: getStoredFamilles(),
                newEmplacements: getStoredLocations().map((l) => l.code)
              });
            } else {
              setArticles([]);
              saveStoredArticles([]);
            }
          }
        }
        if (Array.isArray(remote.entries)) {
          if (remote.entries.length > 0) {
            setEntries(remote.entries);
            saveStoredEntries(remote.entries);
          } else {
            const localEntries = getStoredEntries();
            if (localEntries.length > 0) {
              setEntries(localEntries);
              localEntries.forEach((ent) => {
                syncService.sendAction('ADD_ENTRY', ent);
              });
            } else {
              setEntries([]);
              saveStoredEntries([]);
            }
          }
        }
        if (Array.isArray(remote.locations)) {
          if (remote.locations.length > 0) {
            setLocations(remote.locations);
            saveStoredLocations(remote.locations);
          } else {
            const localLocs = getStoredLocations();
            if (localLocs.length > 0) {
              syncService.sendAction('IMPORT_LOCATIONS', { newLocations: localLocs });
            } else {
              setLocations([]);
              saveStoredLocations([]);
            }
          }
        }
        if (Array.isArray(remote.familles)) {
          setFamilles(remote.familles);
          saveStoredFamilles(remote.familles);
        }
        if (Array.isArray(remote.machines)) {
          setMachines(remote.machines);
          saveStoredMachines(remote.machines);
        }
        if (Array.isArray(remote.inventories) && remote.inventories.length > 0) {
          setInventories(remote.inventories);
          saveStoredInventories(remote.inventories);
        }
        if (typeof remote.activeInventoryId === 'string' && remote.activeInventoryId) {
          setActiveInventoryId(remote.activeInventoryId);
          saveStoredActiveInventoryId(remote.activeInventoryId);
        }
        if (Array.isArray(remote.users) && remote.users.length > 0) {
          setUsers(remote.users);
          saveStoredUsers(remote.users);
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

    // 5. Subscribe to real-time sync in-flight activity & pending sync
    const unsubscribeActivity = syncService.subscribeActivity((isSyncing, pendingCount) => {
      setSyncState((prev) => ({
        ...prev,
        isSyncing,
        pendingCount: !prev.isOnline ? Math.max(1, pendingCount) : pendingCount,
        lastSyncedAt: !isSyncing ? new Date().toLocaleTimeString('fr-FR') : prev.lastSyncedAt
      }));
    });

    // 6. Subscribe to same-browser BroadcastChannel
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
      unsubscribeActivity();
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

  const deleteArticlesBulk = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    setArticles((prev) => {
      const next = prev.filter((a) => !idSet.has(a.id));
      saveStoredArticles(next);
      return next;
    });
    setInventories((prevInvs) => {
      const next = prevInvs.map((inv) => {
        if (inv.id === activeInventoryId) {
          return {
            ...inv,
            articles: (inv.articles || []).filter((a) => !idSet.has(a.id))
          };
        }
        return inv;
      });
      saveStoredInventories(next);
      return next;
    });
    ids.forEach((id) => {
      syncService.sendAction('DELETE_ARTICLE', id);
    });
  }, [activeInventoryId]);

  const addOrUpdateEntry = useCallback(
    (
      entryData: Omit<InventoryEntry, 'id' | 'timestamp' | 'syncStatus'>,
      existingId?: string
    ): InventoryEntry => {
      let updatedEntry: InventoryEntry;
      const now = new Date().toISOString();
      const finalOperator = entryData.operator || currentUser?.nom || currentUser?.username || operator || 'Opérateur';

      // Déterminer l'emplacement réel : priorité à la valeur saisie, puis lastLocation, sans jamais conserver "Non renseigné"
      const rawLoc = (entryData.emplacement || entryData.position || '').trim();
      const realLocation = (rawLoc && rawLoc !== 'Non renseigné' && rawLoc !== 'Non assigné')
        ? rawLoc
        : (lastLocation && lastLocation !== 'Non renseigné' && lastLocation !== 'Non assigné')
        ? lastLocation
        : 'Non assigné';

      const sanitizedData = {
        ...entryData,
        emplacement: realLocation,
        position: realLocation,
        operator: finalOperator,
        status: 'saisi' as const
      };

      setEntries((prev) => {
        const codeMatch = (sanitizedData.code_article || '').trim().toLowerCase();
        const locMatch = (sanitizedData.emplacement || '').trim().toLowerCase();

        if (existingId) {
          const index = prev.findIndex((e) => e.id === existingId);
          if (index >= 0) {
            updatedEntry = {
              ...prev[index],
              ...sanitizedData,
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
            ...sanitizedData,
            timestamp: now,
            syncStatus: 'synced'
          };
          const next = [...prev];
          next[existingMatchIndex] = updatedEntry;
          saveStoredEntries(next);
          return next;
        }

        updatedEntry = {
          ...sanitizedData,
          id: `entry-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          timestamp: now,
          syncStatus: 'synced'
        };
        const next = [updatedEntry, ...prev];
        saveStoredEntries(next);
        return next;
      });

      // Synchronize article in the articles list: add it if missing, and change status to 'saisi' avec l'emplacement réel
      setArticles((prevArts) => {
        const artIdx = prevArts.findIndex(
          (a) => a.code_article.toLowerCase() === sanitizedData.code_article.toLowerCase()
        );
        if (artIdx >= 0) {
          const nextArts = [...prevArts];
          const curr = nextArts[artIdx];
          nextArts[artIdx] = {
            ...curr,
            designation: sanitizedData.designation || curr.designation,
            reference: sanitizedData.reference || curr.reference,
            famille: sanitizedData.famille || curr.famille,
            machine: sanitizedData.machine || curr.machine,
            unite: sanitizedData.unite || curr.unite,
            emplacement: realLocation,
            position: realLocation,
            quantite: sanitizedData.quantite,
            status: 'saisi'
          };
          saveStoredArticles(nextArts);
          syncService.sendAction('UPDATE_ARTICLE', nextArts[artIdx]);
          return nextArts;
        } else {
          // If not in articles, add to articles list with status: 'saisi'
          const newArt: Article = {
            id: sanitizedData.articleId || `art-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            code_article: sanitizedData.code_article,
            designation: sanitizedData.designation || sanitizedData.code_article,
            reference: sanitizedData.reference || '',
            famille: sanitizedData.famille || 'Général',
            machine: sanitizedData.machine || 'Standard',
            unite: sanitizedData.unite || 'Pièce',
            emplacement: realLocation,
            position: realLocation,
            quantite: sanitizedData.quantite,
            status: 'saisi'
          };
          const nextArts = [newArt, ...prevArts];
          saveStoredArticles(nextArts);
          syncService.sendAction('ADD_ARTICLE', newArt);
          return nextArts;
        }
      });

      if (sanitizedData.machine) addMachine(sanitizedData.machine);
      if (sanitizedData.famille) addFamille(sanitizedData.famille);
      if (realLocation && realLocation !== 'Non assigné' && realLocation !== 'Non renseigné') {
        addLocation({ code: realLocation, nom: realLocation, zone: 'Général' });
        setLastLocation(realLocation);
      }

      // Synchroniser immédiatement la campagne d'inventaire active
      setInventories((prev) => {
        const next = prev.map((inv) => {
          if (inv.id === activeInventoryId) {
            const existingEntries = inv.entries || [];
            const idx = existingEntries.findIndex((e) => e.id === updatedEntry!.id);
            const nextEntries = idx >= 0
              ? existingEntries.map((e) => (e.id === updatedEntry!.id ? updatedEntry! : e))
              : [updatedEntry!, ...existingEntries];
            return {
              ...inv,
              entries: nextEntries,
              lastLocation: realLocation !== 'Non assigné' ? realLocation : inv.lastLocation
            };
          }
          return inv;
        });
        saveStoredInventories(next);
        return next;
      });

      // Broadcast to other devices in real-time
      syncService.sendAction('ADD_ENTRY', updatedEntry!);

      setSyncState((prev) => ({ ...prev, lastSyncedAt: new Date().toLocaleTimeString('fr-FR') }));
      return updatedEntry!;
    },
    [setLastLocation, addMachine, addFamille, addLocation, currentUser, operator, lastLocation, activeInventoryId]
  );

  const addManualArticle = useCallback(
    (
      artData: Omit<Article, 'id'>,
      quantite = 1,
      qualite: QualiteEtat = 'conforme',
      notes = 'Saisie manuelle'
    ): { article: Article; entry: InventoryEntry } => {
      const rawLoc = (artData.emplacement || artData.position || '').trim();
      const realLocation = (rawLoc && rawLoc !== 'Non renseigné' && rawLoc !== 'Non assigné')
        ? rawLoc
        : (lastLocation && lastLocation !== 'Non renseigné' && lastLocation !== 'Non assigné')
        ? lastLocation
        : 'Non assigné';

      // 1. Add/Update in articles list with status: 'saisi' and real location
      const savedArticle = addArticle({
        ...artData,
        emplacement: realLocation,
        position: realLocation,
        status: 'saisi',
        quantite: quantite
      });

      // 2. Add to entries list (saisis) with status: 'saisi' and real location
      const entry = addOrUpdateEntry({
        articleId: savedArticle.id,
        code_article: savedArticle.code_article,
        designation: savedArticle.designation,
        reference: savedArticle.reference,
        famille: savedArticle.famille || 'Général',
        machine: savedArticle.machine || 'Standard',
        unite: savedArticle.unite || 'Pièce',
        emplacement: realLocation,
        position: realLocation,
        quantite: quantite,
        qualite: qualite,
        notes: notes,
        operator: currentUser?.nom || currentUser?.username || operator || 'Opérateur',
        status: 'saisi'
      });

      return { article: savedArticle, entry };
    },
    [addArticle, addOrUpdateEntry, lastLocation, operator, currentUser]
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

  const deleteEntriesBulk = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const idSet = new Set(ids);
    setEntries((prev) => {
      const removedEntries = prev.filter((e) => idSet.has(e.id));
      const next = prev.filter((e) => !idSet.has(e.id));
      saveStoredEntries(next);

      // Determine which article codes now have no remaining entries
      const remainingCodes = new Set(next.map((e) => (e.code_article || '').toLowerCase().trim()));
      const codesToReset = new Set<string>();
      removedEntries.forEach((e) => {
        const code = (e.code_article || '').toLowerCase().trim();
        if (code && !remainingCodes.has(code)) {
          codesToReset.add(code);
        }
      });

      if (codesToReset.size > 0) {
        setArticles((prevArts) => {
          let hasChanges = false;
          const nextArts = prevArts.map((a) => {
            const code = (a.code_article || '').toLowerCase().trim();
            if (codesToReset.has(code) && a.status !== 'a_faire') {
              hasChanges = true;
              return { ...a, status: 'a_faire' as const };
            }
            return a;
          });
          if (hasChanges) {
            saveStoredArticles(nextArts);
          }
          return nextArts;
        });
      }

      setInventories((prevInvs) => {
        const next = prevInvs.map((inv) => {
          if (inv.id === activeInventoryId) {
            return {
              ...inv,
              entries: (inv.entries || []).filter((e) => !idSet.has(e.id))
            };
          }
          return inv;
        });
        saveStoredInventories(next);
        return next;
      });

      return next;
    });

    ids.forEach((id) => {
      syncService.sendAction('DELETE_ENTRY', id);
    });
  }, [activeInventoryId]);

  const deleteCombinedRowsBulk = useCallback(
    (items: { id: string; code_article: string; isSaisi: boolean }[]) => {
      if (!items || items.length === 0) return;

      const entryIdsToDelete: string[] = [];
      const articleIdsToDelete: string[] = [];

      const entriesByCode = new Map<string, InventoryEntry[]>();
      entries.forEach((e) => {
        const code = (e.code_article || '').toLowerCase().trim();
        if (!entriesByCode.has(code)) entriesByCode.set(code, []);
        entriesByCode.get(code)!.push(e);
      });

      const articlesByCode = new Map<string, Article>();
      articles.forEach((a) => {
        articlesByCode.set((a.code_article || '').toLowerCase().trim(), a);
      });

      items.forEach((item) => {
        const code = (item.code_article || '').toLowerCase().trim();
        if (item.isSaisi) {
          const directEntry = entries.find((e) => e.id === item.id);
          if (directEntry) {
            entryIdsToDelete.push(directEntry.id);
          } else {
            const matched = entriesByCode.get(code);
            if (matched && matched.length > 0) {
              matched.forEach((m) => entryIdsToDelete.push(m.id));
            }
          }
        } else {
          const cleanId = item.id.startsWith('missing-') ? item.id.replace('missing-', '') : item.id;
          const art = articles.find((a) => a.id === cleanId) || articlesByCode.get(code);
          if (art) {
            articleIdsToDelete.push(art.id);
          }
        }
      });

      if (entryIdsToDelete.length > 0) {
        deleteEntriesBulk(entryIdsToDelete);
      }
      if (articleIdsToDelete.length > 0) {
        deleteArticlesBulk(articleIdsToDelete);
      }
    },
    [entries, articles, deleteEntriesBulk, deleteArticlesBulk]
  );

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
    const cleanInv: InventoryCampaign = {
      id: 'inv-principal',
      titre: 'Inventaire Principal',
      code: 'INV-01',
      description: "Campagne principale d'inventaire",
      dateCreation: new Date().toISOString(),
      statut: 'en_cours',
      responsable: 'ouaradtech',
      articles: [],
      entries: [],
      locations: [],
      familles: [],
      machines: [],
      lastLocation: ''
    };
    setInventories([cleanInv]);
    setActiveInventoryId('inv-principal');
    saveStoredInventories([cleanInv]);
    saveStoredActiveInventoryId('inv-principal');
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
      let mergedArticles: Article[] = [];
      setArticles((prev) => {
        const map = new Map<string, Article>();
        prev.forEach((a) => map.set(a.code_article.toLowerCase(), a));
        newArticles.forEach((a) => map.set(a.code_article.toLowerCase(), a));
        mergedArticles = Array.from(map.values());
        saveStoredArticles(mergedArticles);
        return mergedArticles;
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

      let mergedLocations: EmplacementItem[] = [];
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
          mergedLocations = [...prev, ...toAdd];
          saveStoredLocations(mergedLocations);
          return mergedLocations;
        });
      }

      // Crucial: keep current inventory campaign updated so switching/refreshing never loses articles
      setInventories((prev) => {
        const updated = prev.map((inv) => {
          if (inv.id === activeInventoryId) {
            return {
              ...inv,
              articles: mergedArticles,
              locations: mergedLocations.length > 0 ? mergedLocations : inv.locations
            };
          }
          return inv;
        });
        saveStoredInventories(updated);
        return updated;
      });

      syncService.sendAction('IMPORT_ARTICLES', {
        newArticles,
        newMachines,
        newFamilles,
        newEmplacements
      });
    },
    [activeInventoryId]
  );

  const importLocationsBulk = useCallback(
    (locs: EmplacementItem[]) => {
      let merged: EmplacementItem[] = [];
      setLocations((prev) => {
        const map = new Map<string, EmplacementItem>();
        prev.forEach((l) => map.set(l.code.toLowerCase(), l));
        locs.forEach((l) => map.set(l.code.toLowerCase(), l));
        merged = Array.from(map.values());
        saveStoredLocations(merged);
        return merged;
      });

      setInventories((prev) => {
        const updated = prev.map((inv) => {
          if (inv.id === activeInventoryId) {
            return {
              ...inv,
              locations: merged
            };
          }
          return inv;
        });
        saveStoredInventories(updated);
        return updated;
      });

      syncService.sendAction('IMPORT_LOCATIONS', { newLocations: locs });
    },
    [activeInventoryId]
  );

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

  // User Authentication & Session Login (Mandatory at startup)
  const loginUser = useCallback((username: string, motDePasse: string): { success: boolean; message?: string } => {
    const trimmedUser = username.trim().toLowerCase();
    const trimmedPwd = motDePasse.trim();

    // Check in users list (case-insensitive username)
    const allUsers = getStoredUsers();
    let foundUser = allUsers.find((u) => u.username.toLowerCase() === trimmedUser);

    // Fallback for hardcoded admin credentials if ever desynced
    if (!foundUser && trimmedUser === 'ouaradtech' && trimmedPwd === 'Ouaradtech26@') {
      foundUser = {
        id: 'usr-admin-01',
        username: 'ouaradtech',
        nom: 'Mohamed Ouarad (Admin)',
        motDePasse: 'Ouaradtech26@',
        role: 'admin',
        actif: true,
        dateCreation: '2026-01-01T08:00:00.000Z'
      };
    }

    if (!foundUser) {
      return { success: false, message: "Nom d'utilisateur introuvable." };
    }

    if (foundUser.motDePasse !== trimmedPwd) {
      return { success: false, message: "Mot de passe incorrect." };
    }

    if (!foundUser.actif) {
      return { success: false, message: "Ce compte utilisateur est désactivé. Veuillez contacter l'administrateur." };
    }

    // Success! Update last login
    const updatedUser: AppUser = {
      ...foundUser,
      lastLogin: new Date().toISOString()
    };

    setUsers((prev) => {
      const next = prev.map((u) => (u.id === updatedUser.id ? updatedUser : u));
      saveStoredUsers(next);
      return next;
    });

    setCurrentUser(updatedUser);
    saveStoredCurrentUser(updatedUser);

    const displayName = updatedUser.nom || updatedUser.username;
    setOperatorState(displayName);
    saveStoredOperator(displayName);

    if (updatedUser.role === 'admin' || updatedUser.username.toLowerCase() === 'ouaradtech') {
      const auth: AdminAuthState = {
        isAdmin: true,
        username: updatedUser.username,
        lastLogin: new Date().toISOString()
      };
      setAdminAuth(auth);
      saveStoredAdminAuth(auth);
    } else {
      const auth: AdminAuthState = { isAdmin: false, username: null, lastLogin: null };
      setAdminAuth(auth);
      saveStoredAdminAuth(auth);
    }

    if (pendingAdminActionRef.current && (updatedUser.role === 'admin' || updatedUser.username.toLowerCase() === 'ouaradtech')) {
      const action = pendingAdminActionRef.current;
      pendingAdminActionRef.current = null;
      setTimeout(() => action(), 80);
    }

    return { success: true };
  }, []);

  const logoutUser = useCallback(() => {
    setCurrentUser(null);
    clearStoredCurrentUser();
    const auth: AdminAuthState = { isAdmin: false, username: null, lastLogin: null };
    setAdminAuth(auth);
    clearStoredAdminAuth();
  }, []);

  // Admin authentication helper (for inline password prompt modals)
  const loginAdmin = useCallback((login: string, mdp: string): boolean => {
    const res = loginUser(login, mdp);
    if (res.success) {
      const all = getStoredUsers();
      const user = all.find((u) => u.username.toLowerCase() === login.trim().toLowerCase());
      return user?.role === 'admin' || login.trim().toLowerCase() === 'ouaradtech';
    }
    return false;
  }, [loginUser]);

  const verifyAdminPassword = useCallback((password: string): boolean => {
    if (!password) return false;
    const trimmed = password.trim();
    // 1. Check against master admin password
    if (trimmed === ADMIN_CREDENTIALS.PASSWORD) return true;
    // 2. Check if currently logged in user is admin and has this password
    if (currentUser?.role === 'admin' && currentUser.motDePasse === trimmed) {
      return true;
    }
    // 3. Check all users in database with admin role or username ouaradtech
    const allUsers = getStoredUsers();
    return allUsers.some(
      (u) => (u.role === 'admin' || u.username.toLowerCase() === 'ouaradtech') && u.actif && u.motDePasse === trimmed
    );
  }, [currentUser]);

  const logoutAdmin = useCallback(() => {
    logoutUser();
  }, [logoutUser]);

  // User Management CRUD (for Administrator)
  const createUser = useCallback((userData: Omit<AppUser, 'id' | 'dateCreation'>): { success: boolean; message?: string; user?: AppUser } => {
    const trimmedUsername = userData.username.trim().toLowerCase();
    if (!trimmedUsername) {
      return { success: false, message: "L'identifiant est requis." };
    }
    if (!userData.motDePasse || userData.motDePasse.length < 2) {
      return { success: false, message: "Le mot de passe doit contenir au moins 2 caractères." };
    }

    let created: AppUser | undefined;
    let errorMsg: string | undefined;

    setUsers((prev) => {
      if (prev.some((u) => u.username.toLowerCase() === trimmedUsername)) {
        errorMsg = `L'identifiant "${userData.username}" est déjà utilisé.`;
        return prev;
      }

      created = {
        ...userData,
        id: `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        username: trimmedUsername,
        nom: userData.nom.trim() || trimmedUsername,
        motDePasse: userData.motDePasse.trim(),
        role: userData.role || 'operateur',
        actif: userData.actif !== false,
        dateCreation: new Date().toISOString()
      };

      const next = [...prev, created];
      saveStoredUsers(next);
      return next;
    });

    if (errorMsg) {
      return { success: false, message: errorMsg };
    }

    if (created) {
      syncService.sendAction('CREATE_USER', created);
    }

    return { success: true, user: created };
  }, []);

  const updateUser = useCallback((userData: AppUser): { success: boolean; message?: string } => {
    let errorMsg: string | undefined;

    setUsers((prev) => {
      const duplicate = prev.some(
        (u) => u.id !== userData.id && u.username.toLowerCase() === userData.username.trim().toLowerCase()
      );
      if (duplicate) {
        errorMsg = `L'identifiant "${userData.username}" est déjà utilisé par un autre utilisateur.`;
        return prev;
      }

      const next = prev.map((u) => (u.id === userData.id ? { ...userData, username: userData.username.trim().toLowerCase() } : u));
      saveStoredUsers(next);

      if (currentUser && currentUser.id === userData.id) {
        setCurrentUser(userData);
        saveStoredCurrentUser(userData);
      }

      return next;
    });

    if (errorMsg) {
      return { success: false, message: errorMsg };
    }

    syncService.sendAction('UPDATE_USER', userData);
    return { success: true };
  }, [currentUser]);

  const deleteUser = useCallback((userId: string): { success: boolean; message?: string } => {
    const target = users.find((u) => u.id === userId);
    if (target?.username.toLowerCase() === 'ouaradtech') {
      return { success: false, message: "Impossible de supprimer l'administrateur principal (ouaradtech)." };
    }

    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== userId);
      saveStoredUsers(next);
      return next;
    });

    syncService.sendAction('DELETE_USER', userId);
    return { success: true };
  }, [users]);

  const toggleUserActive = useCallback((userId: string) => {
    setUsers((prev) => {
      const target = prev.find((u) => u.id === userId);
      if (target?.username.toLowerCase() === 'ouaradtech') {
        return prev;
      }
      const updatedUser = target ? { ...target, actif: !target.actif } : null;
      const next = prev.map((u) => (u.id === userId ? { ...u, actif: !u.actif } : u));
      saveStoredUsers(next);
      if (updatedUser) {
        syncService.sendAction('UPDATE_USER', updatedUser);
      }
      return next;
    });
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

      syncService.sendAction('SWITCH_INVENTORY', { inventoryId: target.id, id: target.id });
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
    const dateCloture = new Date().toISOString();
    setInventories((prev) => {
      const next = prev.map((inv) =>
        inv.id === id ? { ...inv, statut: 'cloture' as const, dateCloture } : inv
      );
      saveStoredInventories(next);
      return next;
    });
    syncService.sendAction('UPDATE_INVENTORY', { id, statut: 'cloture', dateCloture });
  }, []);

  const reopenInventory = useCallback((id: string) => {
    setInventories((prev) => {
      const next = prev.map((inv) =>
        inv.id === id ? { ...inv, statut: 'en_cours' as const, dateCloture: undefined } : inv
      );
      saveStoredInventories(next);
      return next;
    });
    syncService.sendAction('UPDATE_INVENTORY', { id, statut: 'en_cours', dateCloture: undefined });
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

        // User Accounts & Mandatory Session
        currentUser,
        users,
        loginUser,
        logoutUser,
        createUser,
        updateUser,
        deleteUser,
        toggleUserActive,

        // Admin Auth & Control
        isAdmin: adminAuth.isAdmin,
        adminUser: adminAuth.username,
        loginAdmin,
        verifyAdminPassword,
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
        deleteEntriesBulk,
        addArticle,
        addManualArticle,
        updateArticle,
        deleteArticle,
        deleteArticlesBulk,
        deleteCombinedRowsBulk,
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
