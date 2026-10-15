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
  const { importArticlesBulk, importLocationsBulk } = useInventory();
  const [activeImportType, setActiveImportType] = useState<'articles' | 'emplacements'>('articles');
  
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<ParsedExcelResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    code_article: '',
    designation: '',
    reference: '',
    famille: '',
    machine: '',
    unite: '',
    emplacement: '',
    quantite: '',
    prix_unitaire: ''
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
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
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

              <div className="mt-8 pt-6 border-t border-slate-200 text-left text-xs text-slate-500 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="font-bold text-slate-700 block mb-1">
                    Colonnes détectées pour les Articles :
                  </span>
                  <p>Code Article, Désignation, Référence, Famille, Machine, Emplacement, Unité, Quantité, Prix.</p>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block mb-1">
                    Colonnes pour les Emplacements :
                  </span>
                  <p>Code Emplacement (ex: MAG-A-01), Nom Emplacement, Zone / Secteur.</p>
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
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3">
                    Associer les colonnes Excel aux champs de l'application
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Code Article */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Code Article <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={columnMapping.code_article}
                        onChange={(e) => setColumnMapping({ ...columnMapping, code_article: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="">-- Sélectionner une colonne --</option>
                        {parsedData.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Désignation */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Désignation / Nom <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={columnMapping.designation}
                        onChange={(e) => setColumnMapping({ ...columnMapping, designation: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="">-- Sélectionner une colonne --</option>
                        {parsedData.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Référence */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Référence Fabricant
                      </label>
                      <select
                        value={columnMapping.reference}
                        onChange={(e) => setColumnMapping({ ...columnMapping, reference: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="">-- Non spécifié --</option>
                        {parsedData.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Famille */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                        <FolderTree className="w-3.5 h-3.5 text-emerald-600" />
                        Famille
                      </label>
                      <select
                        value={columnMapping.famille}
                        onChange={(e) => setColumnMapping({ ...columnMapping, famille: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="">-- Non spécifié --</option>
                        {parsedData.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Machine */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                        <Cpu className="w-3.5 h-3.5 text-blue-600" />
                        Machine / Équipement
                      </label>
                      <select
                        value={columnMapping.machine}
                        onChange={(e) => setColumnMapping({ ...columnMapping, machine: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="">-- Non spécifié --</option>
                        {parsedData.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Emplacement */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-600" />
                        Emplacement
                      </label>
                      <select
                        value={columnMapping.emplacement}
                        onChange={(e) => setColumnMapping({ ...columnMapping, emplacement: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="">-- Non spécifié --</option>
                        {parsedData.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Quantité */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Quantité (facultatif)
                      </label>
                      <select
                        value={columnMapping.quantite}
                        onChange={(e) => setColumnMapping({ ...columnMapping, quantite: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="">-- Non spécifié (1 par défaut) --</option>
                        {parsedData.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Unité */}
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="block text-xs font-bold text-slate-800 mb-1">
                        Unité (Pièce, Litre, Kg...)
                      </label>
                      <select
                        value={columnMapping.unite}
                        onChange={(e) => setColumnMapping({ ...columnMapping, unite: e.target.value })}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg"
                      >
                        <option value="">-- Non spécifié (Pièce par défaut) --</option>
                        {parsedData.headers.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
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

              {/* Preview table (first 3 rows) */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-2">
                  Aperçu des 3 premières lignes :
                </span>
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold">
                      <tr>
                        {parsedData.headers.slice(0, 6).map((h) => (
                          <th key={h} className="p-2 border-b border-slate-200 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-600">
                      {parsedData.rawRows.slice(0, 3).map((row, i) => (
                        <tr key={i}>
                          {parsedData.headers.slice(0, 6).map((h) => (
                            <td key={h} className="p-2 whitespace-nowrap">
                              {String(row[h] || '-')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Fermer
          </button>

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
