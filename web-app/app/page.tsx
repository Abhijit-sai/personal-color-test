"use client";

import { useState, useEffect } from "react";
import LandingPage from "@/components/LandingPage";
import UploadForm from "@/components/UploadForm";
import CameraCapture from "@/components/CameraCapture";
import FashionResultsView from "@/components/FashionResultsView";
import CheckoutOverlay from "@/components/CheckoutOverlay";
import AnalysisLoader from "@/components/AnalysisLoader";
import AuthOverlay from "@/components/AuthOverlay";
import { supabase } from "@/lib/supabaseClient";
import { Sparkles, Camera, Upload as UploadIcon, ArrowLeft, LogOut, User, FlaskConical } from "lucide-react";
import clsx from "clsx";

import { useAuth, useUser, SignOutButton } from "@clerk/nextjs";
import HistoryView from "@/components/HistoryView";

export default function Home() {
  const { userId, isLoaded: isAuthLoaded } = useAuth();
  const { user: clerkUser, isLoaded: isUserLoaded } = useUser();
  const [showLanding, setShowLanding] = useState(true);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Auth Overlay State
  const [showAuth, setShowAuth] = useState(false);

  // Payment State
  const [isPaid, setIsPaid] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);

  // UI State
  const [showCamera, setShowCamera] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [view, setView] = useState<'main' | 'history'>('main');
  const [reportSource, setReportSource] = useState<'main' | 'history'>('main');

  // Analysis State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Engine version toggle (defaults to v2 for latest model)
  const [engineVersion, setEngineVersion] = useState<string>("v2");
  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE === "true";

  // History State
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  // Sync session state with Landing Visibility
  useEffect(() => {
    if (isAuthLoaded && userId) {
      setShowLanding(false);
      setShowAuth(false);
      fetchHistory();
    }

    // NEW: If we see an SSO callback in the hash but aren't logged in yet,
    // we MUST show the AuthOverlay so the <SignIn /> component can process it.
    if (isAuthLoaded && !userId && typeof window !== 'undefined' && window.location.hash.includes('sso-callback')) {
      setShowAuth(true);
    }

    // Check for payment session
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.has('session_id')) {
      setIsPaid(true);
      setShowLanding(false);
    }
  }, [isAuthLoaded, userId]);

  const fetchHistory = async () => {
    if (!userId) return;
    setIsHistoryLoading(true);
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistoryItems(data);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleStartAnalysis = () => {
    if (!userId) {
      setShowAuth(true);
    } else {
      setShowLanding(false);
      setView('main');
    }
  };

  const handleLogout = () => {
    handleReset();
    setShowLanding(true);
    setHistoryItems([]);
  };

  const handleHistorySelect = (item: any) => {
    setResult(item);
    setImagePreview(item.image_url);
    setReportSource('history');
    setView('main');
  };

  const handleCheckout = async () => {
    setIsCheckoutLoading(true);
    try {
      const res = await fetch('/api/checkout', { method: 'POST' });
      const contentType = res.headers.get("content-type");

      if (!res.ok) {
        let errMsg = `Checkout failed (Error: ${res.status})`;
        if (contentType && contentType.includes("application/json")) {
          const errData = await res.json().catch(() => ({}));
          errMsg = errData.error || errMsg;
        }
        throw new Error(errMsg);
      }

      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned an invalid response for checkout.");
      }

      const { url, error } = await res.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err: any) {
      setError(err.message || 'Failed to start checkout');
      setIsCheckoutLoading(false);
    }
  };

  const handleAnalysisStart = () => {
    setError(null);
  };

  const handleAnalysisComplete = (data: any) => {
    if (data.error) {
      setError(data.error);
    } else {
      setResult(data);
      setReportSource('main');
      fetchHistory(); // Refresh history after new analysis
    }
  };

  const handleFileSelected = (file: File) => {
    setError(null);
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
    setShowCamera(false);
    setShowUpload(false);
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setImagePreview(null);
    setSelectedFile(null);
    setView('main');
    setReportSource('main');
  };

  const handleCloseReport = () => {
    setResult(null);
    setImagePreview(null);
    setSelectedFile(null);
    setShowUpload(false);
    setShowCamera(false);
    if (reportSource === 'history') {
      setView('history');
    } else {
      setView('main');
    }
    setReportSource('main');
  };

  // Main Navigation logic

  return (
    <main className={clsx(
      "min-h-screen relative overflow-hidden flex flex-col items-center justify-center",
      !showLanding && !result && "bg-black p-6",
      showLanding && "bg-white",
      result && "bg-neutral-50"
    )}>
      {/* 1. LAYER: OVERLAYS */}
      <AuthOverlay
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
      />

      {!isPaid && showCheckout && (
        <CheckoutOverlay
          onCheckout={handleCheckout}
          onCancel={() => setShowCheckout(false)}
          isLoading={isCheckoutLoading}
        />
      )}

      {/* 2. LAYER: VIEW CONTENT */}
      {result ? (
        <FashionResultsView
          data={result}
          image={imagePreview}
          onReset={handleReset}
          onClose={handleCloseReport}
        />
      ) : showLanding ? (
        <LandingPage onStart={handleStartAnalysis} />
      ) : (
        <>
          {/* Background Gradients */}
          <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px]" />
          </div>

          {/* Header Actions */}
          <div className="absolute top-8 right-8 z-30 flex items-center gap-4 no-print">
            {userId && clerkUser && (
              <div className="flex items-center gap-3">
                <div className="px-5 py-2.5 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 text-white/90 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 shadow-2xl">
                  <User className="w-3.5 h-3.5 text-primary-light" />
                  {clerkUser.firstName || clerkUser.emailAddresses[0]?.emailAddress.split('@')[0]}
                </div>
                <SignOutButton>
                  <button
                    onClick={handleLogout}
                    className="p-3 bg-white/5 backdrop-blur-xl text-white/50 hover:text-white rounded-full border border-white/10 transition-all hover:bg-white/10 shadow-2xl group"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </button>
                </SignOutButton>
              </div>
            )}
          </div>

          {/* Dev-Only: Engine Version Toggle */}
          {isDevMode && (
            <div className="absolute top-8 left-8 z-30 no-print">
              <button
                onClick={() => setEngineVersion(prev => prev === "v1" ? "v2" : "v1")}
                className={clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border transition-all backdrop-blur-xl shadow-lg",
                  engineVersion === "v2"
                    ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/30"
                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/80"
                )}
                title={`Engine: ${engineVersion}. Click to switch.`}
              >
                <FlaskConical className="w-3.5 h-3.5" />
                Engine {engineVersion.toUpperCase()}
                <span className={clsx(
                  "w-2 h-2 rounded-full",
                  engineVersion === "v2" ? "bg-emerald-400 animate-pulse" : "bg-white/30"
                )} />
              </button>
            </div>
          )}

          {/* Tab Navigation (Main vs History) */}
          {!showCamera && !showUpload && !selectedFile && (
            <div className="fixed top-8 left-1/2 -translate-x-1/2 z-30 flex items-center p-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl no-print">
              <button
                onClick={() => setView('main')}
                className={clsx(
                  "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  view === 'main' ? "bg-white text-black shadow-xl" : "text-white/40 hover:text-white"
                )}
              >
                Analyze
              </button>
              <button
                onClick={() => setView('history')}
                className={clsx(
                  "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  view === 'history' ? "bg-white text-black shadow-xl" : "text-white/40 hover:text-white"
                )}
              >
                History ({historyItems.length})
              </button>
            </div>
          )}

          {view === 'history' && !showCamera && !showUpload && !selectedFile ? (
            <HistoryView
              items={historyItems}
              onSelectItem={handleHistorySelect}
              onNewAnalysis={() => setView('main')}
            />
          ) : (
            <>
              {/* Main Choice UI */}
              {!showCamera && !showUpload && !selectedFile && (
                <div className="relative z-10 w-full max-w-lg space-y-12 text-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
                  <div className="space-y-6">
                    <div className="w-24 h-24 bg-primary/20 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 shadow-2xl shadow-primary/20 border border-primary/30 rotate-3">
                      <Sparkles className="text-primary-light w-12 h-12 drop-shadow-glow" />
                    </div>
                    <h2 className="text-5xl md:text-7xl font-serif text-white leading-tight tracking-tight">
                      Your <span className="italic opacity-80 decoration-primary-light/30 underline">Fashion</span> <br />
                      <span className="font-sans font-black tracking-tighter uppercase text-6xl md:text-8xl bg-clip-text text-transparent bg-gradient-to-t from-white/40 to-white">Aura</span>
                    </h2>
                  </div>

                  <div className="flex flex-col gap-5 pt-8">
                    <button
                      onClick={() => setShowCamera(true)}
                      className="group relative overflow-hidden p-0.5 rounded-[2rem] bg-gradient-to-br from-primary via-primary-light to-secondary transition-all hover:scale-[1.03] active:scale-95 shadow-2xl shadow-primary/20"
                    >
                      <div className="flex items-center justify-center gap-4 py-6 px-10 bg-black rounded-[1.9rem] transition-colors group-hover:bg-black/90">
                        <Camera className="w-7 h-7 text-primary-light" />
                        <span className="text-sm font-black uppercase tracking-[0.2em] text-white">Capture Live Studio</span>
                      </div>
                    </button>

                    <button
                      onClick={() => setShowUpload(true)}
                      className="py-6 bg-white/5 backdrop-blur-xl border border-white/10 text-white/90 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 flex items-center justify-center gap-4 group shadow-xl"
                    >
                      <UploadIcon className="w-5 h-5 text-neutral-400 group-hover:text-white transition-colors" />
                      Upload Portrait
                    </button>
                  </div>
                </div>
              )}

              {/* Module: Live Camera */}
              {showCamera && (
                <CameraCapture
                  onCapture={handleFileSelected}
                  onCancel={() => setShowCamera(false)}
                />
              )}

              {/* Module: File Upload */}
              {showUpload && (
                <div className="relative z-10 w-full max-w-xl animate-in zoom-in-95 duration-500">
                  <UploadForm onFileSelected={handleFileSelected} />
                  <button
                    onClick={() => setShowUpload(false)}
                    className="mt-10 flex items-center gap-3 text-neutral-500 hover:text-white transition-all mx-auto text-[10px] font-black uppercase tracking-[0.3em]"
                  >
                    <ArrowLeft className="w-4 h-4" /> Cancel & Return
                  </button>
                </div>
              )}

              {/* Module: Analysis Pipeline */}
              {selectedFile && !result && (
                <div className="relative z-10 w-full max-w-md animate-in fade-in duration-500">
                  <AnalysisLoader
                    file={selectedFile}
                    onComplete={handleAnalysisComplete}
                    onRetake={handleReset}
                    onUpgrade={() => setShowCheckout(true)}
                    engineVersion={engineVersion}
                  />
                </div>
              )}
            </>
          )}

        </>
      )}
    </main>
  );
}
