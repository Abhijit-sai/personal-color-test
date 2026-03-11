import { NextResponse } from "next/server";
import Replicate from "replicate";
import { logAnalysisRun } from "@/lib/tracking";
import { getServerUser } from "@/lib/authHelper";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const maxDuration = 60; // Allow 60s for analysis

export async function POST(request: Request) {
    try {
        const user = await getServerUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized. Please login." }, { status: 401 });
        }

        // profile is now part of the user object returned by getServerUser (contains tier, generations_count, id)
        const profile = user;

        if (profile.tier === 'free' && profile.generations_count >= 5) {
            return NextResponse.json({
                error: "Free tier limit reached. Please upgrade to Pro for more analyses.",
                code: "LIMIT_REACHED"
            }, { status: 403 });
        }

        const formData = await request.formData();
        const file = formData.get("image") as File;
        const modelVersion = formData.get("model_version") as string | null;

        if (!file) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        const replicateToken = process.env.REPLICATE_API_TOKEN;
        const modelId = process.env.REPLICATE_MODEL_ID;

        if (!replicateToken) {
            return NextResponse.json({ error: "Replicate token not configured" }, { status: 500 });
        }

        const replicate = new Replicate({
            auth: replicateToken,
        });

        // Convert file to base64 data URI
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = file.type || "image/png";
        const base64Image = `data:${mimeType};base64,${buffer.toString("base64")}`;

        // Prepare Model Version
        if (!modelId) {
            return NextResponse.json({ error: "Model ID not configured" }, { status: 500 });
        }

        const version = modelId.includes(":") ? modelId.split(":").pop() : modelId;
        if (!version) {
            return NextResponse.json({ error: "Invalid Model ID format" }, { status: 500 });
        }

        // --- NEW: UPLOAD TO SUPABASE STORAGE ---
        const timestamp = Date.now();
        const fileName = `${profile.id}/${timestamp}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const filePath = `portraits/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabaseAdmin
            .storage
            .from('analysis-images')
            .upload(filePath, buffer, {
                contentType: mimeType,
                upsert: true
            });

        if (uploadError) {
            console.error("Storage Upload Error:", uploadError);
            return NextResponse.json({ error: "Failed to upload image to secure storage" }, { status: 500 });
        }

        // Generate Signed URL for Replicate (1 hour)
        const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin
            .storage
            .from('analysis-images')
            .createSignedUrl(filePath, 3600);

        if (signedUrlError || !signedUrlData?.signedUrl) {
            console.error("Signed URL Error:", signedUrlError);
            return NextResponse.json({ error: "Failed to generate secure access link for analysis" }, { status: 500 });
        }

        const analysisImageUrl = signedUrlData.signedUrl;

        // 4. Create prediction (Async)
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        const webhookUrl = baseUrl.startsWith('https') ? `${baseUrl}/api/webhooks/replicate?user_id=${profile.id}&image_path=${encodeURIComponent(filePath)}` : undefined;

        console.log("Starting Replicate Prediction with Version:", version, "Webhook:", webhookUrl || "Disabled (HTTPS required)");

        console.log("Engine version:", modelVersion || "v1 (default)");

        const prediction = await replicate.predictions.create({
            version: version,
            input: {
                image: analysisImageUrl, // Use secure signed URL
                tuning_params: "{}",
                // Forward engine version to Replicate; omit if not provided (defaults to v1)
                ...(modelVersion ? { model_version: modelVersion } : {}),
            },
            ...(webhookUrl ? {
                webhook: webhookUrl,
                webhook_events_filter: ["completed"]
            } : {})
        });

        if (prediction?.error) {
            await logAnalysisRun({
                status: 'failed',
                error_message: String(prediction.error),
                model_version: version
            });
            return NextResponse.json({ error: prediction.error }, { status: 500 });
        }

        // Log initiation
        await logAnalysisRun({
            status: 'success', // Using success to denote successful initiation as per log schema requiring success/failed? Or should I add 'starting'?
            // Schema has status text, commented 'success', 'failed'. I'll use 'starting' as I can put any text.
            // Wait, previous thought said "status: 'starting'".
            // The schema comment said '-- "success", "failed"'. It's just a comment.
            model_version: version,
            image_id: prediction.id,
            metadata: { prediction_id: prediction.id, stage: 'initiation' }
        });

        // Return the prediction object and the stable file path
        return NextResponse.json({ 
            prediction, 
            imagePath: filePath 
        }, { status: 201 });

    } catch (error: any) {
        console.error("Analysis Error:", error);
        const errorMessage = error?.message || "Failed to analyze image";
        return NextResponse.json({ error: errorMessage, details: String(error) }, { status: 500 });
    }
}
