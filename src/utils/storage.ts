import { Article, InventoryEntry, EmplacementItem, InventoryCampaign } from '../types/inventory';

const STORAGE_KEYS = {
  ARTICLES: 'inventaire_articles_v4',
  ENTRIES: 'inventaire_entries_v4',
  LOCATIONS: 'inventaire_locations_v4',
  FAMILLES: 'inventaire_familles_v4',
  MACHINES: 'inventaire_machines_v4',
  OPERATOR: 'inventaire_operator_v4',
  ROOM_CODE: 'inventaire_sync_room_v4',
  LAST_LOCATION: 'inventaire_last_location_v4',
  INVENTORIES: 'inventaire_campaigns_v5',
  ACTIVE_INVENTORY_ID: 'inventaire_active_id_v5',
  ADMIN_AUTH: 'inventaire_admin_auth_v5'
};

export function getStoredAdminAuth(): { isAdmin: boolean; username: string | null; lastLogin: string | null } {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    // ignore
  }
  return { isAdmin: false, username: null, lastLogin: null };
}

export function saveStoredAdminAuth(auth: { isAdmin: boolean; username: string | null; lastLogin: string | null }): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(auth));
    notifySyncChannel('ADMIN_AUTH_UPDATED', auth);
  } catch (e) {
    // ignore
  }
}

export function clearStoredAdminAuth(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
    notifySyncChannel('ADMIN_AUTH_UPDATED', { isAdmin: false, username: null, lastLogin: null });
  } catch (e) {
    // ignore
  }
}

export function getStoredInventories(): InventoryCampaign[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.INVENTORIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    // fallback
  }

  // Initial default campaign
  const defaultInv: InventoryCampaign = {
    id: 'inv-default-01',
    titre: 'Inventaire Principal 2026',
    code: 'INV-2026-01',
    description: 'Campagne principale d\'inventaire initial',
    dateCreation: new Date().toISOString(),
    statut: 'en_cours',
    responsable: 'ouaradtech',
    articles: getStoredArticles(),
    entries: getStoredEntries(),
    locations: getStoredLocations(),
    familles: getStoredFamilles(),
    machines: getStoredMachines(),
    lastLocation: getStoredLastLocation()
  };
  saveStoredInventories([defaultInv]);
  saveStoredActiveInventoryId(defaultInv.id);
  return [defaultInv];
}

export function saveStoredInventories(inventories: InventoryCampaign[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INVENTORIES, JSON.stringify(inventories));
    notifySyncChannel('INVENTORIES_UPDATED', inventories);
  } catch (e) {
    console.error('Erreur sauvegarde inventaires:', e);
  }
}

export function getStoredActiveInventoryId(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_INVENTORY_ID) || '';
  } catch (e) {
    return '';
  }
}

export function saveStoredActiveInventoryId(id: string): void {
  try {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_INVENTORY_ID, id);
      notifySyncChannel('ACTIVE_INVENTORY_CHANGED', id);
    }
  } catch (e) {
    // ignore
  }
}

export function getStoredLastLocation(): string {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_LOCATION) || '';
  } catch (e) {
    return '';
  }
}

export function saveStoredLastLocation(location: string): void {
  try {
    if (location && location.trim()) {
      localStorage.setItem(STORAGE_KEYS.LAST_LOCATION, location.trim());
    }
  } catch (e) {
    // ignore
  }
}

// BASE VIDE AU 1ER DÉMARRAGE : retourne un tableau vide [] par défaut
export function getStoredArticles(): Article[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ARTICLES);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveStoredArticles(articles: Article[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ARTICLES, JSON.stringify(articles));
    notifySyncChannel('ARTICLES_UPDATED', articles);
  } catch (e) {
    console.error('Erreur sauvegarde articles:', e);
  }
}

export function getStoredEntries(): InventoryEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ENTRIES);
    if (!data) return [];
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveStoredEntries(entries: InventoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
    notifySyncChannel('ENTRIES_UPDATED', entries);
  } catch (e) {
    console.error('Erreur sauvegarde inventaire:', e);
  }
}

// Emplacements vides au 1er démarrage
export function getStoredLocations(): EmplacementItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveStoredLocations(locations: EmplacementItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LOCATIONS, JSON.stringify(locations));
    notifySyncChannel('LOCATIONS_UPDATED', locations);
  } catch (e) {
    console.error('Erreur sauvegarde emplacements:', e);
  }
}

// Familles vides au 1er démarrage
export function getStoredFamilles(): string[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.FAMILLES);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveStoredFamilles(familles: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FAMILLES, JSON.stringify(familles));
    notifySyncChannel('FAMILLES_UPDATED', familles);
  } catch (e) {
    console.error('Erreur sauvegarde familles:', e);
  }
}

// Machines vides au 1er démarrage
export function getStoredMachines(): string[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MACHINES);
    if (!data) {
      return [];
    }
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveStoredMachines(machines: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MACHINES, JSON.stringify(machines));
    notifySyncChannel('MACHINES_UPDATED', machines);
  } catch (e) {
    console.error('Erreur sauvegarde machines:', e);
  }
}

export function getStoredOperator(): string {
  return localStorage.getItem(STORAGE_KEYS.OPERATOR) || 'Opérateur';
}

export function saveStoredOperator(operator: string): void {
  localStorage.setItem(STORAGE_KEYS.OPERATOR, operator);
}

export function getStoredRoomCode(): string {
  let code = localStorage.getItem(STORAGE_KEYS.ROOM_CODE);
  if (!code) {
    code = 'INV-' + Math.floor(100 + Math.random() * 900);
    localStorage.setItem(STORAGE_KEYS.ROOM_CODE, code);
  }
  return code;
}

export function saveStoredRoomCode(code: string): void {
  localStorage.setItem(STORAGE_KEYS.ROOM_CODE, code.toUpperCase().trim());
}

// Effacer toutes les données locales pour redémarrer à zéro
export function clearAllLocalDatabase(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ARTICLES);
    localStorage.removeItem(STORAGE_KEYS.ENTRIES);
    localStorage.removeItem(STORAGE_KEYS.LOCATIONS);
    localStorage.removeItem(STORAGE_KEYS.FAMILLES);
    localStorage.removeItem(STORAGE_KEYS.MACHINES);
    localStorage.removeItem(STORAGE_KEYS.LAST_LOCATION);
    // Nettoyer aussi les anciennes versions si présentes
    for (let i = 1; i <= 3; i++) {
      localStorage.removeItem(`inventaire_articles_v${i}`);
      localStorage.removeItem(`inventaire_entries_v${i}`);
      localStorage.removeItem(`inventaire_locations_v${i}`);
      localStorage.removeItem(`inventaire_familles_v${i}`);
      localStorage.removeItem(`inventaire_machines_v${i}`);
    }
    notifySyncChannel('DATABASE_CLEARED', null);
  } catch (e) {
    console.error('Erreur effacement base locale:', e);
  }
}

// BroadcastChannel pour synchronisation entre onglets / appareils
let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('inventaire_realtime_sync_v4');
  }
} catch (e) {
  console.warn('BroadcastChannel non supporté');
}

function notifySyncChannel(type: string, payload: any) {
  if (syncChannel) {
    try {
      syncChannel.postMessage({ type, payload, timestamp: Date.now() });
    } catch (e) {
      // ignore
    }
  }
}

export function subscribeToSyncChannel(callback: (type: string, payload: any) => void): () => void {
  if (!syncChannel) return () => {};
  
  const handler = (event: MessageEvent) => {
    if (event.data && event.data.type) {
      callback(event.data.type, event.data.payload);
    }
  };

  syncChannel.addEventListener('message', handler);
  return () => {
    syncChannel?.removeEventListener('message', handler);
  };
}

// Sauvegarde JSON complète
export function exportFullJsonBackup(): void {
  const backup = {
    version: '4.0',
    exportDate: new Date().toISOString(),
    articles: getStoredArticles(),
    entries: getStoredEntries(),
    locations: getStoredLocations(),
    familles: getStoredFamilles(),
    machines: getStoredMachines(),
    operator: getStoredOperator(),
    lastLocation: getStoredLastLocation()
  };

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Inventaire_Sauvegarde_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importFullJsonBackup(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.articles && Array.isArray(data.articles)) saveStoredArticles(data.articles);
    if (data.entries && Array.isArray(data.entries)) saveStoredEntries(data.entries);
    if (data.locations && Array.isArray(data.locations)) saveStoredLocations(data.locations);
    if (data.familles && Array.isArray(data.familles)) saveStoredFamilles(data.familles);
    if (data.machines && Array.isArray(data.machines)) saveStoredMachines(data.machines);
    if (data.operator) saveStoredOperator(data.operator);
    if (data.lastLocation) saveStoredLastLocation(data.lastLocation);
    return true;
  } catch (e) {
    console.error('Erreur import JSON:', e);
    return false;
  }
}
