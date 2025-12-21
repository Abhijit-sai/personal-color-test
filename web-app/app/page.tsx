"use client";

import { useState } from "react";
import UploadForm from "@/components/UploadForm";
import CameraCapture from "@/components/CameraCapture";
import FashionResultsView from "@/components/FashionResultsView";
import { Sparkles, Camera, Upload as UploadIcon, Loader2 } from "lucide-react";
import clsx from "clsx";

export default function Home() {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // UI State
  const [showCamera, setShowCamera] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  // Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalysisStart = () => {
    setError(null);
    setIsAnalyzing(true);
  };

  const handleAnalysisComplete = (data: any) => {
    setIsAnalyzing(false);
    if (data.error) {
      setError(data.error);
    } else {
      setResult(data);
    }
  };

  const handleCameraCapture = async (file: File) => {
    // Close camera overlay
    setShowCamera(false);

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);

    handleAnalysisStart();

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed (Error: ${response.status})`);
      }

      let prediction = await response.json();

      // Poll for completion
      while (
        prediction.status !== "succeeded" &&
        prediction.status !== "failed" &&
        prediction.status !== "canceled"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const statusResponse = await fetch(`/api/predictions/${prediction.id}`);
        if (!statusResponse.ok) {
          throw new Error(`Status check failed (Error: ${statusResponse.status})`);
        }
        prediction = await statusResponse.json();
      }

      if (prediction.error || prediction.status === "failed") {
        throw new Error(prediction.error || "Analysis model failed to process image");
      }

      if (prediction.status === "canceled") {
        throw new Error("Analysis was canceled");
      }

      handleAnalysisComplete(prediction.output);

    } catch (err: any) {
      setError(err.message || "Something went wrong.");
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setImagePreview(null);
    setIsAnalyzing(false);
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

          {isAnalyzing ? (
            <div className="max-w-md mx-auto aspect-[3/4] bg-neutral-100 rounded-3xl flex flex-col items-center justify-center text-center p-8 shadow-inner animate-pulse">
              <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
              <h3 className="text-2xl font-bold text-foreground mb-2">Analyzing...</h3>
              <p className="text-neutral-500">Finding your perfect palette</p>
            </div>
          ) : (
            <div className="max-w-md mx-auto space-y-6">

              {/* Primary Action: Camera */}
              <button
                onClick={() => setShowCamera(true)}
                className="group w-full aspect-[4/5] md:aspect-video rounded-3xl bg-black text-white relative overflow-hidden flex flex-col items-center justify-center p-8 transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-black opacity-50 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex flex-col items-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:bg-white/20 transition-colors">
                    <Camera className="w-10 h-10 text-white" />
                  </div>
                  <div className="text-center space-y-1">
                    <h2 className="text-2xl font-bold">Capture Photo</h2>
                    <p className="text-white/60">Open camera & find your light</p>
                  </div>
                </div>
              </button>

              {/* Secondary Action: Upload */}
              <div className={`transition-all duration-300 ${showUpload ? 'opacity-0 h-0 overflow-hidden' : 'opacity-100'}`}>
                <button
                  onClick={() => setShowUpload(true)}
                  className="w-full py-4 text-center text-neutral-500 hover:text-black transition-colors text-sm font-medium flex items-center justify-center gap-2"
                >
                  <UploadIcon className="w-4 h-4" />
                  Or upload an existing photo
                </button>
              </div>

              {/* Inline Upload Form (Hidden by default) */}
              {showUpload && (
                <div className="animate-fade-in-up md:aspect-square">
                  <UploadForm
                    onAnalysisStart={handleAnalysisStart}
                    onAnalysisComplete={handleAnalysisComplete}
                    onPreviewReady={setImagePreview}
                    onError={setError}
                  />
                  <button
                    onClick={() => setShowUpload(false)}
                    className="w-full py-4 text-center text-neutral-400 hover:text-neutral-600 text-xs mt-2"
                  >
                    Cancel Upload
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Full Screen Camera Overlay */}
          {showCamera && (
            <CameraCapture
              onCapture={handleCameraCapture}
              onCancel={() => setShowCamera(false)}
            />
          )}

        </div>

      </main>

      <footer className="mt-20 text-center text-neutral-400 text-xs">
        © 2025 Personal Color AI. Powered by Replicate.
      </footer>
    </div>
  );
}
