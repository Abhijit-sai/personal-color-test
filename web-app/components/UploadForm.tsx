"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, ImageIcon } from "lucide-react";
import clsx from "clsx";

interface UploadFormProps {
    onAnalysisStart: () => void;
    onAnalysisComplete: (data: any) => void;
    onPreviewReady?: (url: string) => void;
    onError: (error: string) => void;
}

export default function UploadForm({ onAnalysisStart, onAnalysisComplete, onPreviewReady, onError }: UploadFormProps) {
    const [loading, setLoading] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        // Show preview
        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);
        if (onPreviewReady) onPreviewReady(objectUrl);
        setLoading(true);
        onAnalysisStart();

        // Convert file to base64 for API (simplest for now, or use FormData)
        // For large files, FormData is better, but Replicate API via proxy often accepts URL or base64.
        // We'll use FormData to send to our Next.js API route.
        const formData = new FormData();
        formData.append("image", file);

        try {
            const response = await fetch("/api/analyze", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Analysis failed (Error: ${response.status})`);
            }

            let prediction = await response.json();
            console.log("Analysis started:", prediction.id);

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

            onAnalysisComplete(prediction.output);

        } catch (err: any) {
            onError(err.message || "Something went wrong. Please try again.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [onAnalysisStart, onAnalysisComplete, onError]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'image/*': ['.jpeg', '.jpg', '.png', '.webp']
        },
        maxFiles: 1,
        multiple: false
    });

    return (
        <div className="w-full max-w-md mx-auto">
            <div
                {...getRootProps()}
                className={clsx(
                    "relative border-2 border-dashed rounded-3xl p-10 text-center transition-all duration-300 cursor-pointer overflow-hidden",
                    isDragActive ? "border-primary bg-primary-light" : "border-neutral-200 hover:border-primary hover:bg-neutral-50",
                    loading && "opacity-50 pointer-events-none"
                )}
            >
                <input {...getInputProps()} />

                {preview ? (
                    <div className="relative z-10">
                        <img src={preview} alt="Preview" className="w-32 h-32 mx-auto rounded-full object-cover border-4 border-white shadow-lg mb-4" />
                        {loading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 rounded-full">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center space-y-4 text-neutral-500">
                        <div className="p-4 bg-sage-light rounded-full mb-2">
                            <Upload className="w-8 h-8 text-sage" />
                        </div>
                        <div>
                            <p className="text-lg font-medium text-foreground">Upload your selfie</p>
                            <p className="text-sm">or drag and drop here</p>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="mt-4 text-primary font-medium">Analyzing your colors...</div>
                )}
            </div>

            <p className="text-xs text-center text-neutral-400 mt-4">
                Best results with natural lighting. No makeup recommended.
            </p>
        </div>
    );
}
