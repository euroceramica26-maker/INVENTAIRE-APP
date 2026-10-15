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
  Zap,
  ArrowRight
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { Article } from '../types/inventory';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectArticle: (article: Article, scannedCode?: string) => void;
  onCodeNotFound: (scannedCode: string) => void;
}

export const ScannerModal: React.FC<ScannerModalProps> = ({
  isOpen,
  onClose,
  onSelectArticle,
  onCodeNotFound
}) => {
  const { findArticleByCodeOrDesignation, articles } = useInventory();
  const [activeTab, setActiveTab] = useState<'qr' | 'ocr'>('qr');
  
  // QR scanner state
  const [qrScanning, setQrScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [matchedArticle, setMatchedArticle] = useState<Article | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // OCR state
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrText, setOcrText] = useState<string>('');
  const [detectedTokens, setDetectedTokens] = useState<{ token: string; article?: Article }[]>([]);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Play audio beep on detection
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // AudioContext might be blocked before interaction
    }
  };

  // Start QR scanning
  const startQrScanner = async () => {
    setCameraError(null);
    setScannedResult(null);
    setMatchedArticle(null);

    try {
      if (html5QrCodeRef.current) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {
          // ignore
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
          Html5QrcodeSupportedFormats.ITF
        ],
        verbose: false
      });
      html5QrCodeRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
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
        "Impossible d'accéder à la caméra. Vérifiez les permissions de votre navigateur."
      );
      setQrScanning(false);
    }
  };

  const stopQrScanner = async () => {
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

  const handleScanSuccess = async (decodedText: string) => {
    playBeep();
    setScannedResult(decodedText);
    await stopQrScanner();

    const matched = findArticleByCodeOrDesignation(decodedText);
    if (matched) {
      setMatchedArticle(matched);
      // Auto open after brief visual confirmation
      setTimeout(() => {
        onSelectArticle(matched, decodedText);
        onClose();
      }, 700);
    } else {
      setMatchedArticle(null);
    }
  };

  // Start live OCR camera stream
  const startOcrCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err: any) {
      setCameraError("Erreur caméra pour l'OCR. Vous pouvez aussi téléverser une photo.");
    }
  };

  const stopOcrCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  // Run OCR on an image element or canvas
  const processImageOcr = async (imageSource: string | HTMLCanvasElement) => {
    setOcrProcessing(true);
    setOcrProgress(5);
    setOcrText('');
    setDetectedTokens([]);

    try {
      const worker = await createWorker('eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrProgress(Math.round(m.progress * 100));
          }
        }
      });

      const ret = await worker.recognize(imageSource);
      await worker.terminate();

      const text = ret.data.text.trim();
      setOcrText(text);

      // Extract tokens (words, codes, part numbers)
      const rawWords = text
        .split(/[\s,;:\n\r]+/)
        .map(w => w.replace(/[^A-Za-z0-9_-]/g, '').trim())
        .filter(w => w.length >= 3);

      const uniqueWords = Array.from(new Set(rawWords));
      
      const tokenMatches = uniqueWords.map(token => {
        const article = findArticleByCodeOrDesignation(token);
        return { token, article };
      });

      // Sort tokens with matches first
      tokenMatches.sort((a, b) => {
        if (a.article && !b.article) return -1;
        if (!a.article && b.article) return 1;
        return b.token.length - a.token.length;
      });

      setDetectedTokens(tokenMatches);
      setOcrProcessing(false);

      // If an exact code was matched, play sound
      if (tokenMatches.some(t => t.article)) {
        playBeep();
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

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Apply high-contrast preprocessing to enhance industrial tags
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      // Contrast stretch
      const threshold = 128;
      const v = gray > threshold ? Math.min(255, gray * 1.15) : Math.max(0, gray * 0.85);
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
    }
    ctx.putImageData(imgData, 0, 0);

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
        } catch (err) {
          // If QR not found in file, try OCR
          setCameraError("Aucun QR/Code-barres détecté sur l'image. Basculez sur l'onglet OCR pour lire le texte.");
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
    }

    return () => {
      stopQrScanner();
      stopOcrCamera();
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <ScanLine className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 leading-tight">
                Lecteur Optique & Reconnaissance
              </h2>
              <p className="text-xs text-slate-500">Scan QR Code, Code-Barres ou OCR plaque</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Segmented Mode Selector */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl">
            <button
              onClick={() => setActiveTab('qr')}
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
              onClick={() => setActiveTab('ocr')}
              className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'ocr'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>OCR Texte & Plaque</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === 'qr' ? (
            <div className="space-y-4">
              {/* QR Reader Viewfinder */}
              <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center">
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

              {/* Scanned Result Banner */}
              {scannedResult && (
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    matchedArticle
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                      : 'bg-amber-50 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {matchedArticle ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {matchedArticle ? 'Article Identifié' : 'Code non référencé'}
                        </span>
                        <span className="text-xs font-mono font-bold bg-white/70 px-2 py-0.5 rounded border border-slate-200">
                          {scannedResult}
                        </span>
                      </div>

                      {matchedArticle ? (
                        <div className="mt-2">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {matchedArticle.designation}
                          </p>
                          <p className="text-xs text-slate-600 mt-0.5">
                            Machine : {matchedArticle.machine} · Emplacement : {matchedArticle.emplacement}
                          </p>
                          <div className="mt-3 flex justify-end">
                            <button
                              onClick={() => {
                                onSelectArticle(matchedArticle, scannedResult);
                                onClose();
                              }}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg flex items-center gap-1.5 shadow-sm"
                            >
                              <span>Ouvrir la fiche de comptage</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <p className="text-xs text-slate-700">
                            Ce code ne correspond à aucun article du catalogue. Vous pouvez l'ajouter ou rechercher manuellement.
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => {
                                onCodeNotFound(scannedResult);
                                onClose();
                              }}
                              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs rounded-lg flex items-center gap-1"
                            >
                              Créer cet article
                            </button>
                            <button
                              onClick={startQrScanner}
                              className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs rounded-lg"
                            >
                              Scanner un autre code
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Upload image alternative */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <label className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1.5 py-1 px-2 rounded-lg hover:bg-slate-100">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span>Importer une photo du code</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </label>
                <button
                  onClick={startQrScanner}
                  className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Redémarrer caméra</span>
                </button>
              </div>
            </div>
          ) : (
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
                  <div className="w-64 h-32 border-2 border-dashed border-amber-400/80 rounded-lg bg-amber-500/5 flex items-center justify-center">
                    <span className="text-[11px] font-mono text-amber-300 bg-slate-950/80 px-2 py-0.5 rounded">
                      Cadrer le texte / la plaque
                    </span>
                  </div>
                </div>

                {ocrProcessing && (
                  <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-xs flex flex-col items-center justify-center p-6 text-white text-center">
                    <div className="w-12 h-12 rounded-full border-4 border-amber-500 border-t-transparent animate-spin mb-3" />
                    <p className="text-sm font-semibold">Lecture OCR en cours...</p>
                    <p className="text-xs text-slate-400 mt-1">Progression : {ocrProgress}%</p>
                  </div>
                )}
              </div>

              {/* OCR Action Trigger */}
              <div className="flex items-center gap-2">
                <button
                  onClick={captureOcrSnapshot}
                  disabled={ocrProcessing}
                  className="flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all"
                >
                  <Camera className="w-4 h-4 text-amber-400" />
                  <span>Photographier & Analyser le texte (OCR)</span>
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

              {/* Detected Text & Token Cards */}
              {detectedTokens.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Références & Mots-clés extraits ({detectedTokens.length})
                    </span>
                    <span className="text-[11px] text-slate-400">Cliquez pour sélectionner</span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1">
                    {detectedTokens.map(({ token, article }, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (article) {
                            onSelectArticle(article, token);
                            onClose();
                          } else {
                            onCodeNotFound(token);
                            onClose();
                          }
                        }}
                        className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 border ${
                          article
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {article ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        ) : (
                          <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="font-semibold">{token}</span>
                        {article && (
                          <span className="text-[10px] text-emerald-700 font-sans max-w-[120px] truncate">
                            ({article.designation})
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Raw OCR Text output if any */}
              {ocrText && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-28 overflow-y-auto">
                  <span className="font-sans font-bold text-slate-500 block text-[11px] mb-1">
                    Texte brut reconnu :
                  </span>
                  {ocrText}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {articles.length} articles chargés dans la base
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
