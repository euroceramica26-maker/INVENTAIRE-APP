import React, { useState, useEffect } from 'react';
import {
  X,
  Minus,
  Plus,
  MapPin,
  Cpu,
  FolderTree,
  FileText,
  User,
  ScanLine,
  Save,
  Package,
  Edit3,
  CheckCircle2
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Article, InventoryEntry, QualiteEtat } from '../types/inventory';
import { QUALITE_LABELS } from '../utils/excelExport';

interface InventoryEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  article: Article | null;
  existingEntry?: InventoryEntry | null;
  onSaveAndNext?: () => void;
}

export const InventoryEntryModal: React.FC<InventoryEntryModalProps> = ({
  isOpen,
  onClose,
  article,
  existingEntry,
  onSaveAndNext
}) => {
  const {
    articles,
    locations,
    familles,
    machines,
    operator,
    lastLocation,
    setLastLocation,
    addOrUpdateEntry,
    addArticle,
    addMachine,
    addFamille,
    addLocation
  } = useInventory();

  // Form states
  const [quantite, setQuantite] = useState<number>(1);
  const [qualite, setQualite] = useState<QualiteEtat>('conforme');
  const [emplacement, setEmplacement] = useState<string>('');
  const [machine, setMachine] = useState<string>('');
  const [famille, setFamille] = useState<string>('');
  const [unite, setUnite] = useState<string>('Pièce');
  const [notes, setNotes] = useState<string>('');
  const [currentOperator, setCurrentOperator] = useState<string>(operator);

  // Quick new item creation state
  const [codeArticleInput, setCodeArticleInput] = useState('');
  const [designationInput, setDesignationInput] = useState('');
  const [referenceInput, setReferenceInput] = useState('');
  const [isAddingNewMachine, setIsAddingNewMachine] = useState(false);
  const [newMachineInput, setNewMachineInput] = useState('');
  const [isAddingNewFamille, setIsAddingNewFamille] = useState(false);
  const [newFamilleInput, setNewFamilleInput] = useState('');
  const [isAddingNewLocation, setIsAddingNewLocation] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');

  useEffect(() => {
    if (existingEntry) {
      setCodeArticleInput(existingEntry.code_article || '');
      setDesignationInput(existingEntry.designation || '');
      setReferenceInput(existingEntry.reference || '');
      setQuantite(existingEntry.quantite);
      setQualite(existingEntry.qualite);
      const entLoc = (existingEntry.emplacement || existingEntry.position || '').trim();
      const cleanEntLoc = (entLoc && entLoc !== 'Non renseigné' && entLoc !== 'Non assigné') ? entLoc : '';
      setEmplacement(cleanEntLoc || lastLocation || '');
      setMachine(existingEntry.machine);
      setFamille(existingEntry.famille);
      setUnite(existingEntry.unite);
      setNotes(existingEntry.notes || '');
      setCurrentOperator(existingEntry.operator || operator);
    } else if (article) {
      setCodeArticleInput(article.code_article || '');
      setDesignationInput(article.designation || '');
      setReferenceInput(article.reference || '');
      setQuantite(article.quantite && article.quantite > 0 ? article.quantite : 1);
      setQualite('conforme');
      // Mémoriser le dernier emplacement réel saisi : si présent, il est repris automatiquement
      const artLoc = (article.emplacement || article.position || '').trim();
      const cleanArtLoc = (artLoc && artLoc !== 'Non renseigné' && artLoc !== 'Non assigné') ? artLoc : '';
      const cleanLastLoc = (lastLocation && lastLocation !== 'Non renseigné' && lastLocation !== 'Non assigné') ? lastLocation.trim() : '';
      const loc = cleanLastLoc || cleanArtLoc || (locations[0]?.code ?? '');
      setEmplacement(loc);
      setMachine(article.machine || (machines[0] ?? ''));
      setFamille(article.famille || (familles[0] ?? ''));
      setUnite(article.unite || 'Pièce');
      setNotes('');
      setCurrentOperator(operator);
    }
  }, [article, existingEntry, isOpen, lastLocation, locations, machines, familles, operator]);

  if (!isOpen || (!article && !existingEntry)) return null;

  const currentArticle = article || {
    id: existingEntry?.articleId || 'temp',
    code_article: existingEntry?.code_article || '',
    designation: existingEntry?.designation || '',
    reference: existingEntry?.reference || '',
    famille: existingEntry?.famille || '',
    machine: existingEntry?.machine || '',
    unite: existingEntry?.unite || 'Pièce',
    emplacement: existingEntry?.emplacement || ''
  };

  const isKnownArticle = articles.some(
    (a) => a.code_article.toLowerCase() === (codeArticleInput || currentArticle.code_article).trim().toLowerCase()
  );

  const handleAdjustQty = (delta: number) => {
    setQuantite(prev => Math.max(0, Math.round((prev + delta) * 100) / 100));
  };

  const handleAddNewMachine = () => {
    if (newMachineInput.trim()) {
      addMachine(newMachineInput.trim());
      setMachine(newMachineInput.trim());
      setNewMachineInput('');
      setIsAddingNewMachine(false);
    }
  };

  const handleAddNewFamille = () => {
    if (newFamilleInput.trim()) {
      addFamille(newFamilleInput.trim());
      setFamille(newFamilleInput.trim());
      setNewFamilleInput('');
      setIsAddingNewFamille(false);
    }
  };

  const handleAddNewLocation = () => {
    if (newLocationInput.trim()) {
      const code = newLocationInput.trim().toUpperCase();
      addLocation({ code, nom: code, zone: 'Zone Saisie' });
      setEmplacement(code);
      setNewLocationInput('');
      setIsAddingNewLocation(false);
    }
  };

  const handleSave = (continueScanning = false) => {
    const finalCode = (codeArticleInput.trim() || currentArticle.code_article).trim();
    const finalDesig = (designationInput.trim() || currentArticle.designation).trim() || finalCode;
    const finalRef = (referenceInput.trim() || currentArticle.reference).trim();

    if (!finalCode) return;

    // Déterminer l'emplacement réel : priorité à la valeur saisie, puis dernier emplacement, sans jamais 'Non renseigné'
    const rawLoc = (emplacement || '').trim();
    const cleanArtLoc = (currentArticle.emplacement && currentArticle.emplacement !== 'Non renseigné' && currentArticle.emplacement !== 'Non assigné')
      ? currentArticle.emplacement.trim()
      : '';
    const cleanLastLoc = (lastLocation && lastLocation !== 'Non renseigné' && lastLocation !== 'Non assigné')
      ? lastLocation.trim()
      : '';
    const realLocation = (rawLoc && rawLoc !== 'Non renseigné' && rawLoc !== 'Non assigné')
      ? rawLoc
      : (cleanLastLoc || cleanArtLoc || 'Non assigné');

    // 1. Ajouter à la liste des articles avec le statut (saisi) et l'emplacement réel
    addArticle({
      code_article: finalCode,
      designation: finalDesig,
      reference: finalRef,
      famille: famille || currentArticle.famille || 'Général',
      machine: machine || currentArticle.machine || 'Standard',
      unite: unite || currentArticle.unite || 'Pièce',
      emplacement: realLocation,
      position: realLocation,
      quantite: quantite,
      status: 'saisi'
    });

    // 2. Ajouter dans la liste des saisis (entries) et changer le statut par (saisi)
    addOrUpdateEntry(
      {
        articleId: currentArticle.id,
        code_article: finalCode,
        designation: finalDesig,
        reference: finalRef,
        famille: famille || currentArticle.famille || 'Général',
        machine: machine || currentArticle.machine || 'Standard',
        unite: unite || currentArticle.unite || 'Pièce',
        emplacement: realLocation,
        position: realLocation,
        quantite: quantite,
        qualite,
        notes: notes.trim(),
        operator: currentOperator || operator,
        status: 'saisi'
      },
      existingEntry?.id
    );

    if (realLocation && realLocation !== 'Non assigné' && realLocation !== 'Non renseigné') {
      setLastLocation(realLocation);
    }

    if (continueScanning && onSaveAndNext) {
      onSaveAndNext();
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                  {codeArticleInput || currentArticle.code_article || 'Saisie Manuelle'}
                </span>
                {(referenceInput || currentArticle.reference) && (referenceInput || currentArticle.reference) !== '-' && (
                  <>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-500 font-mono">
                      Réf: {referenceInput || currentArticle.reference}
                    </span>
                  </>
                )}
                {isKnownArticle ? (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    ✓ Article Répertorié (Saisi)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                    Saisie Manuelle · Sera Ajouté & Saisi
                  </span>
                )}
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-tight mt-0.5 truncate max-w-md">
                {designationInput || currentArticle.designation || 'Nouvel Article'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Manual Entry Article Details (Code, Désignation, Référence) */}
          {(!isKnownArticle || currentArticle.id?.startsWith('manual')) && (
            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                  Informations Article (Saisie Manuelle)
                </span>
                <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md">
                  Statut : (saisi)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Code Article <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={codeArticleInput}
                    onChange={(e) => setCodeArticleInput(e.target.value.toUpperCase())}
                    placeholder="Ex: ART-001"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Désignation <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={designationInput}
                    onChange={(e) => setDesignationInput(e.target.value)}
                    placeholder="Nom ou description de l'article"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Référence Fabricant
                </label>
                <input
                  type="text"
                  value={referenceInput}
                  onChange={(e) => setReferenceInput(e.target.value)}
                  placeholder="Ex: SKF-6204, SIEMENS-3RV..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="text-[11px] text-slate-500 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>
                  Cet article sera ajouté à la liste des articles et dans la liste des saisis avec le statut <strong>(saisi)</strong>.
                </span>
              </div>
            </div>
          )}

          {/* 1. QUANTITY COUNTER */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Saisir la Quantité
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Unité :</span>
                <input
                  type="text"
                  value={unite}
                  onChange={(e) => setUnite(e.target.value)}
                  className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-md text-xs font-medium text-center"
                  placeholder="Pièce"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3">
              {/* Stepper buttons & Input */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => handleAdjustQty(-1)}
                  className="w-12 h-12 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-95 flex items-center justify-center font-bold text-lg shadow-xs transition-all"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <div className="relative flex-1 sm:w-40">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={quantite}
                    onChange={(e) => setQuantite(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full h-12 text-center font-mono text-2xl font-bold text-slate-900 bg-white border-2 border-slate-300 rounded-xl focus:border-amber-500 focus:outline-none tabular-nums"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 pointer-events-none">
                    {unite}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleAdjustQty(1)}
                  className="w-12 h-12 rounded-xl bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-95 flex items-center justify-center font-bold text-lg shadow-xs transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              {/* Quick increment buttons */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                {[+5, +10, +50, +100].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => handleAdjustQty(inc)}
                    className="flex-1 sm:flex-none px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:border-amber-400 hover:text-amber-700 text-xs font-semibold rounded-lg shadow-2xs transition-colors"
                  >
                    +{inc}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 2. QUALITÉ RÉELLE / ÉTAT DU MATÉRIEL */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Saisir la Qualité Réelle / État du Matériel
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(QUALITE_LABELS) as QualiteEtat[]).map((key) => {
                const label = QUALITE_LABELS[key];
                const isSelected = qualite === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setQualite(key)}
                    className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between min-h-[60px] ${
                      isSelected
                        ? key === 'conforme' || key === 'bon_etat'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950 shadow-xs ring-1 ring-emerald-500 font-bold'
                          : key === 'a_reparer' || key === 'degrade'
                          ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-xs ring-1 ring-amber-500 font-bold'
                          : 'bg-rose-50 border-rose-500 text-rose-950 shadow-xs ring-1 ring-rose-500 font-bold'
                        : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs font-semibold leading-tight">{label}</span>
                    <span className="text-[10px] text-slate-400 mt-1 capitalize">
                      {key.replace('_', ' ')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. EMPLACEMENT */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-600" />
                  Emplacement Réel
                </label>
                {lastLocation && (
                  <span className="text-[11px] font-mono font-semibold text-amber-900 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 flex items-center gap-1">
                    <span>Mémorisé :</span>
                    <strong>{lastLocation}</strong>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {lastLocation && emplacement !== lastLocation && (
                  <button
                    type="button"
                    onClick={() => setEmplacement(lastLocation)}
                    className="text-xs text-amber-700 hover:text-amber-800 font-semibold underline"
                    title="Reprendre le dernier emplacement saisi"
                  >
                    Reprendre {lastLocation}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsAddingNewLocation(!isAddingNewLocation)}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700"
                >
                  {isAddingNewLocation ? 'Annuler' : '+ Nouvel emplacement'}
                </button>
              </div>
            </div>

            {isAddingNewLocation || locations.length === 0 ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Saisir l'emplacement (Ex: MAG-A-01, RAYON-3, BAC-12...)"
                  value={isAddingNewLocation ? newLocationInput : emplacement}
                  onChange={(e) => {
                    if (isAddingNewLocation) {
                      setNewLocationInput(e.target.value);
                    } else {
                      setEmplacement(e.target.value.toUpperCase());
                    }
                  }}
                  className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono uppercase focus:outline-none focus:border-amber-500 font-bold"
                />
                {isAddingNewLocation && (
                  <button
                    type="button"
                    onClick={handleAddNewLocation}
                    className="px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700"
                  >
                    Ajouter
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={emplacement}
                  onChange={(e) => setEmplacement(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-amber-500 shadow-2xs"
                >
                  <option value="">-- Sélectionner l'emplacement réel --</option>
                  {locations
                    .filter((l) => l.code && l.code !== 'Non renseigné' && l.code !== 'Non assigné')
                    .map((loc) => (
                      <option key={loc.id} value={loc.code}>
                        {loc.code} — {loc.nom}
                      </option>
                    ))}
                  {emplacement &&
                    emplacement !== 'Non renseigné' &&
                    emplacement !== 'Non assigné' &&
                    !locations.some((l) => l.code === emplacement) && (
                      <option value={emplacement}>{emplacement} (Emplacement réel saisi)</option>
                    )}
                </select>
                <div className="text-xs text-slate-500 flex items-center px-1">
                  <span>
                    Zone :{' '}
                    <strong>
                      {locations.find((l) => l.code === emplacement)?.zone || 'Atelier/Magasin'}
                    </strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 4. MACHINE & FAMILLE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Machine */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-600" />
                  Machine Affectée
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewMachine(!isAddingNewMachine)}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  {isAddingNewMachine ? 'Annuler' : '+ Ajouter'}
                </button>
              </div>

              {isAddingNewMachine || machines.length === 0 ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Saisir la machine..."
                    value={isAddingNewMachine ? newMachineInput : machine}
                    onChange={(e) => {
                      if (isAddingNewMachine) setNewMachineInput(e.target.value);
                      else setMachine(e.target.value);
                    }}
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                  {isAddingNewMachine && (
                    <button
                      type="button"
                      onClick={handleAddNewMachine}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium"
                    >
                      OK
                    </button>
                  )}
                </div>
              ) : (
                <select
                  value={machine}
                  onChange={(e) => setMachine(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                >
                  <option value="">-- Sélectionner une machine --</option>
                  {machines.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  {machine && !machines.includes(machine) && (
                    <option value={machine}>{machine} (Saisie)</option>
                  )}
                </select>
              )}
            </div>

            {/* Famille */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <FolderTree className="w-3.5 h-3.5 text-emerald-600" />
                  Famille d'Article
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddingNewFamille(!isAddingNewFamille)}
                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                >
                  {isAddingNewFamille ? 'Annuler' : '+ Ajouter'}
                </button>
              </div>

              {isAddingNewFamille || familles.length === 0 ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Saisir la famille..."
                    value={isAddingNewFamille ? newFamilleInput : famille}
                    onChange={(e) => {
                      if (isAddingNewFamille) setNewFamilleInput(e.target.value);
                      else setFamille(e.target.value);
                    }}
                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
                  />
                  {isAddingNewFamille && (
                    <button
                      type="button"
                      onClick={handleAddNewFamille}
                      className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium"
                    >
                      OK
                    </button>
                  )}
                </div>
              ) : (
                <select
                  value={famille}
                  onChange={(e) => setFamille(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
                >
                  <option value="">-- Sélectionner une famille --</option>
                  {familles.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                  {famille && !familles.includes(famille) && (
                    <option value={famille}>{famille} (Saisie)</option>
                  )}
                </select>
              )}
            </div>
          </div>

          {/* 5. NOTES & OPÉRATEUR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                Observations / Remarques
              </label>
              <input
                type="text"
                placeholder="Ex: Emballage intact, pièce contrôlée..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-500" />
                Opérateur
              </label>
              <input
                type="text"
                value={currentOperator}
                onChange={(e) => setCurrentOperator(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Annuler
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onSaveAndNext && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs"
              >
                <ScanLine className="w-4 h-4 text-amber-400" />
                <span>Enregistrer & Scanner Suivant</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave(false)}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-98"
            >
              <Save className="w-4 h-4" />
              <span>Valider la Saisie</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
