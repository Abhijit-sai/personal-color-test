"use client";

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import clsx from "clsx";

interface UploadFormProps {
    onFileSelected: (file: File) => void;
}

export default function UploadForm({ onFileSelected }: UploadFormProps) {
    const [preview, setPreview] = useState<string | null>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        // Show preview
        const objectUrl = URL.createObjectURL(file);
        setPreview(objectUrl);

        // Pass to parent
        onFileSelected(file);
    }, [onFileSelected]);

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
                    isDragActive ? "border-primary bg-primary-light" : "border-neutral-200 hover:border-primary hover:bg-neutral-50"
                )}
            >
                <input {...getInputProps()} />

                {preview ? (
                    <div className="relative z-10">
                        <img
                            src={preview}
                            alt="Preview"
                            className="w-32 h-32 mx-auto rounded-full object-cover border-4 border-white shadow-lg mb-4"
                        />
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
            </div>

            <p className="text-xs text-center text-neutral-400 mt-4">
                Best results with natural lighting. No makeup recommended.
            </p>
        </div>
    );
}
