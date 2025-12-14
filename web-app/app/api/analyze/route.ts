import { NextResponse } from "next/server";
import Replicate from "replicate";

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

        // Run prediction
        // If modelId is not set, we can't run.
        if (!modelId) {
            // Fallback for demo purposes if ID is missing? No, user must provide it.
            return NextResponse.json({ error: "Model ID not configured" }, { status: 500 });
        }

        // Ensure modelId is fully qualified (owner/name:version)
        const fullModelId = modelId.includes("/")
            ? modelId
            : `abhijit-sai/personal-color-test:${modelId}`;

        console.log("Using Replicate Model ID:", fullModelId);

        // Input structure matches predict.py arguments
        const output = await replicate.run(
            fullModelId as `${string}/${string}` | `${string}/${string}:${string}`,
            {
                input: {
                    image: base64Image,
                    tuning_params: "{}"
                }
            }
        );

        return NextResponse.json(output);

    } catch (error: any) {
        console.error("Analysis Error:", error);
        // Extract Replicate error message if available
        const errorMessage = error?.message || "Failed to analyze image";
        return NextResponse.json({ error: errorMessage, details: String(error) }, { status: 500 });
    }
}
