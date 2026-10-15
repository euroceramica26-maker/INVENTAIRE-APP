import * as XLSX from 'xlsx';
import { Article, ColumnMapping, EmplacementItem } from '../types/inventory';

function normalizeHeader(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function detectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {
    code_article: '',
    designation: '',
    reference: '',
    famille: '',
    machine: '',
    unite: '',
    emplacement: '',
    quantite: '',
    prix_unitaire: ''
  };

  headers.forEach(h => {
    const norm = normalizeHeader(h);

    if (!mapping.code_article && (norm.includes('code') || norm.includes('art') || norm === 'id' || norm.includes('sku') || norm.includes('item'))) {
      mapping.code_article = h;
    } else if (!mapping.designation && (norm.includes('design') || norm.includes('nom') || norm.includes('libelle') || norm.includes('desc') || norm.includes('produit'))) {
      mapping.designation = h;
    } else if (!mapping.reference && (norm.includes('ref') || norm.includes('part') || norm.includes('pn') || norm.includes('modele'))) {
      mapping.reference = h;
    } else if (!mapping.famille && (norm.includes('fam') || norm.includes('cat') || norm.includes('group') || norm.includes('type'))) {
      mapping.famille = h;
    } else if (!mapping.machine && (norm.includes('mach') || norm.includes('equip') || norm.includes('lign') || norm.includes('affect'))) {
      mapping.machine = h;
    } else if (!mapping.unite && (norm.includes('unit') || norm.includes('uom') || norm === 'u')) {
      mapping.unite = h;
    } else if (!mapping.emplacement && (norm.includes('empl') || norm.includes('loc') || norm.includes('bac') || norm.includes('rayon') || norm.includes('casier') || norm.includes('zone'))) {
      mapping.emplacement = h;
    } else if (!mapping.quantite && (norm.includes('qte') || norm.includes('quant') || norm.includes('stock'))) {
      mapping.quantite = h;
    } else if (!mapping.prix_unitaire && (norm.includes('prix') || norm.includes('pu') || norm.includes('cout') || norm.includes('valeur'))) {
      mapping.prix_unitaire = h;
    }
  });

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
    const code = String(row[mapping.code_article] || '').trim();
    const designation = String(row[mapping.designation] || '').trim();
    
    if (!code && !designation) return;

    const reference = String(row[mapping.reference] || '').trim();
    const famille = String(row[mapping.famille] || 'Général').trim() || 'Général';
    const machine = String(row[mapping.machine] || 'Standard').trim() || 'Standard';
    const unite = String(row[mapping.unite] || 'Pièce').trim() || 'Pièce';
    const emplacement = String(row[mapping.emplacement] || 'Non renseigné').trim() || 'Non renseigné';
    
    const qtyVal = parseFloat(String(row[mapping.quantite]).replace(',', '.')) || 0;
    const prixVal = mapping.prix_unitaire ? (parseFloat(String(row[mapping.prix_unitaire]).replace(',', '.')) || 0) : undefined;

    if (machine) machinesSet.add(machine);
    if (famille) famillesSet.add(famille);
    if (emplacement && emplacement !== 'Non renseigné') emplacementsSet.add(emplacement);

    articles.push({
      id: `art-import-${Date.now()}-${index}`,
      code_article: code || `ART-${index + 1}`,
      designation: designation || `Article ${code}`,
      reference: reference || '-',
      famille,
      machine,
      unite,
      emplacement,
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
      if (norm.includes('code') || norm.includes('id') || norm.includes('bac') || norm.includes('casier')) {
        code = String(row[k]);
      } else if (norm.includes('nom') || norm.includes('lib') || norm.includes('desig')) {
        nom = String(row[k]);
      } else if (norm.includes('zone') || norm.includes('secteur') || norm.includes('mag')) {
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
  const sampleData = [
    {
      'Code Article': 'ART-001',
      'Désignation': 'Désignation de la pièce',
      'Référence Fabricant': 'REF-12345',
      'Famille': 'Famille Exemple',
      'Machine': 'Machine Exemple',
      'Unité': 'Pièce',
      'Emplacement': 'EMP-01',
      'Quantité': 10,
      'Prix Unitaire': 15.00
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Articles');
  XLSX.writeFile(wb, 'Modele_Articles.xlsx');
}

export function generateSampleLocationsExcel(): void {
  const sampleData = [
    { 'Code Emplacement': 'MAG-A-01', 'Nom Emplacement': 'Magasin Principal - Rayon 1', 'Zone / Bâtiment': 'Zone Centrale' }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Emplacements');
  XLSX.writeFile(wb, 'Modele_Emplacements.xlsx');
}
