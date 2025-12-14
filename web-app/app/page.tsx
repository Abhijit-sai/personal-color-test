"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import FashionResultsView from "@/components/FashionResultsView";
import { Sparkles } from "lucide-react";

export default function Home() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleAnalysisStart = () => {
    setError(null);
  };

  const handleAnalysisComplete = (data: any) => {
    if (data.error) {
      setError(data.error);
    } else {
      setResult(data);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  // If we have a result, show the Full Screen Fashion View immediately, bypassing standard layout
  if (result) {
    return (
      <FashionResultsView data={result} image={imagePreview} onReset={handleReset} />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-12 md:py-20 font-sans">
      <main className="max-w-4xl mx-auto space-y-12">

        {/* Header */}
        <header className="text-center space-y-4 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-neutral-200 text-xs text-neutral-500 tracking-wider uppercase mb-2">
            <Sparkles className="w-3 h-3 text-primary" />
            <span>AI Personal Color Analysis</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-heading font-bold text-foreground">
            Discover Your <span className="text-primary italic">True Colors</span>
          </h1>
          <p className="text-neutral-500 text-lg max-w-xl mx-auto leading-relaxed">
            Upload a selfie to instantly find your seasonal color palette using advanced AI.
            Find the colors that make you glow.
          </p>
        </header>

        {/* Content Area */}
        <div className="transition-all duration-500 ease-in-out">
          {error && (
            <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-center text-sm">
              {error}
            </div>
          )}

          <UploadForm
            onAnalysisStart={handleAnalysisStart}
            onAnalysisComplete={handleAnalysisComplete}
            onPreviewReady={setImagePreview}
            onError={setError}
          />
        </div>

      </main>

      <footer className="mt-20 text-center text-neutral-400 text-xs">
        © 2025 Personal Color AI. Powered by Replicate.
      </footer>
    </div>
  );
}
