import React, { useState } from 'react';
import { InventoryProvider } from './context/InventoryContext';
import { Header, ActiveTab } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { CatalogView } from './components/CatalogView';
import { LocationsMachinesView } from './components/LocationsMachinesView';
import { ExportView } from './components/ExportView';
import { ScannerModal } from './components/ScannerModal';
import { InventoryEntryModal } from './components/InventoryEntryModal';
import { ExcelImportModal } from './components/ExcelImportModal';
import { Article, InventoryEntry } from './types/inventory';
import {
  ScanLine,
  LayoutDashboard,
  FileSpreadsheet,
  Settings,
  Download,
  Plus
} from 'lucide-react';

function InventoryApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // Modals state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<InventoryEntry | null>(null);

  // When article is identified via QR or OCR
  const handleSelectArticleFromScanner = (article: Article, scannedCode?: string) => {
    setSelectedArticle(article);
    setSelectedEntry(null);
    setIsEntryModalOpen(true);
  };

  // When code scanned is unknown
  const handleCodeNotFound = (scannedCode: string) => {
    const tempArticle: Article = {
      id: `temp-${Date.now()}`,
      code_article: scannedCode,
      designation: `Nouvel article (${scannedCode})`,
      reference: scannedCode,
      famille: 'Général',
      machine: 'Ligne Principale',
      unite: 'Pièce',
      emplacement: '',
      quantite: 1
    };
    setSelectedArticle(tempArticle);
    setSelectedEntry(null);
    setIsEntryModalOpen(true);
  };

  const handleCountArticle = (article: Article) => {
    setSelectedArticle(article);
    setSelectedEntry(null);
    setIsEntryModalOpen(true);
  };

  const handleEditEntry = (entry: InventoryEntry) => {
    setSelectedEntry(entry);
    setSelectedArticle(null);
    setIsEntryModalOpen(true);
  };

  const handleSaveAndNext = () => {
    setIsEntryModalOpen(false);
    // Immediately reopen scanner for seamless scanning workflow
    setTimeout(() => {
      setIsScannerOpen(true);
    }, 200);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 pb-20 md:pb-8 flex flex-col">
      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenImport={() => setIsImportOpen(true)}
            onOpenExport={() => setActiveTab('export')}
            onSelectArticleToCount={handleCountArticle}
            onEditEntry={handleEditEntry}
          />
        )}

        {activeTab === 'catalog' && (
          <CatalogView
            onOpenImport={() => setIsImportOpen(true)}
            onCountArticle={handleCountArticle}
          />
        )}

        {activeTab === 'locations' && (
          <LocationsMachinesView
            onOpenImport={() => setIsImportOpen(true)}
          />
        )}

        {activeTab === 'export' && (
          <ExportView />
        )}
      </main>

      {/* Mobile Ergonomic Bottom Tab Bar (Pattern 1 from Mobile Touch Apps skill) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200">
        <div className="grid grid-cols-4 items-center h-16 max-w-md mx-auto">
          {/* Tab 1 */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'dashboard' ? 'text-amber-600 font-bold' : 'text-slate-500'
            }`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] mt-1">Comptage</span>
          </button>

          {/* Tab 2 */}
          <button
            onClick={() => setActiveTab('catalog')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'catalog' ? 'text-amber-600 font-bold' : 'text-slate-500'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-[10px] mt-1">Articles</span>
          </button>

          {/* Tab 3 */}
          <button
            onClick={() => setActiveTab('locations')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'locations' ? 'text-amber-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px] mt-1">Machines</span>
          </button>

          {/* Tab 4 */}
          <button
            onClick={() => setActiveTab('export')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'export' ? 'text-amber-600 font-bold' : 'text-slate-500'
            }`}
          >
            <Download className="w-5 h-5" />
            <span className="text-[10px] mt-1">Exports</span>
          </button>
        </div>
      </div>

      {/* Floating Center Scan Button on Mobile */}
      <div className="md:hidden fixed bottom-5 right-5 z-40">
        <button
          onClick={() => setIsScannerOpen(true)}
          className="w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold flex items-center justify-center shadow-lg shadow-amber-500/30 transition-transform"
          aria-label="Scanner QR ou OCR"
        >
          <ScanLine className="w-6 h-6" />
        </button>
      </div>

      {/* Modals */}
      <ScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSelectArticle={handleSelectArticleFromScanner}
        onCodeNotFound={handleCodeNotFound}
      />

      <InventoryEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        article={selectedArticle}
        existingEntry={selectedEntry}
        onSaveAndNext={handleSaveAndNext}
      />

      <ExcelImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <InventoryProvider>
      <InventoryApp />
    </InventoryProvider>
  );
}
