import { NextResponse } from "next/server";
import Replicate from "replicate";
import { logAnalysisRun } from "@/lib/tracking";

export async function GET(
    request: Request,
    props: { params: Promise<{ id: string }> }
) {
    const params = await props.params;
    const replicateToken = process.env.REPLICATE_API_TOKEN;

    if (!replicateToken) {
        return NextResponse.json(
            { error: "Replicate token not configured" },
            { status: 500 }
        );
    }

    const replicate = new Replicate({
        auth: replicateToken,
    });

    try {
        const prediction = await replicate.predictions.get(params.id);

        if (prediction?.error) {
            await logAnalysisRun({
                status: 'failed',
                error_message: String(prediction.error),
                image_id: prediction.id,
                metadata: { prediction_id: prediction.id, stage: 'polling' }
            });
            return NextResponse.json(
                { error: prediction.error },
                { status: 500 }
            );
        }

        if (prediction?.status === 'succeeded' || prediction?.status === 'failed') {
            await logAnalysisRun({
                status: prediction.status === 'succeeded' ? 'success' : 'failed',
                image_id: prediction.id,
                model_version: typeof prediction.version === 'string' ? prediction.version : (prediction.version as any)?.id || 'unknown',
                metadata: { prediction_id: prediction.id, stage: 'polling_complete', metrics: prediction.metrics }
            });
        }

        return NextResponse.json(prediction);
    } catch (error: any) {
        console.error("Prediction Status Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to check status" },
            { status: 500 }
        );
    }
}
