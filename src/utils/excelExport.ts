import * as XLSX from 'xlsx';
import { InventoryEntry, Article, ExportFilters, ExportCombinedItem, QualiteEtat } from '../types/inventory';

export const QUALITE_LABELS: Record<QualiteEtat, string> = {
  conforme: 'Conforme / Neuf',
  bon_etat: 'Bon état de fonctionnement',
  a_reparer: 'À réparer / Révision',
  degrade: 'Dégradé / Usure anormale',
  perime_rebut: 'Périmé / Rebut',
  non_conforme: 'Non conforme'
};

export function buildCombinedInventoryList(
  entries: InventoryEntry[],
  articles: Article[]
): ExportCombinedItem[] {
  const combined: ExportCombinedItem[] = [];
  const accountedArticleCodes = new Set<string>();

  // Map of article code to catalog article for quick O(1) lookup
  const articleMap = new Map<string, Article>();
  articles.forEach((art) => {
    if (art.code_article) {
      articleMap.set(art.code_article.toLowerCase().trim(), art);
    }
  });

  // 1. Add all inventoried entries (Saisi)
  entries.forEach((entry) => {
    const codeLower = (entry.code_article || '').toLowerCase().trim();
    accountedArticleCodes.add(codeLower);
    const matchingArt = articleMap.get(codeLower);
    const departVal = entry.depart || entry.machine || matchingArt?.depart || matchingArt?.machine || 'Standard';
    
    // Priorité absolue à l'Emplacement Réel saisi lors de l'inventaire
    const entryLoc = (entry.emplacement || '').trim();
    const entryPos = (entry.position || '').trim();
    const cleanEntryLoc = (entryLoc && entryLoc !== 'Non renseigné' && entryLoc !== 'Non assigné') ? entryLoc : '';
    const cleanEntryPos = (entryPos && entryPos !== 'Non renseigné' && entryPos !== 'Non assigné') ? entryPos : '';
    const positionVal = cleanEntryLoc || cleanEntryPos || (entryLoc && entryLoc !== 'Non renseigné' ? entryLoc : 'Non assigné');

    // Stock interne initial théorique (Catalogue)
    const stockInterne = typeof matchingArt?.quantite === 'number' ? matchingArt.quantite : 0;
    const ecartStock = entry.quantite - stockInterne;

    combined.push({
      id: entry.id,
      code_article: entry.code_article,
      designation: entry.designation,
      reference: entry.reference || matchingArt?.reference || '-',
      famille: entry.famille || matchingArt?.famille || 'Général',
      sous_famille: entry.sous_famille || matchingArt?.sous_famille || '',
      depart: departVal,
      machine: departVal,
      position: positionVal,
      emplacement: positionVal,
      unite: entry.unite || matchingArt?.unite || 'Pièce',
      gere_nn: entry.gere_nn || matchingArt?.gere_nn || 'G',
      stock_interne: stockInterne,
      quantite: entry.quantite,
      ecart_stock: ecartStock,
      qualite: QUALITE_LABELS[entry.qualite] || entry.qualite,
      statutInventaire: 'Saisi',
      timestamp: entry.timestamp ? new Date(entry.timestamp).toLocaleString('fr-FR') : '-',
      operator: entry.operator || 'Opérateur',
      notes: entry.notes || ''
    });
  });

  // 2. Add all catalog articles that have NOT been inventoried yet (À faire)
  articles.forEach((art) => {
    const codeLower = (art.code_article || '').toLowerCase().trim();
    if (!accountedArticleCodes.has(codeLower)) {
      const isSaisi = art.status === 'saisi';
      const departVal = art.depart || art.machine || 'Standard';
      
      const artLoc = (art.emplacement || '').trim();
      const artPos = (art.position || '').trim();
      const cleanArtLoc = (artLoc && artLoc !== 'Non renseigné' && artLoc !== 'Non assigné') ? artLoc : '';
      const cleanArtPos = (artPos && artPos !== 'Non renseigné' && artPos !== 'Non assigné') ? artPos : '';
      const positionVal = cleanArtLoc || cleanArtPos || (artLoc && artLoc !== 'Non renseigné' ? artLoc : 'Non assigné');

      const stockInterne = typeof art.quantite === 'number' ? art.quantite : 0;
      const quantite = isSaisi ? (art.quantite || 1) : '';
      const ecartStock = isSaisi ? (Number(quantite) - stockInterne) : '';

      combined.push({
        id: `missing-${art.id}`,
        code_article: art.code_article,
        designation: art.designation,
        reference: art.reference || '-',
        famille: art.famille || 'Général',
        sous_famille: art.sous_famille || '',
        depart: departVal,
        machine: departVal,
        position: positionVal,
        emplacement: positionVal,
        unite: art.unite || 'Pièce',
        gere_nn: art.gere_nn || 'G',
        stock_interne: stockInterne,
        quantite: quantite,
        ecart_stock: ecartStock,
        qualite: isSaisi ? 'Conforme / Neuf' : 'En attente d\'inventaire',
        statutInventaire: isSaisi ? 'Saisi' : 'À faire (Non inventorié)',
        timestamp: '-',
        operator: isSaisi ? 'Opérateur' : '-',
        notes: isSaisi ? 'Article saisi manuellement' : 'Article non inventorié'
      });
    }
  });

  return combined;
}

export function filterCombinedInventory(
  items: ExportCombinedItem[],
  filters: ExportFilters
): ExportCombinedItem[] {
  return items.filter((item) => {
    // Filter by inventory status (all / saisi / a_faire)
    if (filters.statusFilter === 'saisi' && item.statutInventaire !== 'Saisi') {
      return false;
    }
    if (filters.statusFilter === 'a_faire' && item.statutInventaire !== 'À faire (Non inventorié)') {
      return false;
    }

    // Filter by famille
    if (filters.famille !== 'all' && item.famille !== filters.famille) {
      return false;
    }

    // Filter by machine
    if (filters.machine !== 'all' && item.machine !== filters.machine) {
      return false;
    }

    // Filter by unit
    if (filters.unite !== 'all' && item.unite !== filters.unite) {
      return false;
    }

    // Filter by emplacement
    if (filters.emplacement !== 'all' && item.emplacement !== filters.emplacement) {
      return false;
    }

    // Filter by qualite
    if (filters.qualite !== 'all') {
      const selectedLabel = QUALITE_LABELS[filters.qualite as QualiteEtat] || filters.qualite;
      if (item.qualite !== selectedLabel) {
        return false;
      }
    }

    // Filter by operator
    if (filters.operator && filters.operator !== 'all') {
      const opLower = (item.operator || '').toLowerCase();
      const targetOp = filters.operator.toLowerCase();
      if (opLower !== targetOp && !opLower.includes(targetOp)) {
        return false;
      }
    }

    // Filter by code article search
    if (filters.codeSearch.trim()) {
      const q = filters.codeSearch.toLowerCase().trim();
      if (!item.code_article.toLowerCase().includes(q)) {
        return false;
      }
    }

    // Filter by designation search
    if (filters.designationSearch.trim()) {
      const q = filters.designationSearch.toLowerCase().trim();
      if (!item.designation.toLowerCase().includes(q)) {
        return false;
      }
    }

    // Filter by reference search
    if (filters.referenceSearch.trim()) {
      const q = filters.referenceSearch.toLowerCase().trim();
      if (!item.reference.toLowerCase().includes(q)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Microsoft Excel strictly limits sheet names to 31 characters
 * and forbids: \ / ? * [ ] :
 */
export function safeAppendSheet(wb: XLSX.WorkBook, ws: XLSX.WorkSheet, name: string): void {
  const sanitized = name.replace(/[:\\/?*\[\]]/g, '_').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sanitized);
}

/**
 * Robust browser download helper supporting iframes, mobile, and desktop browsers
 */
export function downloadWorkbook(wb: XLSX.WorkBook, fileName: string): void {
  try {
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    if (typeof (navigator as any).msSaveBlob !== 'undefined') {
      (navigator as any).msSaveBlob(blob, fileName);
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }, 1500);
  } catch (err) {
    console.warn('[ExcelExport] Blob download failed, falling back to XLSX.writeFile:', err);
    XLSX.writeFile(wb, fileName);
  }
}

export function exportInventoryToExcel(
  entries: InventoryEntry[],
  articles: Article[],
  filters: ExportFilters,
  filenamePrefix = 'Inventaire_Global'
): { success: boolean; rowCount: number; fileName: string; countSaisis: number; countAFaire: number } {
  const allCombined = buildCombinedInventoryList(entries, articles);
  const filtered = filterCombinedInventory(allCombined, filters);

  const wb = XLSX.utils.book_new();

  // 1. Sheet: Inventaire_Global (Tous les articles avec statut Saisi ou À Faire)
  const rowsGlobal = filtered.map((item, idx) => {
    const isSaisi = item.statutInventaire === 'Saisi';
    const ecartVal = isSaisi
      ? (typeof item.ecart_stock === 'number'
          ? item.ecart_stock
          : (typeof item.quantite === 'number' ? item.quantite - item.stock_interne : 0))
      : 'En attente';

    return {
      'N°': idx + 1,
      'Statut Inventaire': item.statutInventaire,
      'Code magasin': item.code_article,
      'Désignation': item.designation,
      'Référence manuel': item.reference,
      'Famaille': item.famille || 'Général',
      'S.famaille': item.sous_famille || '',
      'Départ': item.depart || item.machine || 'Standard',
      'Position': item.position || '',
      'Emplacement': item.emplacement || item.position || 'Non assigné',
      'Unité': item.unite,
      'Géré /nn': item.gere_nn || 'G',
      'Stock Interne (Catalogue)': item.stock_interne,
      'Quantité Saisie (Physique)': item.quantite === '' ? 'Non saisi' : item.quantite,
      'Écart de Stock': ecartVal,
      'Qualité / État Réel': item.qualite,
      'Opérateur': item.operator || (isSaisi ? 'Opérateur' : 'En attente'),
      'Date & Heure': item.timestamp,
      'Remarques & Observations': item.notes
    };
  });

  const globalHeaders = [
    'N°',
    'Statut Inventaire',
    'Code magasin',
    'Désignation',
    'Référence manuel',
    'Famaille',
    'S.famaille',
    'Départ',
    'Position',
    'Emplacement',
    'Unité',
    'Géré /nn',
    'Stock Interne (Catalogue)',
    'Quantité Saisie (Physique)',
    'Écart de Stock',
    'Qualité / État Réel',
    'Opérateur',
    'Date & Heure',
    'Remarques & Observations'
  ];

  const wsGlobal = rowsGlobal.length > 0
    ? XLSX.utils.json_to_sheet(rowsGlobal)
    : XLSX.utils.json_to_sheet([], { header: globalHeaders });

  wsGlobal['!cols'] = [
    { wch: 6 },  // N°
    { wch: 22 }, // Statut Inventaire
    { wch: 18 }, // Code magasin
    { wch: 38 }, // Désignation
    { wch: 22 }, // Référence manuel
    { wch: 18 }, // Famaille
    { wch: 18 }, // S.famaille
    { wch: 18 }, // Départ
    { wch: 16 }, // Position
    { wch: 20 }, // Emplacement
    { wch: 10 }, // Unité
    { wch: 12 }, // Géré /nn
    { wch: 22 }, // Stock Interne (Catalogue)
    { wch: 24 }, // Quantité Saisie
    { wch: 16 }, // Écart de Stock
    { wch: 26 }, // Qualité
    { wch: 20 }, // Opérateur
    { wch: 20 }, // Date
    { wch: 30 }  // Notes
  ];

  safeAppendSheet(wb, wsGlobal, 'Inventaire_Global');

  // 2. Sheet: Articles_Non_Inventoriés (À faire pour contrôle)
  const aFaireItems = filtered.filter(i => i.statutInventaire === 'À faire (Non inventorié)');
  if (aFaireItems.length > 0) {
    const rowsAFaire = aFaireItems.map((item, idx) => ({
      'N°': idx + 1,
      'Statut': 'À FAIRE (NON INVENTORIÉ)',
      'Code magasin': item.code_article,
      'Désignation': item.designation,
      'Référence manuel': item.reference,
      'Famaille': item.famille || 'Général',
      'S.famaille': item.sous_famille || '',
      'Départ': item.depart || item.machine || 'Standard',
      'Position': item.position || '',
      'Emplacement': item.emplacement || item.position || 'Non assigné',
      'Unité': item.unite,
      'Géré /nn': item.gere_nn || 'G',
      'Stock Interne (Catalogue)': item.stock_interne,
      'Opérateur': 'Non inventorié / En attente'
    }));

    const wsAFaire = XLSX.utils.json_to_sheet(rowsAFaire);
    wsAFaire['!cols'] = [
      { wch: 6 },
      { wch: 26 },
      { wch: 18 },
      { wch: 38 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 16 },
      { wch: 20 },
      { wch: 10 },
      { wch: 12 },
      { wch: 22 },
      { wch: 24 }
    ];
    safeAppendSheet(wb, wsAFaire, 'Articles_À_Faire_Contrôle');
  }

  // 3. Sheet: Articles_Saisis
  const saisisItems = filtered.filter(i => i.statutInventaire === 'Saisi');
  if (saisisItems.length > 0) {
    const rowsSaisis = saisisItems.map((item, idx) => ({
      'N°': idx + 1,
      'Code Article': item.code_article,
      'Désignation': item.designation,
      'Référence Fabricant': item.reference,
      'Famille': item.famille,
      'Machine': item.machine,
      'Position': item.position || '',
      'Emplacement': item.emplacement || item.position || 'Non assigné',
      'Unité': item.unite,
      'Stock Interne (Catalogue)': item.stock_interne,
      'Quantité Comptée (Physique)': item.quantite,
      'Écart de Stock': typeof item.ecart_stock === 'number'
        ? item.ecart_stock
        : (typeof item.quantite === 'number' ? item.quantite - item.stock_interne : 0),
      'Qualité / État': item.qualite,
      'Opérateur': item.operator || 'Opérateur',
      'Date & Heure': item.timestamp,
      'Remarques': item.notes
    }));

    const wsSaisis = XLSX.utils.json_to_sheet(rowsSaisis);
    wsSaisis['!cols'] = [
      { wch: 6 },  // N°
      { wch: 18 }, // Code Article
      { wch: 38 }, // Désignation
      { wch: 22 }, // Référence Fabricant
      { wch: 18 }, // Famille
      { wch: 18 }, // Machine
      { wch: 16 }, // Position
      { wch: 20 }, // Emplacement
      { wch: 10 }, // Unité
      { wch: 22 }, // Stock Interne (Catalogue)
      { wch: 24 }, // Quantité Comptée
      { wch: 16 }, // Écart de Stock
      { wch: 26 }, // Qualité
      { wch: 22 }, // Opérateur
      { wch: 20 }, // Date
      { wch: 30 }  // Notes
    ];
    safeAppendSheet(wb, wsSaisis, 'Articles_Saisis');
  }

  // 4. Machine Summary Sheet (avec Stock Interne Total vs Quantité Totale Comptée)
  const machineMap = new Map<string, { total: number; saisis: number; aFaire: number; totalStockInterne: number; totalQty: number }>();
  filtered.forEach(item => {
    const m = item.machine || 'Non assigné';
    const curr = machineMap.get(m) || { total: 0, saisis: 0, aFaire: 0, totalStockInterne: 0, totalQty: 0 };
    curr.total += 1;
    curr.totalStockInterne += item.stock_interne || 0;
    if (item.statutInventaire === 'Saisi') {
      curr.saisis += 1;
      curr.totalQty += typeof item.quantite === 'number' ? item.quantite : 0;
    } else {
      curr.aFaire += 1;
    }
    machineMap.set(m, curr);
  });

  if (machineMap.size > 0) {
    const machineRows = Array.from(machineMap.entries()).map(([machine, stats]) => ({
      'Machine / Équipement': machine,
      'Total Articles Prévus': stats.total,
      'Articles Saisis': stats.saisis,
      'Articles À Faire (Non saisis)': stats.aFaire,
      'Taux d\'Avancement': stats.total > 0 ? `${Math.round((stats.saisis / stats.total) * 100)}%` : '0%',
      'Stock Interne Total': stats.totalStockInterne,
      'Quantité Totale Comptée': stats.totalQty,
      'Écart Global': stats.totalQty - stats.totalStockInterne
    }));

    const wsMachine = XLSX.utils.json_to_sheet(machineRows);
    wsMachine['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 16 }];
    safeAppendSheet(wb, wsMachine, 'Synthèse_Machines');
  }

  // 5. Family Summary Sheet (avec Stock Interne Total vs Quantité Totale Comptée)
  const familleMap = new Map<string, { total: number; saisis: number; aFaire: number; totalStockInterne: number; totalQty: number }>();
  filtered.forEach(item => {
    const f = item.famille || 'Général';
    const curr = familleMap.get(f) || { total: 0, saisis: 0, aFaire: 0, totalStockInterne: 0, totalQty: 0 };
    curr.total += 1;
    curr.totalStockInterne += item.stock_interne || 0;
    if (item.statutInventaire === 'Saisi') {
      curr.saisis += 1;
      curr.totalQty += typeof item.quantite === 'number' ? item.quantite : 0;
    } else {
      curr.aFaire += 1;
    }
    familleMap.set(f, curr);
  });

  if (familleMap.size > 0) {
    const familleRows = Array.from(familleMap.entries()).map(([famille, stats]) => ({
      'Famille / Catégorie': famille,
      'Total Articles Prévus': stats.total,
      'Articles Saisis': stats.saisis,
      'Articles À Faire (Non saisis)': stats.aFaire,
      'Taux d\'Avancement': stats.total > 0 ? `${Math.round((stats.saisis / stats.total) * 100)}%` : '0%',
      'Stock Interne Total': stats.totalStockInterne,
      'Quantité Totale Comptée': stats.totalQty,
      'Écart Global': stats.totalQty - stats.totalStockInterne
    }));

    const wsFamille = XLSX.utils.json_to_sheet(familleRows);
    wsFamille['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 16 }];
    safeAppendSheet(wb, wsFamille, 'Synthèse_Familles');
  }

  // 6. Emplacement Summary Sheet (avec Stock Interne Total vs Quantité Totale Comptée)
  const locMap = new Map<string, { total: number; saisis: number; aFaire: number; totalStockInterne: number; totalQty: number }>();
  filtered.forEach(item => {
    const loc = item.emplacement || 'Non assigné';
    const curr = locMap.get(loc) || { total: 0, saisis: 0, aFaire: 0, totalStockInterne: 0, totalQty: 0 };
    curr.total += 1;
    curr.totalStockInterne += item.stock_interne || 0;
    if (item.statutInventaire === 'Saisi') {
      curr.saisis += 1;
      curr.totalQty += typeof item.quantite === 'number' ? item.quantite : 0;
    } else {
      curr.aFaire += 1;
    }
    locMap.set(loc, curr);
  });

  if (locMap.size > 0) {
    const locRows = Array.from(locMap.entries()).map(([loc, stats]) => ({
      'Emplacement / Zone': loc,
      'Total Articles Prévus': stats.total,
      'Articles Saisis': stats.saisis,
      'Articles À Faire (Non saisis)': stats.aFaire,
      'Taux d\'Avancement': stats.total > 0 ? `${Math.round((stats.saisis / stats.total) * 100)}%` : '0%',
      'Stock Interne Total': stats.totalStockInterne,
      'Quantité Totale Comptée': stats.totalQty,
      'Écart Global': stats.totalQty - stats.totalStockInterne
    }));

    const wsLoc = XLSX.utils.json_to_sheet(locRows);
    wsLoc['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 16 }];
    safeAppendSheet(wb, wsLoc, 'Synthèse_Emplacements');
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toTimeString().slice(0, 5).replace(':', 'h');
  const fileName = `${filenamePrefix}_${dateStr}_${timeStr}.xlsx`;

  downloadWorkbook(wb, fileName);

  return {
    success: true,
    rowCount: filtered.length,
    fileName,
    countSaisis: saisisItems.length,
    countAFaire: aFaireItems.length
  };
}
