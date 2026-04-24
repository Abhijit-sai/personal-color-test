-- =============================================================
-- MIGRATION: Paid Report Access & Credit Ledger
-- Run this in Supabase SQL Editor
-- =============================================================

-- 1. Add monetization columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS revenuecat_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS grandfathered_lifetime_access BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_profiles_rc_customer_id 
  ON public.profiles(revenuecat_customer_id);

-- 2. Grandfathered user: ONLY abhijit.sai09@gmail.com
UPDATE public.profiles
SET grandfathered_lifetime_access = TRUE
WHERE email = 'abhijit.sai09@gmail.com';

-- 3. Report Credits Ledger
CREATE TABLE IF NOT EXISTS public.report_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('single_report', 'pack_100', 'grandfathered', 'admin_grant', 'promo')),
  total_credits INTEGER NOT NULL DEFAULT 1,
  used_credits INTEGER NOT NULL DEFAULT 0,
  purchase_reference TEXT,
  revenuecat_transaction_id TEXT,
  promo_code TEXT,
  amount_paid INTEGER DEFAULT 0, -- in paise (INR smallest unit)
  currency TEXT DEFAULT 'INR',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_credits_user_id 
  ON public.report_credits(user_id);

-- 4. Promo Codes Table
CREATE TABLE IF NOT EXISTS public.promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
  max_uses INTEGER, -- NULL = unlimited
  current_uses INTEGER DEFAULT 0,
  applies_to TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all', 'single_report', 'pack_100')),
  is_active BOOLEAN DEFAULT TRUE,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ, -- NULL = never expires
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a test promo code for development
INSERT INTO public.promo_codes (code, discount_percent, max_uses, applies_to)
VALUES ('LAUNCH50', 50, 100, 'all')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.promo_codes (code, discount_percent, max_uses, applies_to)
VALUES ('EARLYBIRD', 20, 500, 'all')
ON CONFLICT (code) DO NOTHING;

-- 5. RevenueCat Events Log
CREATE TABLE IF NOT EXISTS public.revenuecat_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  customer_id TEXT,
  app_user_id TEXT,
  entitlement_id TEXT,
  product_id TEXT,
  transaction_id TEXT,
  raw_payload JSONB,
  processed_status TEXT DEFAULT 'pending' CHECK (processed_status IN ('pending', 'processed', 'failed')),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Add credit tracking columns to analysis_results
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS credit_source TEXT,
  ADD COLUMN IF NOT EXISTS credit_consumed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS consumed_from_ledger_id UUID REFERENCES public.report_credits(id);

-- 7. Atomic credit consumption function (FIFO)
CREATE OR REPLACE FUNCTION public.consume_report_credit(p_user_id UUID)
RETURNS TABLE(ledger_id UUID, source_type TEXT) AS $$
DECLARE
  v_ledger_id UUID;
  v_source_type TEXT;
BEGIN
  -- Check grandfathered first
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id AND grandfathered_lifetime_access = TRUE
  ) THEN
    RETURN QUERY SELECT NULL::UUID, 'grandfathered'::TEXT;
    RETURN;
  END IF;

  -- Find oldest ledger with remaining credits (FIFO)
  SELECT rc.id, rc.source_type INTO v_ledger_id, v_source_type
  FROM public.report_credits rc
  WHERE rc.user_id = p_user_id 
    AND rc.used_credits < rc.total_credits
    AND (rc.expires_at IS NULL OR rc.expires_at > NOW())
  ORDER BY rc.created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_ledger_id IS NULL THEN
    RAISE EXCEPTION 'NO_CREDITS';
  END IF;

  -- Consume one credit
  UPDATE public.report_credits 
  SET used_credits = used_credits + 1, updated_at = NOW()
  WHERE id = v_ledger_id;

  RETURN QUERY SELECT v_ledger_id, v_source_type;
END;
$$ LANGUAGE plpgsql;

-- 8. Helper: Get remaining credits for a user
CREATE OR REPLACE FUNCTION public.get_remaining_credits(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  -- Grandfathered = unlimited
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id AND grandfathered_lifetime_access = TRUE
  ) THEN
    RETURN 999999;
  END IF;

  SELECT COALESCE(SUM(total_credits - used_credits), 0) INTO v_remaining
  FROM public.report_credits
  WHERE user_id = p_user_id
    AND used_credits < total_credits
    AND (expires_at IS NULL OR expires_at > NOW());

  RETURN v_remaining;
END;
$$ LANGUAGE plpgsql;

-- 9. Atomic promo code usage increment
CREATE OR REPLACE FUNCTION public.increment_promo_usage(p_code TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.promo_codes
  SET current_uses = current_uses + 1
  WHERE code = p_code;
END;
$$ LANGUAGE plpgsql;
