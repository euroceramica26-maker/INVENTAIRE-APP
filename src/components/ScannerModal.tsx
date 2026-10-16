import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { createWorker } from 'tesseract.js';
import {
  Camera,
  X,
  ScanLine,
  FileText,
  Upload,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Database,
  MapPin,
  Cpu,
  Package,
  Layers,
  Sparkles,
  Check,
  RotateCw
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Article, InventoryEntry } from '../types/inventory';
import { ScanMatchResult, ParsedScannedInfo } from '../utils/scanParser';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectArticle: (article: Article, scannedCode?: string, existingEntry?: InventoryEntry) => void;
  onCodeNotFound: (scannedCode: string, parsedData?: ParsedScannedInfo) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectArticle,
  onCodeNotFound
}) => {
  const { matchScannedArticle, articles, entries } = useInventory();
  const [activeTab, setActiveTab] = useState<'qr' | 'ocr'>('qr');

  // Scanner state
  const [qrScanning, setQrScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [scanMatch, setScanMatch] = useState<ScanMatchResult | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // OCR state
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrText, setOcrText] = useState<string>('');
  const [detectedTokens, setDetectedTokens] = useState<{
    token: string;
    article?: Article;
    matchResult?: ScanMatchResult;
  }[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Auto-load countdown timer ref
  const autoLoadTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [autoLoadCountdown, setAutoLoadCountdown] = useState<number | null>(null);

  // Play audio beep on detection
  const playBeep = (success = true) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = success ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(success ? 880 : 440, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // AudioContext might be blocked before user gesture
    }
  };

  const cancelAutoLoad = () => {
    if (autoLoadTimerRef.current) {
      clearTimeout(autoLoadTimerRef.current);
      autoLoadTimerRef.current = null;
    }
    setAutoLoadCountdown(null);
  };

  // Start QR scanning
  const startQrScanner = async () => {
    setCameraError(null);
    setScannedResult(null);
    setScanMatch(null);
    cancelAutoLoad();

    try {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch {
          // ignore stop error
        }
      }

      const scanner = new Html5Qrcode('qr-reader-container', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
          Html5QrcodeSupportedFormats.DATA_MATRIX
        ],
        verbose: false
      });
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 }
        },
        (decodedText) => {
          handleScanSuccess(decodedText);
        },
        () => {
          // Frame without code, ignore
        }
      );
      setQrScanning(true);
    } catch (err: any) {
      console.error('Camera QR error:', err);
      setCameraError(
        err?.message ||
          "Impossible d'accéder à la caméra. Vérifiez les autorisations de votre navigateur."
      );
      setQrScanning(false);
    }
  };

  const stopQrScanner = async () => {
    cancelAutoLoad();
    if (html5QrCodeRef.current && qrScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      } catch (e) {
        console.warn('Error stopping scanner', e);
      }
    }
    setQrScanning(false);
  };

  /**
   * Handle decoded scan string (from camera or uploaded file)
   * 1. Parse into code_article, designation, reference
   * 2. Compare with article database
   * 3. Prepare reload into inventory entry modal
   */
  const handleScanSuccess = async (decodedText: string) => {
    playBeep(true);
    setScannedResult(decodedText);
    await stopQrScanner();

    // Compare with database using full multi-field parser
    const match = matchScannedArticle(decodedText);
    setScanMatch(match);

    if (match.matchedArticle) {
      // Auto-load after a brief visual review (1.5 seconds) so operator can see comparison
      setAutoLoadCountdown(2);
      autoLoadTimerRef.current = setTimeout(() => {
        handleLoadArticle(match.matchedArticle!, decodedText, match.existingEntry);
      }, 1600);
    }
  };

  const handleLoadArticle = (
    art: Article,
    rawCode?: string,
    existing?: InventoryEntry
  ) => {
    cancelAutoLoad();
    onSelectArticle(art, rawCode, existing);
    onClose();
  };

  const handleCreateNewArticle = (parsedData: ParsedScannedInfo, rawCode: string) => {
    cancelAutoLoad();
    onCodeNotFound(rawCode, parsedData);
    onClose();
  };

  // Start live OCR camera stream
  const startOcrCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch {
      setCameraError("Erreur caméra pour l'OCR. Vous pouvez aussi téléverser une photo.");
    }
  };

  const stopOcrCamera = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  // Run OCR on an image element or canvas
  const processImageOcr = async (imageSource: string | HTMLCanvasElement) => {
    setOcrProcessing(true);
    setOcrProgress(5);
    setOcrText('');
    setDetectedTokens([]);
    setScanMatch(null);
    cancelAutoLoad();

    try {
      const worker = await createWorker('fra+eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      const ret = await worker.recognize(imageSource);
      await worker.terminate();

      const text = ret.data.text.trim();
      setOcrText(text);

      // Compare the full OCR text with article database
      const fullMatch = matchScannedArticle(text);
      if (fullMatch.matchedArticle) {
        setScanMatch(fullMatch);
        playBeep(true);
      }

      // Also extract candidate tokens and lines from the text
      const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length >= 3);

      const words = text
        .split(/[\s,;:\n\r]+/)
        .map((w) => w.replace(/[^A-Za-z0-9_.-]/g, '').trim())
        .filter((w) => w.length >= 3);

      const candidateStrings = Array.from(new Set([...lines, ...words]));

      const tokenMatches = candidateStrings
        .map((token) => {
          const matchResult = matchScannedArticle(token);
          return {
            token,
            article: matchResult.matchedArticle,
            matchResult
          };
        })
        .filter((item) => item.article !== undefined || item.token.length >= 4);

      // Sort with database matches first
      tokenMatches.sort((a, b) => {
        if (a.article && !b.article) return -1;
        if (!a.article && b.article) return 1;
        return b.token.length - a.token.length;
      });

      setDetectedTokens(tokenMatches.slice(0, 15));
      setOcrProcessing(false);

      if (tokenMatches.some((t) => t.article)) {
        playBeep(true);
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setOcrProcessing(false);
      setOcrText("Erreur lors de l'analyse OCR. Veuillez réessayer avec un éclairage plus direct.");
    }
  };

  // Capture video frame to canvas
  const captureOcrSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    processImageOcr(canvas);
  };

  // Upload image file for OCR or QR
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (activeTab === 'qr') {
        try {
          const scanner = new Html5Qrcode('qr-reader-container');
          const result = await scanner.scanFile(file, true);
          handleScanSuccess(result);
        } catch {
          setCameraError(
            "Aucun QR/Code-barres détecté sur l'image. Basculez sur l'onglet OCR pour lire le texte."
          );
        }
      } else {
        processImageOcr(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'qr') {
        startQrScanner();
      } else {
        startOcrCamera();
      }
    } else {
      stopQrScanner();
      stopOcrCamera();
      cancelAutoLoad();
    }

    return () => {
      stopQrScanner();
      stopOcrCamera();
      cancelAutoLoad();
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Lecteur & Comparaison Base d'Articles
              </h2>
              <p className="text-xs text-slate-500">
                Extraction Code Article, Désignation, Référence et recharge pour inventaire
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              cancelAutoLoad();
              onClose();
            }}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch: QR vs OCR */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl">
            <button
              onClick={() => {
                cancelAutoLoad();
                setActiveTab('qr');
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'qr'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ScanLine className="w-4 h-4 text-amber-600" />
              <span>QR Code & Code-Barres</span>
            </button>
            <button
              onClick={() => {
                cancelAutoLoad();
                setActiveTab('ocr');
              }}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'ocr'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>OCR Texte & Plaque Signalétique</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {activeTab === 'qr' ? (
            <div className="space-y-4">
              {/* QR Camera Viewfinder */}
              <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center">
                <div id="qr-reader-container" className="w-full h-full" />

                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center p-6 text-center text-white">
                    <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
                    <p className="text-sm font-medium mb-3">{cameraError}</p>
                    <button
                      onClick={startQrScanner}
                      className="px-4 py-2 bg-amber-500 text-slate-950 font-semibold text-xs rounded-lg hover:bg-amber-400 flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Réessayer la caméra
                    </button>
                  </div>
                )}
              </div>

              {/* Scanned & Compared Result Card */}
              {scanMatch && (
                <div
                  className={`rounded-xl border p-4 transition-all shadow-xs ${
                    scanMatch.matchedArticle
                      ? 'bg-emerald-50/70 border-emerald-300'
                      : 'bg-amber-50/70 border-amber-300'
                  }`}
                >
                  {/* Top Status Banner */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-3">
                    <div className="flex items-center gap-2">
                      {scanMatch.matchedArticle ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center">
                          <AlertCircle className="w-4 h-4" />
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                          {scanMatch.matchedArticle
                            ? 'Article Reconnu dans la Base'
                            : 'Article Non Référencé'}
                        </span>
                        <p className="text-[11px] text-slate-500">{scanMatch.matchDescription}</p>
                      </div>
                    </div>

                    {autoLoadCountdown !== null && scanMatch.matchedArticle && (
                      <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full animate-pulse">
                        Ouverture auto...
                      </span>
                    )}
                  </div>

                  {/* 3 Key Scanned Fields Comparison Block */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Informations Reçues au Scan :
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/90 p-3 rounded-lg border border-slate-200 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          Code Article :
                        </span>
                        <span className="font-mono font-bold text-slate-900 break-all">
                          {scanMatch.parsedData.code_article || '(Non détecté)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          Désignation :
                        </span>
                        <span className="font-semibold text-slate-800 break-words">
                          {scanMatch.parsedData.designation || '(Non spécifiée)'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">
                          Référence :
                        </span>
                        <span className="font-mono text-slate-700 break-all">
                          {scanMatch.parsedData.reference || '(Non spécifiée)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* If Matched in Database: Loaded Catalog Details & Action */}
                  {scanMatch.matchedArticle ? (
                    <div className="mt-3 pt-3 border-t border-emerald-200/80 space-y-3">
                      <div className="bg-white/95 p-3 rounded-lg border border-emerald-300">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 mb-1.5">
                          <Database className="w-3.5 h-3.5" />
                          <span>Données Rechargées de la Base du Catalogue :</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 block">Machine :</span>
                            <span className="font-semibold text-slate-900">
                              {scanMatch.matchedArticle.machine || 'Standard'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Emplacement :</span>
                            <span className="font-semibold text-slate-900">
                              {scanMatch.matchedArticle.emplacement || 'Non assigné'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Famille :</span>
                            <span className="font-semibold text-slate-900">
                              {scanMatch.matchedArticle.famille || 'Général'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">Unité :</span>
                            <span className="font-semibold text-slate-900">
                              {scanMatch.matchedArticle.unite || 'Pièce'}
                            </span>
                          </div>
                        </div>

                        {/* Existing inventory entry notice */}
                        {scanMatch.existingEntry && (
                          <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200 text-amber-900 text-[11px] flex items-center justify-between">
                            <span>
                              ⚠️ Déjà saisi dans l'inventaire :{' '}
                              <strong>
                                {scanMatch.existingEntry.quantite} {scanMatch.existingEntry.unite}
                              </strong>{' '}
                              à <strong>{scanMatch.existingEntry.emplacement}</strong>
                            </span>
                            <span className="text-[10px] bg-amber-200/80 px-1.5 py-0.5 rounded font-semibold uppercase">
                              Modifier
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Primary Button: Recharge & Open Inventory Entry */}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={startQrScanner}
                          className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
                        >
                          Scanner un autre
                        </button>
                        <button
                          onClick={() =>
                            handleLoadArticle(
                              scanMatch.matchedArticle!,
                              scannedResult || undefined,
                              scanMatch.existingEntry
                            )
                          }
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all"
                        >
                          <span>Recharger & Saisir l'inventaire</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Not matched in database -> Create candidate */
                    <div className="mt-3 pt-3 border-t border-amber-200 space-y-2">
                      <p className="text-xs text-amber-900">
                        Cet article n'est pas encore présent dans la base. Les informations extraites
                        seront chargées pour vous permettre de l'enregistrer et de saisir sa quantité.
                      </p>
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          onClick={startQrScanner}
                          className="px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded-xl"
                        >
                          Réessayer le scan
                        </button>
                        <button
                          onClick={() =>
                            handleCreateNewArticle(
                              scanMatch.parsedData,
                              scannedResult || scanMatch.parsedData.code_article
                            )
                          }
                          className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                        >
                          <span>Créer & Saisir cet article</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Upload image alternative */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <label className="cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-100">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Importer photo QR / Code-barres</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
                <button
                  onClick={startQrScanner}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Redémarrer caméra</span>
                </button>
              </div>
            </div>
          ) : (
            /* OCR Mode */
            <div className="space-y-4">
              {/* OCR Viewfinder with Snapshot Button */}
              <div className="relative bg-slate-950 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Target Alignment Crosshairs */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-72 h-36 border-2 border-dashed border-amber-400/90 rounded-lg bg-amber-500/5 flex flex-col items-center justify-center p-2 text-center">
                    <span className="text-[11px] font-mono text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded">
                      Cadrer la plaque signalétique ou l'étiquette
                    </span>
                    <span className="text-[10px] text-slate-300 mt-1">
                      Code Article, Désignation & Référence
                    </span>
                  </div>
                </div>

                {ocrProcessing && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white text-center">
                    <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin mb-3" />
                    <p className="text-sm font-semibold">Analyse OCR & Comparaison Base...</p>
                    <p className="text-xs text-slate-400 mt-1">Progression : {ocrProgress}%</p>
                  </div>
                )}
              </div>

              {/* OCR Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={captureOcrSnapshot}
                  disabled={ocrProcessing}
                  className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>Photographier & Comparer avec la Base</span>
                </button>
                <label className="cursor-pointer py-3 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition-colors">
                  <Upload className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {/* Best Matched Article from OCR */}
              {scanMatch && scanMatch.matchedArticle && (
                <div className="p-4 rounded-xl border bg-emerald-50 border-emerald-300 text-emerald-950 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      <span className="text-xs font-bold uppercase tracking-wider">
                        Article Correspondant Trouvé !
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                      {scanMatch.matchedArticle.code_article}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white/90 p-3 rounded-lg border border-emerald-200 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Code Article :
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {scanMatch.matchedArticle.code_article}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Désignation :
                      </span>
                      <span className="font-semibold text-slate-800">
                        {scanMatch.matchedArticle.designation}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">
                        Référence :
                      </span>
                      <span className="font-mono text-slate-700">
                        {scanMatch.matchedArticle.reference || '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() =>
                        handleLoadArticle(
                          scanMatch.matchedArticle!,
                          scanMatch.matchedArticle!.code_article,
                          scanMatch.existingEntry
                        )
                      }
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-sm"
                    >
                      <span>Recharger cet article dans l'inventaire</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Detected Tokens / Candidates List */}
              {detectedTokens.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Éléments extraits & Références ({detectedTokens.length})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Cliquez pour recharger dans l'inventaire
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                    {detectedTokens.map(({ token, article, matchResult }, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (article) {
                            handleLoadArticle(article, token, matchResult?.existingEntry);
                          } else {
                            handleCreateNewArticle(
                              matchResult?.parsedData || {
                                code_article: token,
                                designation: `Article ${token}`,
                                reference: token
                              },
                              token
                            );
                          }
                        }}
                        className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
                          article
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900 hover:bg-emerald-100 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {article ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="font-bold">{token}</span>
                        {article && (
                          <span className="text-[10px] text-emerald-700 font-sans max-w-[140px] truncate">
                            ({article.designation})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw OCR Text output */}
              {ocrText && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">
                  <span className="font-sans font-bold text-slate-500 block text-[11px] mb-1">
                    Texte brut reconnu par la caméra :
                  </span>
                  {ocrText}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>
              <strong>{articles.length}</strong> articles dans la base de données
            </span>
          </div>
          <button
            onClick={() => {
              cancelAutoLoad();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
