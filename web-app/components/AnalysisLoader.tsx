import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw, Camera, Zap } from 'lucide-react';
import { validateSingleFace } from '@/lib/faceDetection';
import { useAuth } from '@clerk/nextjs';
import clsx from 'clsx';

interface AnalysisLoaderProps {
    file: File;
    onComplete: (data: any) => void;
    onRetake: () => void;
    onUpgrade?: () => void;
    engineVersion?: string;
}

export default function AnalysisLoader({ file, onComplete, onRetake, onUpgrade, engineVersion }: AnalysisLoaderProps) {
    const { isLoaded, userId, getToken } = useAuth();
    console.log("[AnalysisLoader] isLoaded:", isLoaded, "userId:", userId);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [estimatedTime, setEstimatedTime] = useState(120);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    const hasAnalysisStarted = React.useRef(false);

    const tips = [
        "Your skin tone has unique undertones we're analyzing...",
        "Did you know? The right colors can make your eyes pop!",
        "Comparing your features against 12 seasonal palettes...",
        "Identifying your perfect neutrals for a timeless wardrobe...",
        "We're looking for that 'lit from within' glow in your skin...",
        "Almost there! Your personal style guide is being generated...",
        "You have a beautiful natural palette, let's find it!",
        "Analyzing the harmony between your skin, eyes, and hair...",
    ];

    const runAnalysis = useCallback(async (targetFile: File) => {
        if (hasAnalysisStarted.current) return;
        
        if (!isLoaded || !userId) {
            setError("You must be logged in to run an analysis.");
            setLoading(false);
            return;
        }

        hasAnalysisStarted.current = true;

        setLoading(true);
        setError(null);
        setErrorCode(null);
        setEstimatedTime(120);

        const timer = setInterval(() => {
            setEstimatedTime((prev) => (prev > 10 ? prev - 1 : prev));
        }, 1000);

        const tipRotation = setInterval(() => {
            setCurrentTipIndex((prev) => (prev + 1) % tips.length);
        }, 6000);

        try {
            // Face Detection Validation
            const validation = await validateSingleFace(targetFile);
            if (!validation.isValid) {
                throw new Error(validation.error || "Invalid image.");
            }

            const formData = new FormData();
            formData.append("image", targetFile);

            // Dev-only: forward engine version to API route → Replicate
            if (engineVersion) {
                formData.append("model_version", engineVersion);
            }

            // Skip token if bypass is active
            const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";
            let headers: Record<string, string> = {};

            if (!skipAuth) {
                // Fetch token explicitly if needed, but for same-origin Next.js, 
                // Clerk's standard cookie session management should be preferred.
                // const token = await getToken();
                // if (token) {
                //     headers['Authorization'] = `Bearer ${token}`;
                // }
            } else {
                console.log("[AnalysisLoader] Auth Bypass Active - skipping token");
            }

            const response = await fetch("/api/analyze", {
                method: "POST",
                headers,
                body: formData,
            });
            
            // If it still fails with 401, we might need to add the token back
            if (response.status === 401 && !skipAuth) {
                console.warn("[AnalysisLoader] 401 without token, refetching with token...");
                const token = await getToken();
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                    return fetch("/api/analyze", {
                        method: "POST",
                        headers,
                        body: formData,
                    }).then(r => r.json()); // This is a simplified fallback
                }
            }

            const contentType = response.headers.get("content-type");
            if (!response.ok) {
                let errorMessage = `Analysis failed (Error: ${response.status})`;
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json().catch(() => ({}));
                    errorMessage = errorData.error || errorMessage;
                    if (errorData.code === 'LIMIT_REACHED') {
                        setErrorCode('LIMIT_REACHED');
                    }
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            let prediction = data.prediction;
            const imagePath = data.imagePath;

            // Poll for completion
            while (
                prediction.status !== "succeeded" &&
                prediction.status !== "failed" &&
                prediction.status !== "canceled"
            ) {
                await new Promise((resolve) => setTimeout(resolve, 1500));

                const statusResponse = await fetch(`/api/predictions/${prediction.id}${imagePath ? `?imagePath=${encodeURIComponent(imagePath)}` : ''}`);
                const statusContentType = statusResponse.headers.get("content-type");

                if (!statusResponse.ok) {
                    throw new Error(`Status check failed (Error: ${statusResponse.status})`);
                }

                prediction = await statusResponse.json();
            }

            if (prediction.error || prediction.status === "failed") {
                throw new Error(prediction.error || "Analysis model failed");
            }

            onComplete(prediction.output);
        } catch (err: any) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
            clearInterval(timer);
            clearInterval(tipRotation);
        }
    }, [onComplete, tips.length, isLoaded, userId, engineVersion]);

    useEffect(() => {
        runAnalysis(file);
    }, [file, runAnalysis]);

    const handleRetry = () => {
        hasAnalysisStarted.current = false;
        runAnalysis(file);
    };

    if (error) {
        const isLimitError = errorCode === 'LIMIT_REACHED';

        return (
            <div className="max-w-md mx-auto p-10 bg-white rounded-3xl border border-red-100 shadow-xl text-center space-y-8 animate-in zoom-in-95 duration-300">
                <div className={clsx(
                    "w-20 h-20 rounded-full flex items-center justify-center mx-auto",
                    isLimitError ? "bg-primary/10" : "bg-red-50"
                )}>
                    {isLimitError ? (
                        <Zap className="w-10 h-10 text-primary fill-primary" />
                    ) : (
                        <AlertCircle className="w-10 h-10 text-red-500" />
                    )}
                </div>

                <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-neutral-900">
                        {isLimitError ? "Unlock Full Access" : "Analysis Halted"}
                    </h3>
                    <p className="text-neutral-500 leading-relaxed">
                        {isLimitError
                            ? "You've used your 5 free analyses! Upgrade to Pro to unlock unlimited tries and full reports."
                            : error}
                    </p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                    {isLimitError ? (
                        <button
                            onClick={onUpgrade}
                            className="w-full py-5 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 active:scale-95"
                        >
                            <Zap className="w-5 h-5 fill-white" />
                            Upgrade to Pro — $9
                        </button>
                    ) : (
                        <button
                            onClick={handleRetry}
                            className="w-full py-4 bg-black text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-800 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Retry Analysis
                        </button>
                    )}

                    <button
                        onClick={onRetake}
                        className="w-full py-4 bg-neutral-100 text-neutral-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-neutral-200 transition-all"
                    >
                        <Camera className="w-5 h-5" />
                        {isLimitError ? "Maybe Later" : "Take a New Photo"}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto aspect-[3/4] bg-white rounded-3xl flex flex-col items-center justify-center p-10 shadow-2xl border border-neutral-100 text-center animate-in fade-in duration-500">
            <div className="relative mb-12">
                <div className="w-32 h-32 rounded-full border-4 border-primary/10 flex items-center justify-center">
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                </div>
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-[spin_3s_linear_infinite]" />
            </div>

            <div className="space-y-8 w-full">
                <div className="space-y-2">
                    <div className="text-5xl font-light text-primary tabular-nums tracking-tight">
                        {Math.floor(estimatedTime / 60)}:{(estimatedTime % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.3em] text-neutral-400 font-bold">
                        Estimated Wait Time
                    </div>
                </div>

                <div className="h-20 flex items-center justify-center px-4 bg-neutral-50 rounded-2xl border border-neutral-100/50">
                    <p className="text-sm text-neutral-600 italic leading-relaxed animate-in fade-in zoom-in-95 duration-1000" key={currentTipIndex}>
                        "{tips[currentTipIndex]}"
                    </p>
                </div>

                <div className="text-primary-dark font-bold tracking-widest text-[10px] uppercase flex flex-col items-center justify-center gap-3">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-[1px] bg-primary/20" />
                        Analyzing your unique colors
                        <span className="w-8 h-[1px] bg-primary/20" />
                    </div>
                    {estimatedTime < 90 && (
                        <p className="normal-case font-medium text-neutral-400 mt-2 animate-in fade-in duration-500">
                            Taking longer than expected? You can safely close this page. <br/>
                            We'll save the results to your <span className="text-primary">History</span> automatically.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
