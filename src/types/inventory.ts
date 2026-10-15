export type QualiteEtat = 
  | 'conforme'
  | 'bon_etat'
  | 'a_reparer'
  | 'degrade'
  | 'perime_rebut'
  | 'non_conforme';

export interface Article {
  id: string;
  code_article: string;
  designation: string;
  reference: string;
  famille: string;
  machine: string;
  unite: string;
  emplacement: string;
  quantite?: number;
  prix_unitaire?: number;
  qr_code?: string;
  notes?: string;
}

export interface InventoryEntry {
  id: string;
  articleId?: string;
  code_article: string;
  designation: string;
  reference: string;
  famille: string;
  machine: string;
  unite: string;
  emplacement: string;
  quantite: number;
  qualite: QualiteEtat;
  notes: string;
  timestamp: string; // ISO format
  operator: string;
  status: 'valide' | 'a_verifier' | 'brouillon';
  syncStatus: 'synced' | 'pending' | 'local';
}

export interface EmplacementItem {
  id: string;
  code: string;
  nom: string;
  zone: string;
  description?: string;
}

export interface ColumnMapping {
  code_article: string;
  designation: string;
  reference: string;
  famille: string;
  machine: string;
  unite: string;
  emplacement: string;
  quantite: string;
  prix_unitaire: string;
}

export interface ExportFilters {
  famille: string; // 'all' or specific family
  machine: string; // 'all' or specific machine
  designationSearch: string;
  codeSearch: string;
  referenceSearch: string;
  unite: string; // 'all' or specific unit
  emplacement: string; // 'all' or specific
  qualite: string; // 'all' or specific
  statusFilter: 'all' | 'saisi' | 'a_faire'; // 'all' or 'saisi' or 'a_faire'
}

export interface ExportCombinedItem {
  id: string;
  code_article: string;
  designation: string;
  reference: string;
  famille: string;
  machine: string;
  emplacement: string;
  unite: string;
  quantite: number | '';
  qualite: string;
  statutInventaire: 'Saisi' | 'À faire (Non inventorié)';
  timestamp: string;
  operator: string;
  notes: string;
}

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  pendingCount: number;
  roomCode: string;
  peerCount: number;
}
