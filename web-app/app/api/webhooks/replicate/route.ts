import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAnalysisRun } from "@/lib/tracking";

export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get("user_id");

        const body = await request.json();
        const { id, status, output, metrics, error, version, input } = body;

        console.log(`[Replicate Webhook] Received status: ${status} for prediction: ${id}${userId ? ` for user: ${userId}` : ''}`);

        // 1. Log the run status
        await logAnalysisRun({
            status: status === 'succeeded' ? 'success' : 'failed',
            image_id: id,
            model_version: typeof version === 'string' ? version : version?.id || 'unknown',
            error_message: error ? String(error) : undefined,
            metadata: { prediction_id: id, stage: 'webhook', metrics }
        });

        if (status === 'succeeded' && output) {
            // Extract image_path from URL if provided (passed from analyze route)
            const { searchParams } = new URL(request.url);
            const imagePath = searchParams.get('image_path');
            const currentUserId = searchParams.get('user_id'); // Re-extract userId for this block's context

            // 2. userId is already extracted from query params
            if (currentUserId) {
                // Check if already saved (idempotency)
                const { data: existing } = await supabaseAdmin
                    .from('analysis_results')
                    .select('id')
                    .eq('prediction_id', id)
                    .maybeSingle();

                if (existing) {
                    console.log(`[Replicate Webhook] Result already saved for prediction: ${id}`);
                    return NextResponse.json({ processed: true, already_saved: true });
                }

                // 3. Get or Create "My Palette" Subject
                let { data: subject } = await supabaseAdmin
                    .from('subjects')
                    .select('id')
                    .eq('profile_id', currentUserId)
                    .eq('name', 'My Palette')
                    .single();

                if (!subject) {
                    const { data: newSubject } = await supabaseAdmin
                        .from('subjects')
                        .insert([{ profile_id: currentUserId, name: 'My Palette' }])
                        .select()
                        .single();
                    subject = newSubject;
                }

                if (subject) {
                    // 4. Save Result
                    const { error: insertError } = await supabaseAdmin.from('analysis_results').insert([{
                        subject_id: subject.id,
                        prediction_id: id,
                        result_json: output,
                        image_url: imagePath || (input as any)?.image // Prefer the permanent storage path
                    }]);

                    if (insertError) {
                        console.error("[Replicate Webhook] Error saving result:", insertError);
                    } else {
                        // 5. Increment Count
                        await supabaseAdmin.rpc('increment_generations', { user_id: userId });
                        console.log(`[Replicate Webhook] Successfully saved result for user: ${userId}`);
                    }
                }
            } else {
                console.warn("[Replicate Webhook] No user_id found in metadata");
            }
        }

        return NextResponse.json({ processed: true });
    } catch (err: any) {
        console.error("[Replicate Webhook] Critical Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
