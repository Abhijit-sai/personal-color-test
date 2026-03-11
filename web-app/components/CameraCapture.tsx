'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, X, Check, RefreshCw, AlertTriangle, Zap, User } from 'lucide-react';
import { FilesetResolver, FaceDetector, FaceDetectorResult } from '@mediapipe/tasks-vision';
import { initFaceDetector } from '@/lib/faceDetection';
import clsx from 'clsx';

interface CameraCaptureProps {
    onCapture: (file: File) => void;
    onCancel: () => void;
}

export default function CameraCapture({ onCapture, onCancel }: CameraCaptureProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [permissionError, setPermissionError] = useState<string | null>(null);
    const [faceDetector, setFaceDetector] = useState<FaceDetector | null>(null);

    // Real-time metrics
    const [brightness, setBrightness] = useState<number>(0);
    const [isFaceDetected, setIsFaceDetected] = useState<boolean>(false);
    const [isFaceCentered, setIsFaceCentered] = useState<boolean>(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const [isGoodCaptureCondition, setIsGoodCaptureCondition] = useState<boolean>(false);
    const [flatteringPrompt, setFlatteringPrompt] = useState<string>("Ready when you are!");

    const [showVideo, setShowVideo] = useState(true);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    // Initialize MediaPipe Face Detector
    useEffect(() => {
        const load = async () => {
            try {
                const detector = await initFaceDetector();
                // Ensure it's in VIDEO mode for live capture
                if (detector.setOptions) {
                    await detector.setOptions({ runningMode: "VIDEO" });
                }
                setFaceDetector(detector);
            } catch (error) {
                console.error("Error initializing FaceDetector:", error);
            }
        };
        load();
    }, []);

    // Start Camera
    const startCamera = async () => {
        setPermissionError(null);
        try {
            // First check if device supports camera
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setPermissionError("Your browser doesn't support camera access. Please use a modern browser.");
                return;
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
        } catch (err: any) {
            console.error("Camera error:", err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setPermissionError("Camera access denied. Please enable permissions in your browser settings and try again.");
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                setPermissionError("No camera found. Please connect a camera and try again.");
            } else {
                setPermissionError("Could not start camera. Please check your permissions and try again.");
            }
        }
    };

    useEffect(() => {
        startCamera();
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    // Analysis Loop
    const analyzeFrame = useCallback(() => {
        if (!videoRef.current || !canvasRef.current || !faceDetector) return;

        const video = videoRef.current;
        if (video.readyState !== 4) return;

        // Detect Faces
        const startTimeMs = performance.now();
        const detections = faceDetector.detectForVideo(video, startTimeMs);

        // Stricter face detection: check if detection exists and has high confidence
        const mainDetection = detections.detections[0];
        const hasFace = detections.detections.length > 0 && (mainDetection?.categories[0]?.score || 0) > 0.7;
        setIsFaceDetected(hasFace);

        // Centering Logic
        let faceCentered = false;
        if (hasFace && detections.detections[0].boundingBox) {
            const box = detections.detections[0].boundingBox;
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;

            // Calculate center of bounding box relative to video size
            const centerX = box.originX + box.width / 2;
            const centerY = box.originY + box.height / 2;

            // Define a "center zone" (e.g., middle 40% of the horizontal frame and vertical frame)
            const horizontalTolerance = videoWidth * 0.2;
            const verticalTolerance = videoHeight * 0.25;

            const isInHorizontalCenter = Math.abs(centerX - videoWidth / 2) < horizontalTolerance;
            const isInVerticalCenter = Math.abs(centerY - videoHeight / 2.2) < verticalTolerance; // Slightly above true center

            faceCentered = isInHorizontalCenter && isInVerticalCenter;
        }
        setIsFaceCentered(faceCentered);

        // Calculate Brightness
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Draw small frame for analysis
        canvas.width = video.videoWidth / 4; // Downsample for speed
        canvas.height = video.videoHeight / 4;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        let r, g, b, avg;
        let colorSum = 0;

        for (let x = 0, len = data.length; x < len; x += 4) {
            r = data[x];
            g = data[x + 1];
            b = data[x + 2];
            avg = Math.floor((r + g + b) / 3);
            colorSum += avg;
        }

        const brightnessValue = Math.floor(colorSum / (canvas.width * canvas.height));
        setBrightness(brightnessValue);

        // Evaluate Conditions
        let currentFeedback = null;
        let isGood = true;

        if (!hasFace) {
            currentFeedback = "Looking for your face...";
            isGood = false;
        } else if (detections.detections.length > 1) {
            currentFeedback = "One person at a time, please!";
            isGood = false;
        } else if ((mainDetection?.categories[0]?.score || 0) < 0.75) {
            currentFeedback = "Face partially hidden? Please uncover your face.";
            isGood = false;
        } else if (!faceCentered) {
            currentFeedback = "Center your face in the guide";
            isGood = false;
        } else if (brightnessValue < 80) {
            currentFeedback = "A bit dark! Can we get more light?";
            isGood = false;
        } else if (brightnessValue > 230) {
            currentFeedback = "A bit bright! Try avoiding direct glare.";
            isGood = false;
        }

        // Flattering Prompts
        const prompts = [
            "You're looking great!",
            "Perfect lighting!",
            "Stay right there.",
            "Ready for your analysis!",
            "A natural star!",
            "Looking fabulous!",
            "Magnificent!"
        ];

        if (isGood) {
            const index = Math.floor((startTimeMs / 3000) % prompts.length);
            setFlatteringPrompt(prompts[index]);
        } else {
            setFlatteringPrompt("Aliging the stars...");
        }

        setFeedback(currentFeedback);
        setIsGoodCaptureCondition(isGood);

        setFeedback(currentFeedback);
        setIsGoodCaptureCondition(isGood);

        if (showVideo) {
            requestAnimationFrame(analyzeFrame);
        }
    }, [faceDetector, showVideo]);

    useEffect(() => {
        if (showVideo && faceDetector && videoRef.current) {
            // Start loop
            const loop = () => {
                analyzeFrame();
                if (showVideo) requestAnimationFrame(loop);
            };
            // Small delay to ensure video is ready playing
            const timer = setTimeout(loop, 1000);
            return () => clearTimeout(timer);
        }
    }, [analyzeFrame, showVideo, faceDetector]);


    const captureImage = () => {
        if (!videoRef.current) return;
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            setCapturedImage(dataUrl);
            setShowVideo(false);
        }
    };

    const retake = () => {
        setCapturedImage(null);
        setShowVideo(true);
        startCamera(); // Restart stream if it was stopped (usually not needed if just hiding video, but good practice if we want to save battery)
    };

    const confirmCapture = async () => {
        if (capturedImage) {
            const res = await fetch(capturedImage);
            const blob = await res.blob();
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            onCapture(file);
        }
    };

    if (permissionError) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 text-white p-6">
                <div className="max-w-md text-center">
                    <AlertTriangle className="w-16 h-16 mx-auto mb-6 text-red-500" />
                    <h3 className="text-xl font-bold mb-2">Camera Access Required</h3>
                    <p className="text-neutral-400 mb-8">{permissionError}</p>
                    <div className="flex gap-4 justify-center">
                        <button onClick={onCancel} className="px-6 py-3 rounded-full border border-white/20 hover:bg-white/10">
                            Cancel
                        </button>
                        <button onClick={startCamera} className="px-6 py-3 rounded-full bg-white text-black font-medium hover:bg-gray-200">
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
            {/* Hidden Canvas for computation */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Video Feed */}
            {showVideo ? (
                <>
                    <div className="relative flex-1 bg-black overflow-hidden">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
                        />

                        {/* Header */}
                        <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start bg-gradient-to-b from-black/60 to-transparent">
                            <button onClick={onCancel} className="p-3 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-black/40 transition-colors">
                                <X className="w-6 h-6" />
                            </button>
                            <div className="flex flex-col items-end gap-2">
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/30 backdrop-blur-md rounded-full text-xs font-mono text-white/90 border border-white/10">
                                    <Zap className={`w-3 h-3 ${brightness < 80 ? 'text-red-400' : brightness > 230 ? 'text-yellow-400' : 'text-green-400'}`} />
                                    <span>LIGHT: {brightness}</span>
                                </div>
                                {isFaceDetected ? (
                                    <div className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/20">FACE DETECTED</div>
                                ) : (
                                    <div className="px-3 py-1 bg-red-500/20 text-red-400 text-xs rounded-full border border-red-500/20">NO FACE</div>
                                )}
                            </div>
                        </div>

                        {/* Face Guide Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className={clsx(
                                "w-64 h-80 rounded-[120px] border-2 transition-all duration-500",
                                isFaceDetected ? "border-primary scale-105 opacity-40 shadow-[0_0_30px_rgba(255,255,255,0.2)]" : "border-white/20 scale-100 opacity-60"
                            )}>
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-[10px] uppercase tracking-widest text-white/60">
                                    Align Face
                                </div>
                            </div>
                        </div>

                        {/* Feedback Toast */}
                        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-xs transition-all duration-300">
                            {feedback ? (
                                <div className="px-6 py-3 bg-black/60 backdrop-blur-2xl text-white font-medium rounded-full text-center border border-white/5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <span className="text-sm tracking-tight">{feedback}</span>
                                </div>
                            ) : isGoodCaptureCondition && (
                                <div className="px-6 py-3 bg-primary/20 backdrop-blur-2xl text-primary-light font-bold rounded-full text-center border border-primary/20 shadow-2xl animate-in zoom-in-95 duration-300 flex flex-col gap-1">
                                    <span className="text-[10px] uppercase tracking-widest text-primary-light/60">{flatteringPrompt}</span>
                                    <span className="text-sm uppercase tracking-widest flex items-center justify-center gap-2">
                                        <Check className="w-4 h-4" /> Ready to Capture
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex-none h-32 bg-black flex items-center justify-center pb-8 pt-4">
                        <button
                            onClick={captureImage}
                            disabled={!isGoodCaptureCondition}
                            className={clsx(
                                "group relative transition-all duration-300",
                                !isGoodCaptureCondition && "opacity-50 grayscale cursor-not-allowed"
                            )}
                        >
                            <div className={`w-20 h-20 rounded-full border-4 transition-all duration-300 ${isGoodCaptureCondition
                                ? 'border-white bg-white/20'
                                : 'border-white/30 bg-white/5'
                                }`}></div>
                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-white transition-all duration-200 group-active:scale-90 ${isGoodCaptureCondition ? 'scale-100' : 'scale-90 opacity-90'}`} />
                        </button>
                    </div>
                </>
            ) : (
                /* Review Screen */
                <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
                    <div className="flex-1 relative overflow-hidden bg-neutral-900">
                        {capturedImage && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={capturedImage}
                                alt="Capture"
                                className="absolute inset-0 w-full h-full object-contain transform scale-x-[-1]"
                            />
                        )}
                        {/* Status Overlay */}
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 px-6 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/80 text-xs font-medium uppercase tracking-[0.2em]">
                            Review your photo
                        </div>
                    </div>

                    <div className="flex-none p-10 bg-black border-t border-white/5 flex justify-between items-center px-12 gap-10">
                        <button onClick={retake} className="flex-1 py-4 flex flex-col items-center gap-3 text-white/50 hover:text-white transition-all group">
                            <div className="p-3 rounded-full bg-white/5 group-hover:bg-white/10 transition-colors">
                                <RefreshCw className="w-6 h-6" />
                            </div>
                            <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Retake</span>
                        </button>

                        <button onClick={confirmCapture} className="flex-1 py-4 flex flex-col items-center gap-3 text-primary-light hover:text-primary transition-all group">
                            <div className="p-4 rounded-full bg-primary/20 group-hover:bg-primary/30 transition-colors border border-primary/20">
                                <Check className="w-8 h-8" />
                            </div>
                            <span className="text-xs uppercase tracking-[0.2em] font-black">Use Photo</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
