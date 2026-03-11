-- SUPABASE MIGRATIONS: FASHION BUDDY ECOSYSTEM
-- Version: 1.0 (Future-Proof Schema)

-- 1. PROFILES: Core user data and tier tracking
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY, -- Removed REFERENCES auth.users(id)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  email TEXT UNIQUE,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'unlimited')),
  generations_count INTEGER DEFAULT 0,
  avatar_url TEXT, -- Profile level avatar (optional)
  clerk_id TEXT UNIQUE -- Mapped from Clerk Auth
);
CREATE INDEX IF NOT EXISTS idx_profiles_clerk_id ON public.profiles(clerk_id);

-- MIGRATION: 2026-02-25 Add Clerk ID
-- ALTER TABLE public.profiles ADD COLUMN clerk_id TEXT UNIQUE;

-- 2. SUBJECTS: "Fashion Buddies" (Self, Friend, etc.)
CREATE TABLE public.subjects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  name TEXT NOT NULL, -- e.g., "Abhijit (Self)", "Sneha"
  avatar_url TEXT,    -- Latest avatar generated for this subject
  metadata JSONB      -- Age, gender, or notes
);

-- 3. ANALYSIS RESULTS: History of tests per subject
CREATE TABLE public.analysis_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  prediction_id TEXT UNIQUE, -- Replicate ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  result_json JSONB NOT NULL, -- The full seasonal color report
  image_url TEXT             -- URL of the photo analyzed
);

-- --- SECURITY & RLS ---

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

-- Profiles: Own users can read/write their own profile
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Subjects: Own users can manage their subjects
CREATE POLICY "Users can manage own subjects" ON public.subjects
  FOR ALL USING (
    profile_id = auth.uid()
  );

-- Analysis Results: Own users can manage their results via subjects
CREATE POLICY "Users can manage own results" ON public.analysis_results
  FOR ALL USING (
    subject_id IN (
      SELECT id FROM public.subjects WHERE profile_id = auth.uid()
    )
  );

-- --- TRIGGER: Create Profile on Auth Signup ---
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- --- RPC: Increment Generations Count ---
CREATE OR REPLACE FUNCTION public.increment_generations(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET generations_count = generations_count + 1
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
