import * as XLSX from 'xlsx';
import { Article, ColumnMapping, EmplacementItem } from '../types/inventory';
import { downloadWorkbook } from './excelExport';

function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    famille: '',
    sous_famille: '',
    depart: '',
    position: '',
    designation: '',
    reference: '',
    code_article: '',
    unite: '',
    gere_nn: '',
    quantite: '',
    prix_unitaire: '',
    machine: '',
    emplacement: ''
  };

  // PASS 1: Détection prioritaire exacte ou quasi-exacte selon les 9 colonnes du modèle
  // 1. Famaille | 2. S.famaille | 3. Départ | 4. Position | 5. Désignation | 6. Référence manuel | 7. Code magasin | 8. Unité | 9. Géré /nn
  headers.forEach(h => {
    const rawLower = h.toLowerCase().trim();
    const norm = normalizeHeader(h);

    // 1. Famaille / Famille
    if (!mapping.famille && (norm === 'famaille' || norm === 'famille' || norm === 'fam' || rawLower === 'famaille' || rawLower === 'famille')) {
      mapping.famille = h;
      return;
    }

    // 2. S.famaille / S.famille / Sous-famille
    if (!mapping.sous_famille && (
      rawLower === 's.famaille' ||
      rawLower === 's.famille' ||
      rawLower === 's_famaille' ||
      rawLower === 's_famille' ||
      rawLower === 's. famaille' ||
      rawLower === 's. famille' ||
      norm === 'sfamaille' ||
      norm === 'sfamille' ||
      norm === 'sousfamille' ||
      norm === 'sousfamaille'
    )) {
      mapping.sous_famille = h;
      return;
    }

    // 3. Départ (Départ / Machine)
    if (!mapping.depart && (norm === 'depart' || norm === 'dept' || norm === 'machine' || norm === 'atelier' || norm === 'secteur')) {
      mapping.depart = h;
      mapping.machine = h;
      return;
    }

    // 4. Position (Position / Emplacement)
    if (!mapping.position && (norm === 'position' || norm === 'pos' || norm === 'emplacement' || norm === 'casier' || norm === 'bac' || norm === 'rayon')) {
      mapping.position = h;
      mapping.emplacement = h;
      return;
    }

    // 5. Désignation
    if (!mapping.designation && (norm === 'designation' || norm === 'nom' || norm === 'libelle' || norm === 'description' || norm === 'article')) {
      mapping.designation = h;
      return;
    }

    // 6. Référence manuel
    if (!mapping.reference && (
      rawLower.includes('référence manuel') ||
      rawLower.includes('reference manuel') ||
      rawLower.includes('ref manuel') ||
      norm === 'referencemanuel' ||
      norm === 'refmanuel' ||
      norm === 'reference' ||
      norm === 'ref'
    )) {
      mapping.reference = h;
      return;
    }

    // 7. Code magasin
    if (!mapping.code_article && (
      rawLower.includes('code magasin') ||
      rawLower.includes('code_magasin') ||
      norm === 'codemagasin' ||
      norm === 'codearticle' ||
      norm === 'codeart' ||
      norm === 'code' ||
      norm === 'magasin'
    )) {
      mapping.code_article = h;
      return;
    }

    // 8. Unité
    if (!mapping.unite && (norm === 'unite' || norm === 'unit' || norm === 'uom' || norm === 'u')) {
      mapping.unite = h;
      return;
    }

    // 9. Géré /nn
    if (!mapping.gere_nn && (
      rawLower.includes('/nn') ||
      rawLower.includes('/ nn') ||
      rawLower.includes('géré') ||
      rawLower.includes('gere') ||
      norm === 'gerenn' ||
      norm === 'gnn' ||
      norm === 'gestion'
    )) {
      mapping.gere_nn = h;
      return;
    }
  });

  // PASS 2: Heuristiques secondaires pour colonnes restantes non encore associées
  headers.forEach(h => {
    const rawLower = h.toLowerCase().trim();
    const norm = normalizeHeader(h);

    // 2. S.famaille
    if (!mapping.sous_famille && (
      rawLower.startsWith('s.') ||
      rawLower.startsWith('s_') ||
      rawLower.includes('sfam') ||
      norm.includes('sfam') ||
      norm.includes('sousfam') ||
      norm.includes('subfam')
    )) {
      mapping.sous_famille = h;
      return;
    }

    // 1. Famaille
    if (!mapping.famille && (
      norm.includes('famail') ||
      norm.includes('famill') ||
      norm.includes('fam') ||
      norm.includes('cat') ||
      norm.includes('group')
    )) {
      mapping.famille = h;
      return;
    }

    // 3. Départ
    if (!mapping.depart && (
      norm.includes('depart') ||
      norm.includes('dept') ||
      norm.includes('mach') ||
      norm.includes('equip') ||
      norm.includes('lign') ||
      norm.includes('affect') ||
      norm.includes('secteur') ||
      norm.includes('atelier')
    )) {
      mapping.depart = h;
      mapping.machine = h;
      return;
    }

    // 4. Position
    if (!mapping.position && (
      norm.includes('posit') ||
      norm.includes('pos') ||
      norm.includes('empl') ||
      norm.includes('loc') ||
      norm.includes('casier') ||
      norm.includes('bac') ||
      norm.includes('rayon') ||
      norm.includes('zone')
    )) {
      mapping.position = h;
      mapping.emplacement = h;
      return;
    }

    // 5. Désignation
    if (!mapping.designation && (
      norm.includes('design') ||
      norm.includes('nom') ||
      norm.includes('libelle') ||
      norm.includes('desc') ||
      norm.includes('produit')
    )) {
      mapping.designation = h;
      return;
    }

    // 6. Référence manuel
    if (!mapping.reference && (
      norm.includes('manuel') ||
      norm.includes('ref') ||
      norm.includes('part') ||
      norm.includes('pn') ||
      norm.includes('modele')
    )) {
      mapping.reference = h;
      return;
    }

    // 7. Code magasin
    if (!mapping.code_article && (
      norm.includes('magasin') ||
      norm.includes('code') ||
      norm.includes('art') ||
      norm === 'id' ||
      norm.includes('sku') ||
      norm.includes('item')
    )) {
      mapping.code_article = h;
      return;
    }

    // 8. Unité
    if (!mapping.unite && (
      norm.includes('unit') ||
      norm.includes('uom') ||
      norm === 'u'
    )) {
      mapping.unite = h;
      return;
    }

    // 9. Géré /nn
    if (!mapping.gere_nn && (
      rawLower.includes('gér') ||
      rawLower.includes('ger') ||
      rawLower.includes('/nn') ||
      norm.includes('gerenn') ||
      norm.includes('gestion') ||
      norm.includes('gest') ||
      norm === 'nn'
    )) {
      mapping.gere_nn = h;
      return;
    }

    // Optionnels
    if (!mapping.quantite && (norm.includes('qte') || norm.includes('quant') || norm.includes('stock'))) {
      mapping.quantite = h;
      return;
    }
    if (!mapping.prix_unitaire && (norm.includes('prix') || norm.includes('pu') || norm.includes('cout') || norm.includes('valeur'))) {
      mapping.prix_unitaire = h;
      return;
    }
  });

  // Synchronisation des alias rétrocompatibles
  if (!mapping.machine && mapping.depart) mapping.machine = mapping.depart;
  if (!mapping.emplacement && mapping.position) mapping.emplacement = mapping.position;
  if (!mapping.depart && mapping.machine) mapping.depart = mapping.machine;
  if (!mapping.position && mapping.emplacement) mapping.position = mapping.emplacement;

  return mapping;
}

export interface ParsedExcelResult {
  sheetNames: string[];
  selectedSheet: string;
  headers: string[];
  rawRows: Record<string, any>[];
  detectedMapping: ColumnMapping;
}

export async function parseExcelFile(file: File): Promise<ParsedExcelResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });

  const firstSheetName = workbook.SheetNames[0] || '';
  const worksheet = workbook.Sheets[firstSheetName];
  
  if (!worksheet) {
    throw new Error('Feuille de calcul vide ou introuvable');
  }

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  
  const headersSet = new Set<string>();
  rawRows.forEach(row => {
    Object.keys(row).forEach(k => headersSet.add(k));
  });
  const headers = Array.from(headersSet);
  const detectedMapping = detectColumnMapping(headers);

  return {
    sheetNames: workbook.SheetNames,
    selectedSheet: firstSheetName,
    headers,
    rawRows,
    detectedMapping
  };
}

export function convertRawRowsToArticles(
  rawRows: Record<string, any>[],
  mapping: ColumnMapping
): { articles: Article[]; newMachines: string[]; newFamilles: string[]; newEmplacements: string[] } {
  const articles: Article[] = [];
  const machinesSet = new Set<string>();
  const famillesSet = new Set<string>();
  const emplacementsSet = new Set<string>();

  rawRows.forEach((row, index) => {
    // 1. Famaille (Famille)
    const famille = String(row[mapping.famille] || 'Général').trim() || 'Général';
    
    // 2. S.famaille (Sous-famille)
    const sous_famille = mapping.sous_famille ? String(row[mapping.sous_famille] || '').trim() : '';

    // 3. Départ (Machine / Département)
    const depart = String(
      (mapping.depart ? row[mapping.depart] : '') ||
      (mapping.machine ? row[mapping.machine] : '') ||
      'Standard'
    ).trim() || 'Standard';
    const machine = depart;

    // 4. Position (Emplacement)
    const position = String(
      (mapping.position ? row[mapping.position] : '') ||
      (mapping.emplacement ? row[mapping.emplacement] : '') ||
      'Non renseigné'
    ).trim() || 'Non renseigné';
    const emplacement = position;

    // 5. Désignation
    const designation = String(row[mapping.designation] || '').trim();

    // 6. Référence manuel
    const reference = String(row[mapping.reference] || '-').trim() || '-';

    // 7. Code magasin (Code article)
    const code = String(row[mapping.code_article] || '').trim();

    // 8. Unité
    const unite = String(row[mapping.unite] || 'Pièce').trim() || 'Pièce';

    // 9. Géré /nn (Géré ou non géré)
    const gere_nn = mapping.gere_nn ? String(row[mapping.gere_nn] || 'G').trim() : 'G';
    
    // Ignorer si aucun code ni désignation
    if (!code && !designation) return;

    const qtyVal = mapping.quantite ? (parseFloat(String(row[mapping.quantite]).replace(',', '.')) || 0) : 0;
    const prixVal = mapping.prix_unitaire ? (parseFloat(String(row[mapping.prix_unitaire]).replace(',', '.')) || 0) : undefined;

    if (depart && depart !== 'Standard') machinesSet.add(depart);
    if (famille && famille !== 'Général') famillesSet.add(famille);
    if (position && position !== 'Non renseigné') emplacementsSet.add(position);

    articles.push({
      id: `art-import-${Date.now()}-${index}`,
      code_article: code || `ART-${index + 1}`,
      designation: designation || `Article ${code}`,
      reference: reference || '-',
      famille,
      sous_famille,
      depart,
      machine,
      position,
      emplacement,
      unite,
      gere_nn,
      quantite: qtyVal,
      prix_unitaire: prixVal,
      qr_code: code || `ART-${index + 1}`
    });
  });

  return {
    articles,
    newMachines: Array.from(machinesSet),
    newFamilles: Array.from(famillesSet),
    newEmplacements: Array.from(emplacementsSet)
  };
}

export function parseEmplacementsExcel(rawRows: Record<string, any>[]): EmplacementItem[] {
  const emplacements: EmplacementItem[] = [];
  
  rawRows.forEach((row, idx) => {
    const keys = Object.keys(row);
    let code = '';
    let nom = '';
    let zone = '';

    keys.forEach(k => {
      const norm = normalizeHeader(k);
      if (norm.includes('code') || norm.includes('id') || norm.includes('bac') || norm.includes('casier') || norm.includes('pos')) {
        code = String(row[k]);
      } else if (norm.includes('nom') || norm.includes('lib') || norm.includes('desig')) {
        nom = String(row[k]);
      } else if (norm.includes('zone') || norm.includes('secteur') || norm.includes('mag') || norm.includes('depart')) {
        zone = String(row[k]);
      }
    });

    if (!code && keys[0]) code = String(row[keys[0]]);
    if (!nom && keys[1]) nom = String(row[keys[1]]);
    if (!zone && keys[2]) zone = String(row[keys[2]]);

    if (code || nom) {
      emplacements.push({
        id: `loc-imp-${Date.now()}-${idx}`,
        code: (code || nom).trim(),
        nom: (nom || code).trim(),
        zone: (zone || 'Général').trim()
      });
    }
  });

  return emplacements;
}

export function generateSampleArticlesExcel(): void {
  // Format exact des 9 colonnes demandées (voir image modèle utilisateur)
  const sampleData = [
    {
      'Famaille': 'MÉCANIQUE',
      'S.famaille': 'ROULEMENTS',
      'Départ': 'LIGNE-01',
      'Position': 'MAG-A-01',
      'Désignation': 'Roulement rigide à billes 6205-2RSH',
      'Référence manuel': 'SKF-6205-2RSH',
      'Code magasin': 'MAG-100234',
      'Unité': 'Pièce',
      'Géré /nn': 'G'
    },
    {
      'Famaille': 'ÉLECTRIQUE',
      'S.famaille': 'DISJONCTEURS',
      'Départ': 'TGBT-ATELIER',
      'Position': 'CAS-E-12',
      'Désignation': 'Disjoncteur modulaire 16A courbe C',
      'Référence manuel': 'SCH-A9F74116',
      'Code magasin': 'MAG-100876',
      'Unité': 'Pièce',
      'Géré /nn': 'G'
    },
    {
      'Famaille': 'PNEUMATIQUE',
      'S.famaille': 'RACCORDS',
      'Départ': 'EMBALLAGE',
      'Position': 'BAC-P-04',
      'Désignation': 'Raccord instantané droit Ø8 G1/4',
      'Référence manuel': 'FES-QS-G1/4-8',
      'Code magasin': 'MAG-101452',
      'Unité': 'Sachet',
      'Géré /nn': 'NN'
    },
    {
      'Famaille': 'HYDRAULIQUE',
      'S.famaille': 'JOINTS',
      'Départ': 'PRESSE-02',
      'Position': 'RAY-H-03',
      'Désignation': 'Joint torique NBR 70 Shore 25x3',
      'Référence manuel': 'JT-NBR-25X3',
      'Code magasin': 'MAG-102198',
      'Unité': 'Pièce',
      'Géré /nn': 'G'
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData, {
    header: [
      'Famaille',
      'S.famaille',
      'Départ',
      'Position',
      'Désignation',
      'Référence manuel',
      'Code magasin',
      'Unité',
      'Géré /nn'
    ]
  });

  // Définir des largeurs de colonnes confortables
  ws['!cols'] = [
    { wch: 16 }, // Famaille
    { wch: 16 }, // S.famaille
    { wch: 16 }, // Départ
    { wch: 14 }, // Position
    { wch: 38 }, // Désignation
    { wch: 20 }, // Référence manuel
    { wch: 16 }, // Code magasin
    { wch: 10 }, // Unité
    { wch: 12 }  // Géré /nn
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Articles');
  downloadWorkbook(wb, 'Modele_Articles_Inventaire.xlsx');
}

export function generateSampleLocationsExcel(): void {
  const sampleData = [
    { 'Code Emplacement': 'MAG-A-01', 'Nom Emplacement': 'Magasin Principal - Rayon 1', 'Zone / Bâtiment': 'Zone Centrale' },
    { 'Code Emplacement': 'CAS-E-12', 'Nom Emplacement': 'Casier Électrique Atelier', 'Zone / Bâtiment': 'Atelier Maintenance' },
    { 'Code Emplacement': 'BAC-P-04', 'Nom Emplacement': 'Bac Pneumatique Ligne 1', 'Zone / Bâtiment': 'Conditionnement' }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws['!cols'] = [
    { wch: 18 },
    { wch: 32 },
    { wch: 22 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Emplacements');
  downloadWorkbook(wb, 'Modele_Emplacements.xlsx');
}
