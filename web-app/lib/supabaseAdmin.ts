import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseAdmin: SupabaseClient | null = null;

/**
 * Lazy-initialized Supabase admin client.
 * Doesn't throw at module load so `next build` can collect page data
 * without requiring env vars at build time.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
    get(_target, prop) {
        if (!_supabaseAdmin) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

            if (!supabaseUrl || !supabaseServiceKey) {
                throw new Error(
                    "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL is missing. " +
                    "Set these in Vercel Environment Variables."
                );
            }

            _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                },
            });
        }
        return (_supabaseAdmin as any)[prop];
    },
});
