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

  // 1. Add all inventoried entries (Saisi)
  entries.forEach((entry) => {
    accountedArticleCodes.add(entry.code_article.toLowerCase());
    combined.push({
      id: entry.id,
      code_article: entry.code_article,
      designation: entry.designation,
      reference: entry.reference || '-',
      famille: entry.famille || 'Général',
      machine: entry.machine || 'Standard',
      emplacement: entry.emplacement || 'Non assigné',
      unite: entry.unite || 'Pièce',
      quantite: entry.quantite,
      qualite: QUALITE_LABELS[entry.qualite] || entry.qualite,
      statutInventaire: 'Saisi',
      timestamp: entry.timestamp ? new Date(entry.timestamp).toLocaleString('fr-FR') : '-',
      operator: entry.operator || 'Opérateur',
      notes: entry.notes || ''
    });
  });

  // 2. Add all catalog articles that have NOT been inventoried yet (À faire)
  articles.forEach((art) => {
    if (!accountedArticleCodes.has(art.code_article.toLowerCase())) {
      const isSaisi = art.status === 'saisi';
      combined.push({
        id: `missing-${art.id}`,
        code_article: art.code_article,
        designation: art.designation,
        reference: art.reference || '-',
        famille: art.famille || 'Général',
        machine: art.machine || 'Standard',
        emplacement: art.emplacement || 'Non assigné',
        unite: art.unite || 'Pièce',
        quantite: isSaisi ? (art.quantite || 1) : '',
        qualite: isSaisi ? 'Conforme / Neuf' : 'En attente d\'inventaire',
        statutInventaire: isSaisi ? 'Saisi' : 'À faire (Non inventorié)',
        timestamp: '-',
        operator: '-',
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
  const rowsGlobal = filtered.map((item, idx) => ({
    'N°': idx + 1,
    'Statut Inventaire': item.statutInventaire,
    'Code Article': item.code_article,
    'Désignation': item.designation,
    'Référence Fabricant': item.reference,
    'Famille': item.famille,
    'Machine': item.machine,
    'Emplacement': item.emplacement,
    'Unité': item.unite,
    'Quantité Saisie': item.quantite === '' ? 'Non saisi' : item.quantite,
    'Qualité / État Réel': item.qualite,
    'Date & Heure': item.timestamp,
    'Opérateur': item.operator,
    'Remarques & Observations': item.notes
  }));

  const wsGlobal = XLSX.utils.json_to_sheet(rowsGlobal);

  wsGlobal['!cols'] = [
    { wch: 6 },  // N°
    { wch: 24 }, // Statut Inventaire
    { wch: 18 }, // Code Article
    { wch: 35 }, // Désignation
    { wch: 22 }, // Référence
    { wch: 24 }, // Famille
    { wch: 30 }, // Machine
    { wch: 20 }, // Emplacement
    { wch: 10 }, // Unité
    { wch: 16 }, // Quantité
    { wch: 26 }, // Qualité
    { wch: 20 }, // Date
    { wch: 16 }, // Opérateur
    { wch: 30 }  // Notes
  ];

  XLSX.utils.book_append_sheet(wb, wsGlobal, 'Inventaire_Global');

  // 2. Sheet: Articles_Non_Inventoriés (À faire pour contrôle)
  const aFaireItems = filtered.filter(i => i.statutInventaire === 'À faire (Non inventorié)');
  if (aFaireItems.length > 0) {
    const rowsAFaire = aFaireItems.map((item, idx) => ({
      'N°': idx + 1,
      'Code Article': item.code_article,
      'Désignation': item.designation,
      'Référence Fabricant': item.reference,
      'Famille': item.famille,
      'Machine': item.machine,
      'Emplacement Répertoire': item.emplacement,
      'Unité': item.unite,
      'Statut': 'À FAIRE (NON INVENTORIÉ)'
    }));

    const wsAFaire = XLSX.utils.json_to_sheet(rowsAFaire);
    wsAFaire['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 35 },
      { wch: 22 },
      { wch: 24 },
      { wch: 30 },
      { wch: 22 },
      { wch: 10 },
      { wch: 28 }
    ];
    XLSX.utils.book_append_sheet(wb, wsAFaire, 'Articles_À_Faire_Contrôle');
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
      'Emplacement Constaté': item.emplacement,
      'Unité': item.unite,
      'Quantité Comptée': item.quantite,
      'Qualité / État': item.qualite,
      'Date & Heure': item.timestamp,
      'Opérateur': item.operator,
      'Remarques': item.notes
    }));

    const wsSaisis = XLSX.utils.json_to_sheet(rowsSaisis);
    wsSaisis['!cols'] = wsGlobal['!cols'];
    XLSX.utils.book_append_sheet(wb, wsSaisis, 'Articles_Saisis');
  }

  // 4. Machine Summary Sheet (avec taux d'avancement)
  const machineMap = new Map<string, { total: number; saisis: number; aFaire: number; totalQty: number }>();
  filtered.forEach(item => {
    const m = item.machine || 'Non assigné';
    const curr = machineMap.get(m) || { total: 0, saisis: 0, aFaire: 0, totalQty: 0 };
    curr.total += 1;
    if (item.statutInventaire === 'Saisi') {
      curr.saisis += 1;
      curr.totalQty += typeof item.quantite === 'number' ? item.quantite : 0;
    } else {
      curr.aFaire += 1;
    }
    machineMap.set(m, curr);
  });

  const machineRows = Array.from(machineMap.entries()).map(([machine, stats]) => ({
    'Machine / Équipement': machine,
    'Total Articles Prévus': stats.total,
    'Articles Saisis': stats.saisis,
    'Articles À Faire (Non saisis)': stats.aFaire,
    'Taux d\'Avancement': stats.total > 0 ? `${Math.round((stats.saisis / stats.total) * 100)}%` : '0%',
    'Quantité Totale Comptée': stats.totalQty
  }));

  const wsMachine = XLSX.utils.json_to_sheet(machineRows);
  wsMachine['!cols'] = [{ wch: 35 }, { wch: 22 }, { wch: 16 }, { wch: 26 }, { wch: 20 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsMachine, 'Synthèse_Avancement_Machines');

  // 5. Family Summary Sheet (avec taux d'avancement)
  const familleMap = new Map<string, { total: number; saisis: number; aFaire: number; totalQty: number }>();
  filtered.forEach(item => {
    const f = item.famille || 'Général';
    const curr = familleMap.get(f) || { total: 0, saisis: 0, aFaire: 0, totalQty: 0 };
    curr.total += 1;
    if (item.statutInventaire === 'Saisi') {
      curr.saisis += 1;
      curr.totalQty += typeof item.quantite === 'number' ? item.quantite : 0;
    } else {
      curr.aFaire += 1;
    }
    familleMap.set(f, curr);
  });

  const familleRows = Array.from(familleMap.entries()).map(([famille, stats]) => ({
    'Famille / Catégorie': famille,
    'Total Articles Prévus': stats.total,
    'Articles Saisis': stats.saisis,
    'Articles À Faire (Non saisis)': stats.aFaire,
    'Taux d\'Avancement': stats.total > 0 ? `${Math.round((stats.saisis / stats.total) * 100)}%` : '0%',
    'Quantité Totale Comptée': stats.totalQty
  }));

  const wsFamille = XLSX.utils.json_to_sheet(familleRows);
  wsFamille['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 16 }, { wch: 26 }, { wch: 20 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, wsFamille, 'Synthèse_Avancement_Familles');

  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toTimeString().slice(0, 5).replace(':', 'h');
  const fileName = `${filenamePrefix}_${dateStr}_${timeStr}.xlsx`;

  XLSX.writeFile(wb, fileName);

  return {
    success: true,
    rowCount: filtered.length,
    fileName,
    countSaisis: saisisItems.length,
    countAFaire: aFaireItems.length
  };
}
