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

            // PERSISTENCE FALLBACK (for local dev where webhook is disabled)
            const { getServerUser } = await import("@/lib/authHelper");
            const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
            const user = await getServerUser(request);

            if (user && prediction.status === 'succeeded') {
                const userId = user.id;
                const { searchParams } = new URL(request.url);
                const imagePath = searchParams.get('imagePath');

                // 1. Check if already saved (idempotency)
                const { data: existing } = await supabaseAdmin
                    .from('analysis_results')
                    .select('id')
                    .eq('prediction_id', prediction.id)
                    .maybeSingle();

                if (!existing) {
                    console.log(`[Polling Fallback] Saving result for user: ${userId}`);
                    // 2. Get or Create "My Palette" Subject
                    let { data: subject } = await supabaseAdmin
                        .from('subjects')
                        .select('id')
                        .eq('profile_id', userId)
                        .eq('name', 'My Palette')
                        .single();

                    if (!subject) {
                        const { data: newSubject } = await supabaseAdmin
                            .from('subjects')
                            .insert([{ profile_id: userId, name: 'My Palette' }])
                            .select()
                            .single();
                        subject = newSubject;
                    }

                    if (subject) {
                        // 3. Save Result
                        await supabaseAdmin.from('analysis_results').insert([{
                            subject_id: subject.id,
                            prediction_id: prediction.id,
                            result_json: prediction.output,
                            image_url: imagePath || (prediction.input as any)?.image || null
                        }]);

                        // 4. Increment Count
                        await supabaseAdmin.rpc('increment_generations', { user_id: userId });
                        console.log(`[Polling Fallback] Successfully saved result for user: ${userId}`);
                    }
                }
            }
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
