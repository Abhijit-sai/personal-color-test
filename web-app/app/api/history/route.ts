import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/authHelper";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
    try {
        const profile = await getServerUser(request);
        if (!profile) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Fetch results for the user's "My Palette" subject
        const { data: results, error } = await supabaseAdmin
            .from('analysis_results')
            .select(`
                id,
                prediction_id,
                created_at,
                result_json,
                image_url,
                subjects!inner (
                    profile_id
                )
            `)
            .eq('subjects.profile_id', profile.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error("History fetch error:", error);
            return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
        }

        // Clean up response and generate signed URLs for private images
        const formattedResults = await Promise.all(results.map(async (r) => {
            let signedImageUrl = r.image_url;
            
            // If it looks like a storage path (portraits/...), generate a signed URL
            if (r.image_url && r.image_url.startsWith('portraits/')) {
                const { data } = await supabaseAdmin
                    .storage
                    .from('analysis-images')
                    .createSignedUrl(r.image_url, 3600);
                if (data?.signedUrl) signedImageUrl = data.signedUrl;
            }

            return {
                ...(r.result_json as any),
                id: r.id,
                created_at: r.created_at,
                image_url: signedImageUrl,
                prediction_id: r.prediction_id // Keep for internal tracking if needed
            };
        }));

        return NextResponse.json(formattedResults);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
