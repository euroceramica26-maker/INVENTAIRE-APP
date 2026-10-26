export type QualiteEtat = 
  | 'conforme'
  | 'bon_etat'
  | 'a_reparer'
  | 'degrade'
  | 'perime_rebut'
  | 'non_conforme';

export interface Article {
  id: string;
  code_article: string; // Code magasin
  designation: string; // Désignation
  reference: string; // Référence manuel
  famille: string; // Famaille / Famille
  sous_famille?: string; // S.famaille / Sous-famille
  depart?: string; // Départ
  machine: string; // Machine / Départ
  position?: string; // Position
  emplacement: string; // Position / Emplacement
  unite: string; // Unité
  gere_nn?: string; // Géré /nn
  quantite?: number;
  prix_unitaire?: number;
  qr_code?: string;
  notes?: string;
  status?: 'saisi' | 'a_faire';
}

export interface InventoryEntry {
  id: string;
  articleId?: string;
  code_article: string; // Code magasin
  designation: string; // Désignation
  reference: string; // Référence manuel
  famille: string; // Famaille / Famille
  sous_famille?: string; // S.famaille
  depart?: string; // Départ
  machine: string; // Machine / Départ
  position?: string; // Position
  emplacement: string; // Position / Emplacement
  unite: string; // Unité
  gere_nn?: string; // Géré /nn
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
  // Ordre exact des 9 colonnes détectées (voir modèle utilisateur)
  famille: string; // 1. Famaille
  sous_famille: string; // 2. S.famaille
  depart: string; // 3. Départ
  position: string; // 4. Position
  designation: string; // 5. Désignation
  reference: string; // 6. Référence manuel
  code_article: string; // 7. Code magasin
  unite: string; // 8. Unité
  gere_nn: string; // 9. Géré /nn
  quantite: string; // Quantité optionnelle
  prix_unitaire: string; // Prix unitaire optionnel
  machine?: string; // Alias rétrocompatibilité
  emplacement?: string; // Alias rétrocompatibilité
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
  operator?: string; // 'all' or specific operator
}

export interface ExportCombinedItem {
  id: string;
  code_article: string;
  designation: string;
  reference: string;
  famille: string;
  sous_famille?: string;
  depart?: string;
  machine: string;
  position?: string;
  emplacement: string;
  unite: string;
  gere_nn?: string;
  stock_interne: number; // Stock interne total initial / théorique (Catalogue)
  quantite: number | ''; // Quantité comptée lors de l'inventaire
  ecart_stock?: number | ''; // Écart: Quantité comptée - Stock interne
  qualite: string;
  statutInventaire: 'Saisi' | 'À faire (Non inventorié)';
  timestamp: string;
  operator: string; // Opérateur qui a réalisé l'inventaire (ou '-' si en attente)
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

export type UserRole = 'admin' | 'operateur';

export interface AppUser {
  id: string;
  username: string;
  nom: string;
  motDePasse: string;
  role: UserRole;
  actif: boolean;
  dateCreation: string;
  lastLogin?: string;
  telephone?: string;
}

export interface CreateInventoryOptions {
  titre: string;
  code: string;
  description?: string;
  responsable?: string;
  copyFromCatalog?: boolean;
  switchToNew?: boolean;
}
