import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRight,
  RefreshCw,
  FolderTree,
  Cpu,
  MapPin
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import {
  parseExcelFile,
  convertRawRowsToArticles,
  parseEmplacementsExcel,
  generateSampleArticlesExcel,
  generateSampleLocationsExcel,
  ParsedExcelResult
} from '../utils/excelImport';
import { ColumnMapping } from '../types/inventory';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ isOpen, onClose }) => {
  const { importArticlesBulk, importLocationsBulk, loadDemoSampleData } = useInventory();
  const [activeImportType, setActiveImportType] = useState<'articles' | 'emplacements'>('articles');
  
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedExcelResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
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
  });

  const [importSummary, setImportSummary] = useState<{
    articlesCount: number;
    machinesCount: number;
    famillesCount: number;
    emplacementsCount: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setLoading(true);
    setImportSummary(null);

    try {
      const parsed = await parseExcelFile(selectedFile);
      setParsedData(parsed);
      setColumnMapping(parsed.detectedMapping);
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la lecture du fichier Excel');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyImport = () => {
    if (!parsedData) return;

    if (activeImportType === 'articles') {
      const { articles, newMachines, newFamilles, newEmplacements } = convertRawRowsToArticles(
        parsedData.rawRows,
        columnMapping
      );

      if (articles.length === 0) {
        setError('Aucun article valide trouvé. Vérifiez le mappage des colonnes.');
        return;
      }

      importArticlesBulk(articles, newMachines, newFamilles, newEmplacements);
      setImportSummary({
        articlesCount: articles.length,
        machinesCount: newMachines.length,
        famillesCount: newFamilles.length,
        emplacementsCount: newEmplacements.length
      });
    } else {
      const emplacements = parseEmplacementsExcel(parsedData.rawRows);
      if (emplacements.length === 0) {
        setError('Aucun emplacement valide trouvé dans le fichier.');
        return;
      }
      importLocationsBulk(emplacements);
      setImportSummary({
        articlesCount: 0,
        machinesCount: 0,
        famillesCount: 0,
        emplacementsCount: emplacements.length
      });
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData(null);
    setError(null);
    setImportSummary(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Importation des Données Excel (.xlsx, .csv)
              </h2>
              <p className="text-xs text-slate-500">
                Insérer préalablement la base des articles et les emplacements
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Import Type Tabs */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveImportType('articles');
                handleReset();
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeImportType === 'articles'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Base des Articles
            </button>
            <button
              onClick={() => {
                setActiveImportType('emplacements');
                handleReset();
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeImportType === 'emplacements'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Liste des Emplacements
            </button>
          </div>

          <button
            onClick={() => {
              if (activeImportType === 'articles') {
                generateSampleArticlesExcel();
              } else {
                generateSampleLocationsExcel();
              }
            }}
            className="text-xs text-slate-600 hover:text-slate-900 font-semibold flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-white border border-slate-200 hover:border-slate-300 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Télécharger modèle Excel vierge</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-3 text-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {importSummary ? (
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-emerald-950">Importation réussie !</h3>
              <p className="text-xs text-emerald-800 max-w-md mx-auto">
                {activeImportType === 'articles' ? (
                  <>
                    <strong>{importSummary.articlesCount} articles</strong> ont été ajoutés à la base.
                    {importSummary.machinesCount > 0 && ` ${importSummary.machinesCount} machines répertoriées.`}
                    {importSummary.famillesCount > 0 && ` ${importSummary.famillesCount} familles enregistrées.`}
                  </>
                ) : (
                  <>
                    <strong>{importSummary.emplacementsCount} emplacements</strong> ont été ajoutés à la liste.
                  </>
                )}
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={handleReset}
                  className="px-4 py-2 bg-white border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold hover:bg-emerald-100"
                >
                  Importer un autre fichier
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 shadow-sm"
                >
                  Aller à la saisie
                </button>
              </div>
            </div>
          ) : !parsedData ? (
            <div className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-2xl p-8 sm:p-12 text-center bg-slate-50/50 transition-colors">
              <input
                type="file"
                id="excel-file-input"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <label
                htmlFor="excel-file-input"
                className="cursor-pointer flex flex-col items-center justify-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
                  <Upload className="w-7 h-7" />
                </div>
                <p className="text-sm font-bold text-slate-800 mb-1">
                  Glissez-déposez ou cliquez pour sélectionner votre fichier Excel
                </p>
                <p className="text-xs text-slate-500 mb-4">
                  Formats supportés : Microsoft Excel (.xlsx, .xls) ou CSV (.csv)
                </p>
                <span className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 shadow-sm">
                  Parcourir mes fichiers
                </span>
              </label>

              <div className="mt-8 pt-6 border-t border-slate-200 text-left text-xs space-y-3">
                <div>
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Colonnes supportées pour les Articles (Format standard) :</span>
                  </span>
                  <p className="text-[11px] text-slate-600">
                    Famille, Sous-famille, Départ/Machine, Position/Emplacement, Désignation (requis), Référence manuel, Code magasin (requis), Unité, Géré/non-géré.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 text-slate-500">
                  <span className="font-bold text-slate-700 block mb-0.5">
                    Colonnes pour les Emplacements :
                  </span>
                  <p className="text-[11px]">Code Emplacement (ex: MAG-A-01), Nom Emplacement, Zone / Secteur.</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800">Fichier : {file?.name}</span>
                  <span className="text-xs text-slate-500">
                    ({parsedData.rawRows.length} lignes trouvées)
                  </span>
                </div>
                <button
                  onClick={handleReset}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Changer de fichier</span>
                </button>
              </div>

              {activeImportType === 'articles' ? (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-orange-600" />
                        <span>Colonnes détectées pour les Articles (Format 9 colonnes) :</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Chaque colonne de votre fichier Excel est automatiquement associée à la forme demandée :
                      </p>
                    </div>

                    {/* Badge de conformité */}
                    {(() => {
                      const detectedCount = [
                        columnMapping.famille,
                        columnMapping.sous_famille,
                        columnMapping.depart || columnMapping.machine,
                        columnMapping.position,
                        columnMapping.designation,
                        columnMapping.reference,
                        columnMapping.code_article,
                        columnMapping.unite,
                        columnMapping.gere_nn
                      ].filter(Boolean).length;

                      return (
                        <span className="text-[11px] bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 shadow-2xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{detectedCount}/9 colonnes reconnues</span>
                        </span>
                      );
                    })()}
                  </div>

                  {/* Tableau interactif de mappage des 9 colonnes (Forme fidèle à l'image utilisateur) */}
                  <div className="overflow-x-auto rounded-xl border border-orange-400 shadow-xs bg-white">
                    <table className="w-full text-left text-xs min-w-[850px] border-collapse">
                      {/* En-tête ORANGE fidèle à l'image fournie par l'utilisateur */}
                      <thead>
                        <tr className="bg-[#f28e2b] text-white font-bold text-center divide-x divide-orange-300/60 shadow-xs">
                          <th className="py-2.5 px-2.5 text-xs">Famaille</th>
                          <th className="py-2.5 px-2.5 text-xs">S.famaille</th>
                          <th className="py-2.5 px-2.5 text-xs">Départ</th>
                          <th className="py-2.5 px-2.5 text-xs">Position</th>
                          <th className="py-2.5 px-3 text-xs min-w-[140px]">Désignation *</th>
                          <th className="py-2.5 px-2.5 text-xs">Référence manuel</th>
                          <th className="py-2.5 px-2.5 text-xs min-w-[130px]">Code magasin *</th>
                          <th className="py-2.5 px-2 text-xs">Unité</th>
                          <th className="py-2.5 px-2 text-xs">Géré /nn</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-orange-50/20">
                        {/* Ligne des sélecteurs de correspondance */}
                        <tr className="divide-x divide-slate-200/80 align-top">
                          {/* 1. Famaille */}
                          <td className="p-2">
                            <div className="space-y-1">
                              <span className={`block text-[10px] font-semibold truncate ${
                                columnMapping.famille ? 'text-emerald-700 font-bold' : 'text-slate-400'
                              }`}>
                                {columnMapping.famille ? `✓ ${columnMapping.famille}` : 'Non spécifié'}
                              </span>
                              <select
                                value={columnMapping.famille}
                                onChange={(e) => setColumnMapping({ ...columnMapping, famille: e.target.value })}
                                className="w-full text-[11px] p-1.5 bg-white border border-slate-300 rounded-md focus:border-orange-500 focus:outline-hidden"
                              >
                                <option value="">-- Général --</option>
                                {parsedData.headers.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* 2. S.famaille */}
                          <td className="p-2">
                            <div className="space-y-1">
                              <span className={`block text-[10px] font-semibold truncate ${
                                columnMapping.sous_famille ? 'text-emerald-700 font-bold' : 'text-slate-400'
                              }`}>
                                {columnMapping.sous_famille ? `✓ ${columnMapping.sous_famille}` : 'Optionnel'}
                              </span>
                              <select
                                value={columnMapping.sous_famille}
                                onChange={(e) => setColumnMapping({ ...columnMapping, sous_famille: e.target.value })}
                                className="w-full text-[11px] p-1.5 bg-white border border-slate-300 rounded-md focus:border-orange-500 focus:outline-hidden"
                              >
                                <option value="">-- Aucun --</option>
                                {parsedData.headers.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* 3. Départ */}
                          <td className="p-2">
                            <div className="space-y-1">
                              <span className={`block text-[10px] font-semibold truncate ${
                                (columnMapping.depart || columnMapping.machine) ? 'text-emerald-700 font-bold' : 'text-slate-400'
                              }`}>
                                {(columnMapping.depart || columnMapping.machine) ? `✓ ${columnMapping.depart || columnMapping.machine}` : 'Standard'}
                              </span>
                              <select
                                value={columnMapping.depart || columnMapping.machine}
                                onChange={(e) => setColumnMapping({ ...columnMapping, depart: e.target.value, machine: e.target.value })}
                                className="w-full text-[11px] p-1.5 bg-white border border-slate-300 rounded-md focus:border-orange-500 focus:outline-hidden"
                              >
                                <option value="">-- Standard --</option>
                                {parsedData.headers.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* 4. Position (Machine) */}
                          <td className="p-2">
                            <div className="space-y-1">
                              <span className={`block text-[10px] font-semibold truncate ${
                                columnMapping.position ? 'text-emerald-700 font-bold' : 'text-slate-400'
                              }`}>
                                {columnMapping.position ? `✓ ${columnMapping.position}` : 'Optionnel'}
                              </span>
                              <select
                                value={columnMapping.position}
                                onChange={(e) => setColumnMapping({ ...columnMapping, position: e.target.value })}
                                className="w-full text-[11px] p-1.5 bg-white border border-slate-300 rounded-md focus:border-orange-500 focus:outline-hidden"
                              >
                                <option value="">-- Aucun --</option>
                                {parsedData.headers.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* 5. Désignation */}
                          <td className="p-2 bg-orange-50/40">
                            <div className="space-y-1">
                              <span className={`block text-[10px] font-semibold truncate ${
                                columnMapping.designation ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'
                              }`}>
                                {columnMapping.designation ? `✓ ${columnMapping.designation}` : 'Requis *'}
                              </span>
                              <select
                                value={columnMapping.designation}
                                onChange={(e) => setColumnMapping({ ...columnMapping, designation: e.target.value })}
                                className="w-full text-[11px] p-1.5 bg-white border border-orange-400 rounded-md font-medium focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
                              >
                                <option value="">-- Sélectionner --</option>
                                {parsedData.headers.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* 6. Référence manuel */}
                          <td className="p-2">
                            <div className="space-y-1">
                              <span className={`block text-[10px] font-semibold truncate ${
                                columnMapping.reference ? 'text-emerald-700 font-bold' : 'text-slate-400'
                              }`}>
                                {columnMapping.reference ? `✓ ${columnMapping.reference}` : 'Optionnel'}
                              </span>
                              <select
                                value={columnMapping.reference}
                                onChange={(e) => setColumnMapping({ ...columnMapping, reference: e.target.value })}
                                className="w-full text-[11px] p-1.5 bg-white border border-slate-300 rounded-md focus:border-orange-500 focus:outline-hidden"
                              >
                                <option value="">-- Aucun --</option>
                                {parsedData.headers.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* 7. Code magasin */}
                          <td className="p-2 bg-orange-50/40">
                            <div className="space-y-1">
                              <span className={`block text-[10px] font-semibold truncate ${
                                columnMapping.code_article ? 'text-emerald-700 font-bold' : 'text-rose-600 font-bold'
                              }`}>
                                {columnMapping.code_article ? `✓ ${columnMapping.code_article}` : 'Requis *'}
                              </span>
                              <select
                                value={columnMapping.code_article}
                                onChange={(e) => setColumnMapping({ ...columnMapping, code_article: e.target.value })}
                                className="w-full text-[11px] p-1.5 bg-white border border-orange-400 rounded-md font-mono font-medium focus:ring-1 focus:ring-orange-500 focus:outline-hidden"
                              >
                                <option value="">-- Sélectionner --</option>
                                {parsedData.headers.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* 8. Unité */}
                          <td className="p-2">
                            <div className="space-y-1">
                              <span className={`block text-[10px] font-semibold truncate ${
                                columnMapping.unite ? 'text-emerald-700 font-bold' : 'text-slate-400'
                              }`}>
                                {columnMapping.unite ? `✓ ${columnMapping.unite}` : 'Pièce'}
                              </span>
                              <select
                                value={columnMapping.unite}
                                onChange={(e) => setColumnMapping({ ...columnMapping, unite: e.target.value })}
                                className="w-full text-[11px] p-1.5 bg-white border border-slate-300 rounded-md focus:border-orange-500 focus:outline-hidden"
                              >
                                <option value="">-- Pièce --</option>
                                {parsedData.headers.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                          </td>

                          {/* 9. Géré /nn */}
                          <td className="p-2">
                            <div className="space-y-1">
                              <span className={`block text-[10px] font-semibold truncate ${
                                columnMapping.gere_nn ? 'text-emerald-700 font-bold' : 'text-slate-400'
                              }`}>
                                {columnMapping.gere_nn ? `✓ ${columnMapping.gere_nn}` : 'G'}
                              </span>
                              <select
                                value={columnMapping.gere_nn}
                                onChange={(e) => setColumnMapping({ ...columnMapping, gere_nn: e.target.value })}
                                className="w-full text-[11px] p-1.5 bg-white border border-slate-300 rounded-md focus:border-orange-500 focus:outline-hidden"
                              >
                                <option value="">-- G --</option>
                                {parsedData.headers.map((h) => (
                                  <option key={h} value={h}>{h}</option>
                                ))}
                              </select>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Optionnel: Quantité initiale */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <span className="text-slate-600">
                      <strong>Optionnel :</strong> Colonne Quantité en stock initial / théorique :
                    </span>
                    <select
                      value={columnMapping.quantite}
                      onChange={(e) => setColumnMapping({ ...columnMapping, quantite: e.target.value })}
                      className="text-xs p-1.5 bg-white border border-slate-300 rounded-lg min-w-[200px]"
                    >
                      <option value="">-- Non spécifié (1 par défaut) --</option>
                      {parsedData.headers.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>

                  {/* Aperçu fidèle sous la forme des 9 colonnes (Modèle utilisateur) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span>Aperçu direct de vos données sous la forme des 9 colonnes :</span>
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Affichage des 4 premières lignes du fichier
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-orange-400 shadow-xs">
                      <table className="w-full text-left text-xs min-w-[850px] border-collapse">
                        <thead>
                          <tr className="bg-[#f28e2b] text-white font-bold text-center divide-x divide-orange-300/60 shadow-xs">
                            <th className="py-2 px-2.5 text-xs whitespace-nowrap">Famaille</th>
                            <th className="py-2 px-2.5 text-xs whitespace-nowrap">S.famaille</th>
                            <th className="py-2 px-2.5 text-xs whitespace-nowrap">Départ</th>
                            <th className="py-2 px-2.5 text-xs whitespace-nowrap">Position</th>
                            <th className="py-2 px-3 text-xs min-w-[160px] text-left">Désignation</th>
                            <th className="py-2 px-2.5 text-xs whitespace-nowrap">Référence manuel</th>
                            <th className="py-2 px-2.5 text-xs whitespace-nowrap">Code magasin</th>
                            <th className="py-2 px-2 text-xs text-center whitespace-nowrap">Unité</th>
                            <th className="py-2 px-2 text-xs text-center whitespace-nowrap">Géré /nn</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                          {parsedData.rawRows.slice(0, 4).map((row, idx) => {
                            const departKey = (columnMapping.depart || columnMapping.machine || '').trim();
                            const positionKey = (columnMapping.position || '').trim();

                            const valFamille = columnMapping.famille ? String(row[columnMapping.famille] || '') : 'Général';
                            const valSousFamille = columnMapping.sous_famille ? String(row[columnMapping.sous_famille] || '') : '-';
                            const valDepart = departKey ? String(row[departKey] || '') : 'Standard';
                            const valPosRaw = positionKey ? String(row[positionKey] || '').trim() : '';
                            const valPosition = (valPosRaw && valPosRaw !== '-' && valPosRaw !== 'Non assigné' && valPosRaw !== 'Non renseigné') ? valPosRaw : '';
                            const valDesignation = columnMapping.designation
                              ? String(row[columnMapping.designation] || '')
                              : '-';
                            const valReference = columnMapping.reference
                              ? String(row[columnMapping.reference] || '')
                              : '-';
                            const valCode = columnMapping.code_article
                              ? String(row[columnMapping.code_article] || '')
                              : '-';
                            const valUnite = columnMapping.unite
                              ? String(row[columnMapping.unite] || '')
                              : 'Pièce';
                            const valGere = columnMapping.gere_nn
                              ? String(row[columnMapping.gere_nn] || '')
                              : 'G';

                            return (
                              <tr key={idx} className="hover:bg-amber-50/40 divide-x divide-slate-100/80 transition-colors">
                                <td className="py-2 px-2.5 whitespace-nowrap font-medium text-slate-700">
                                  {valFamille || 'Général'}
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap text-slate-500">
                                  {valSousFamille || '-'}
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap font-semibold text-slate-800">
                                  <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                                    {valDepart || 'Standard'}
                                  </span>
                                </td>
                                <td className="py-2 px-2.5 whitespace-nowrap font-mono text-slate-700">
                                  {valPosition ? (
                                    <span className="bg-amber-50 text-amber-900 px-2 py-0.5 rounded text-[11px] font-semibold border border-amber-200">
                                      {valPosition}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic text-[11px] pl-1">-</span>
                                  )}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-900 max-w-[220px]">
                                  <div className="truncate">{valDesignation || '-'}</div>
                                </td>
                                <td className="py-2 px-2.5 font-mono text-slate-600 whitespace-nowrap">
                                  {valReference || '-'}
                                </td>
                                <td className="py-2 px-2.5 font-mono font-bold text-slate-900 whitespace-nowrap">
                                  <span className="bg-slate-100 text-slate-900 px-2 py-0.5 rounded font-mono font-bold text-[11px] border border-slate-300">
                                    {valCode || '-'}
                                  </span>
                                </td>
                                <td className="py-2 px-2 text-center whitespace-nowrap text-slate-600">
                                  {valUnite || 'Pièce'}
                                </td>
                                <td className="py-2 px-2 text-center whitespace-nowrap">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    {valGere || 'G'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                  <p className="font-bold mb-2">Aperçu des emplacements détectés :</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {parsedData.rawRows.slice(0, 8).map((row, idx) => (
                      <div key={idx} className="font-mono text-[11px] bg-white p-1.5 rounded border border-slate-200">
                        {Object.values(row).join(' · ')}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={() => {
                loadDemoSampleData();
                onClose();
              }}
              className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-colors"
              title="Charger un jeu de test de démonstration"
            >
              Charger exemple de démo
            </button>
          </div>

          {parsedData && !importSummary && (
            <button
              onClick={handleApplyImport}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md active:scale-98 transition-all"
            >
              <span>Valider l'importation de {parsedData.rawRows.length} lignes</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
