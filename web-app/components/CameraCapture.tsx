'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Camera, X, Check, RefreshCw, AlertTriangle, Zap } from 'lucide-react';
import { FilesetResolver, FaceDetector, FaceDetectorResult } from '@mediapipe/tasks-vision';

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
    const [feedback, setFeedback] = useState<string | null>(null);
    const [isGoodCaptureCondition, setIsGoodCaptureCondition] = useState<boolean>(false);

    const [showVideo, setShowVideo] = useState(true);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    // Initialize MediaPipe Face Detector
    useEffect(() => {
        const initFaceDetector = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );
                const detector = await FaceDetector.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: "/models/face_detection_short_range.tflite",
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO"
                });
                setFaceDetector(detector);
            } catch (error) {
                console.error("Error initializing FaceDetector:", error);
            }
        };
        initFaceDetector();
    }, []);

    // Start Camera
    const startCamera = async () => {
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 1280, height: 720 },
                audio: false
            });
            setStream(mediaStream);
            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream;
            }
            setPermissionError(null);
        } catch (err) {
            console.error("Camera error:", err);
            setPermissionError("Please allow camera access to use this feature.");
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
        const hasFace = detections.detections.length > 0;
        setIsFaceDetected(hasFace);

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

        const brightnessValue = Math.floor(colorSum / (video.width / 4 * video.height / 4));
        setBrightness(brightnessValue);

        // Evaluate Conditions
        let currentFeedback = null;
        let isGood = true;

        if (!hasFace) {
            currentFeedback = "No face detected. Please look at the camera.";
            isGood = false;
        } else if (detections.detections.length > 1) {
            currentFeedback = "Multiple faces detected. Please make sure only you are in the frame.";
            isGood = false;
        } else if (brightnessValue < 80) {
            currentFeedback = "Too dark. Please find better lighting.";
            isGood = false;
        } else if (brightnessValue > 230) {
            currentFeedback = "Too bright/washed out.";
            isGood = false;
        }

        // TODO: Add detection confidence checks if needed

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

                        {/* Feedback Toast */}
                        {feedback && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-3 bg-black/70 backdrop-blur-xl text-white font-medium rounded-2xl text-center border border-white/10 animate-fade-in">
                                {feedback}
                            </div>
                        )}
                    </div>

                    {/* Controls */}
                    <div className="flex-none h-32 bg-black flex items-center justify-center pb-8 pt-4">
                        <button
                            onClick={captureImage}
                            disabled={false} // Always allow capture, metrics are guides
                            className="group relative"
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
                <div className="relative flex-1 bg-black flex flex-col">
                    {capturedImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={capturedImage} alt="Capture" className="flex-1 w-full object-cover transform scale-x-[-1]" />
                    )}

                    <div className="flex-none p-8 bg-black flex justify-between items-center px-10 gap-8">
                        <button onClick={retake} className="flex-1 py-4 flex flex-col items-center gap-2 text-white/60 hover:text-white transition-colors">
                            <RefreshCw className="w-6 h-6" />
                            <span className="text-xs uppercase tracking-wider font-medium">Retake</span>
                        </button>

                        <button onClick={confirmCapture} className="flex-1 py-4 flex flex-col items-center gap-2 text-primary-light hover:text-primary transition-colors">
                            <Check className="w-8 h-8" />
                            <span className="text-sm uppercase tracking-wider font-bold">Use Photo</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
