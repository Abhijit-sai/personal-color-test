import { auth, currentUser } from '@clerk/nextjs/server';
import { supabaseAdmin } from './supabaseAdmin';

export async function getServerUser(request: Request) {
    const log = (msg: string) => {
        console.log(`[getServerUser] ${msg}`);
    };

    try {
        log("Start");
        const skipAuth = process.env.NEXT_PUBLIC_SKIP_AUTH === "true";
        if (skipAuth) {
            log("Auth Bypass Active (NEXT_PUBLIC_SKIP_AUTH=true)");
            // Use the ID from the existing profile provided by user
            return {
                id: "23f88074-e2b1-400f-936f-47e373e69f37",
                email: "abhijit.sai09@gmail.com",
                tier: "pro", // Set to pro for unlimited testing
                generations_count: 0,
                clerk_id: "test_clerk_id",
                user_id: "test_clerk_id"
            };
        }

        const authHeader = request.headers.get('Authorization');
        log(`Auth Header present: ${!!authHeader}`);
        log(`CLERK_SECRET_KEY present: ${!!process.env.CLERK_SECRET_KEY}`);

        let { userId } = await auth();
        log(`Clerk userId from auth(): ${userId}`);

        if (!userId && authHeader?.startsWith('Bearer ')) {
            log("auth() returned null but Bearer token present, trying currentUser()...");
            try {
                const user = await currentUser();
                userId = user?.id || null;
                log(`Clerk userId from currentUser(): ${userId}`);
            } catch (authErr: any) {
                log(`Auth verification error: ${authErr.message}`);
            }
        }

        if (!userId) {
            log("No Clerk userId found, returning null");
            return null;
        }

        // Fetch or create profile in Supabase
        log(`Fetching profile for clerk_id: ${userId}`);
        const { data: profile, error: fetchError } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('clerk_id', userId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            log(`Supabase fetch error: ${JSON.stringify(fetchError)}`);
        }

        if (profile) {
            log(`Found profile: ${profile.id}`);
            return { ...profile, user_id: userId };
        }

        // Fallback: Check by email
        log("Profile not found by clerk_id, checking by email...");
        const user = await currentUser();
        const email = user?.emailAddresses[0]?.emailAddress;
        log(`Clerk Email: ${email}`);

        if (email) {
            const { data: emailProfile } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .eq('email', email)
                .single();

            if (emailProfile) {
                log(`Found existing profile by email, linking: ${emailProfile.id}`);
                const { error: updateError } = await supabaseAdmin
                    .from('profiles')
                    .update({ clerk_id: userId })
                    .eq('id', emailProfile.id);

                if (updateError) log(`Link error: ${JSON.stringify(updateError)}`);

                return { ...emailProfile, clerk_id: userId, user_id: userId };
            }

            // New profile
            log(`Creating new profile for: ${email}`);
            const newId = crypto.randomUUID();
            const { data: newProfile, error: insertError } = await supabaseAdmin
                .from('profiles')
                .insert([{ id: newId, email, clerk_id: userId }])
                .select()
                .single();

            if (insertError) {
                log(`Profile creation error: ${JSON.stringify(insertError)}`);
                // If it still fails, return a transient object so at least analysis can proceed?
                // No, better to fail and let user know.
                return null;
            }

            log(`Successfully created profile: ${newProfile.id}`);
            return { ...newProfile, clerk_id: userId, user_id: userId };
        }

        log("No email found for user, returning null");
        return null;
    } catch (error: any) {
        log(`Critical error: ${error?.message || String(error)}`);
        return null;
    }
}
