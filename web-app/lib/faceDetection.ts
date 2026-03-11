import { FilesetResolver, FaceDetector, FaceDetectorResult } from '@mediapipe/tasks-vision';

let faceDetector: FaceDetector | null = null;

/**
 * Initializes the MediaPipe Face Detector if not already initialized.
 */
export async function initFaceDetector(): Promise<FaceDetector> {
    if (faceDetector) return faceDetector;

    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );

    faceDetector = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "/models/face_detection_short_range.tflite",
            delegate: "GPU"
        },
        runningMode: "IMAGE" // Default to IMAGE, can be overridden per call if needed
    });

    return faceDetector;
}

/**
 * Detects faces in an image (File or HTMLImageElement)
 */
export async function detectFacesInImage(input: File | HTMLImageElement): Promise<FaceDetectorResult> {
    const detector = await initFaceDetector();

    let imageSource: HTMLImageElement;

    if (input instanceof File) {
        imageSource = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(input);
        });
    } else {
        imageSource = input;
    }

    // Ensure we are in IMAGE mode for static detection
    if (detector.setOptions) {
        await detector.setOptions({ runningMode: "IMAGE" });
    }

    return detector.detect(imageSource);
}

/**
 * Helper to check if exactly one face is detected with reasonable confidence
 */
export async function validateSingleFace(input: File | HTMLImageElement): Promise<{
    isValid: boolean;
    error?: string;
    detections: any[];
}> {
    try {
        const result = await detectFacesInImage(input);
        const detections = result.detections;

        if (detections.length === 0) {
            return { isValid: false, error: "No human face detected. Please ensure you are in the frame and facing the camera.", detections: [] };
        }

        if (detections.length > 1) {
            return { isValid: false, error: "Multiple faces detected. Please make sure only one person is in the photo.", detections };
        }

        // Check confidence (score is in categories[0].score usually)
        const confidence = detections[0].categories[0]?.score || 0;
        if (confidence < 0.5) {
            return { isValid: false, error: "Low confidence in face detection. Please try a clearer photo with better lighting.", detections };
        }

        return { isValid: true, detections };
    } catch (err) {
        console.error("Face detection error:", err);
        return { isValid: false, error: "Face detection failed. Please try again.", detections: [] };
    }
}
