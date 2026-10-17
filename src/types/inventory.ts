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
  status?: 'saisi' | 'a_faire';
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
  status: 'valide' | 'a_verifier' | 'brouillon' | 'saisi';
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

export type InventoryStatus = 'en_cours' | 'cloture' | 'archive';

export interface InventoryCampaign {
  id: string;
  titre: string;
  code: string;
  description?: string;
  dateCreation: string;
  dateCloture?: string;
  statut: InventoryStatus;
  responsable: string;
  articles: Article[];
  entries: InventoryEntry[];
  locations: EmplacementItem[];
  familles: string[];
  machines: string[];
  lastLocation?: string;
}

export interface AdminAuthState {
  isAdmin: boolean;
  username: string | null;
  lastLogin: string | null;
}

export interface CreateInventoryOptions {
  titre: string;
  code: string;
  description?: string;
  responsable?: string;
  copyFromCatalog?: boolean;
  switchToNew?: boolean;
}
