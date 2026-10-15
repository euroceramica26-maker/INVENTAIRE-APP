import { Article, InventoryEntry, EmplacementItem } from '../types/inventory';
import { INITIAL_ARTICLES, INITIAL_EMPLACEMENTS, INITIAL_FAMILLES, INITIAL_MACHINES } from '../data/initialCatalog';

const STORAGE_KEYS = {
  ARTICLES: 'inventaire_articles_v2',
  ENTRIES: 'inventaire_entries_v2',
  LOCATIONS: 'inventaire_locations_v2',
  FAMILLES: 'inventaire_familles_v2',
  MACHINES: 'inventaire_machines_v2',
  OPERATOR: 'inventaire_operator_v2',
  ROOM_CODE: 'inventaire_sync_room_v2',
  LAST_LOCATION: 'inventaire_last_location_v2'
};

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

export function getStoredArticles(): Article[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.ARTICLES);
    if (!data) {
      saveStoredArticles(INITIAL_ARTICLES);
      return INITIAL_ARTICLES;
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

export function getStoredLocations(): EmplacementItem[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOCATIONS);
    if (!data) {
      saveStoredLocations(INITIAL_EMPLACEMENTS);
      return INITIAL_EMPLACEMENTS;
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

export function getStoredFamilles(): string[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.FAMILLES);
    if (!data) {
      saveStoredFamilles(INITIAL_FAMILLES);
      return INITIAL_FAMILLES;
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

export function getStoredMachines(): string[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.MACHINES);
    if (!data) {
      saveStoredMachines(INITIAL_MACHINES);
      return INITIAL_MACHINES;
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

// Clear all local data to start 100% fresh
export function clearAllLocalDatabase(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ARTICLES);
    localStorage.removeItem(STORAGE_KEYS.ENTRIES);
    localStorage.removeItem(STORAGE_KEYS.LOCATIONS);
    localStorage.removeItem(STORAGE_KEYS.FAMILLES);
    localStorage.removeItem(STORAGE_KEYS.MACHINES);
    notifySyncChannel('DATABASE_CLEARED', null);
  } catch (e) {
    console.error('Erreur effacement base locale:', e);
  }
}

// BroadcastChannel for cross-tab synchronization
let syncChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    syncChannel = new BroadcastChannel('inventaire_realtime_sync_v2');
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

// Backup JSON
export function exportFullJsonBackup(): void {
  const backup = {
    version: '2.0',
    exportDate: new Date().toISOString(),
    articles: getStoredArticles(),
    entries: getStoredEntries(),
    locations: getStoredLocations(),
    familles: getStoredFamilles(),
    machines: getStoredMachines(),
    operator: getStoredOperator()
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
    return true;
  } catch (e) {
    console.error('Erreur import JSON:', e);
    return false;
  }
}
