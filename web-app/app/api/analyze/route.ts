import { NextResponse } from "next/server";
import Replicate from "replicate";
import { logAnalysisRun } from "@/lib/tracking";

export const maxDuration = 60; // Allow 60s for analysis

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("image") as File;

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

        // Extract version hash if provided in format owner/model:version
        const version = modelId.includes(":") ? modelId.split(":").pop() : modelId;

        if (!version) {
            return NextResponse.json({ error: "Invalid Model ID format" }, { status: 500 });
        }

        console.log("Starting Replicate Prediction with Version:", version);

        // Create prediction (Async)
        const prediction = await replicate.predictions.create({
            version: version,
            input: {
                image: base64Image,
                tuning_params: "{}"
            }
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

        // Return the prediction object (contains status 'starting' and id)
        return NextResponse.json(prediction, { status: 201 });

    } catch (error: any) {
        console.error("Analysis Error:", error);
        const errorMessage = error?.message || "Failed to analyze image";
        return NextResponse.json({ error: errorMessage, details: String(error) }, { status: 500 });
    }
}
