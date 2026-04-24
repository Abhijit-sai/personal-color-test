import { supabaseAdmin } from './supabaseAdmin';

// =============================================================
// PRICING CONFIG — Single source of truth
// =============================================================
export const PRICING = {
    single_report: {
        id: 'single_report',
        label: '1 Report',
        basePrice: 99900, // ₹999 in paise
        introPrice: 79900, // ₹799 in paise
        credits: 1,
        currency: 'INR',
    },
    pack_100: {
        id: 'pack_100',
        label: '100 Reports',
        basePrice: 999900, // ₹9,999 in paise
        credits: 100,
        currency: 'INR',
    },
} as const;

// Use intro pricing? Flip this to false when intro period ends.
export const USE_INTRO_PRICING = true;

export function getActivePrice(productId: 'single_report' | 'pack_100'): number {
    const product = PRICING[productId];
    if (productId === 'single_report' && USE_INTRO_PRICING) {
        return (product as typeof PRICING.single_report).introPrice;
    }
    return product.basePrice;
}

export function formatINR(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN')}`;
}

// =============================================================
// ENTITLEMENT CHECKS
// =============================================================
export interface EntitlementStatus {
    allowed: boolean;
    source: 'grandfathered' | 'credits' | 'none';
    remainingCredits: number;
    isGrandfathered: boolean;
}

export async function checkEntitlement(userId: string): Promise<EntitlementStatus> {
    // 1. Check grandfathered
    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('grandfathered_lifetime_access')
        .eq('id', userId)
        .single();

    if (profile?.grandfathered_lifetime_access) {
        return {
            allowed: true,
            source: 'grandfathered',
            remainingCredits: 999999,
            isGrandfathered: true,
        };
    }

    // 2. Check credit balance
    const { data: remaining } = await supabaseAdmin
        .rpc('get_remaining_credits', { p_user_id: userId });

    const credits = typeof remaining === 'number' ? remaining : 0;

    return {
        allowed: credits > 0,
        source: credits > 0 ? 'credits' : 'none',
        remainingCredits: credits,
        isGrandfathered: false,
    };
}

// =============================================================
// CREDIT CONSUMPTION (called on successful report generation)
// =============================================================
export interface CreditConsumptionResult {
    success: boolean;
    ledgerId: string | null;
    source: string;
    error?: string;
}

export async function consumeCredit(userId: string): Promise<CreditConsumptionResult> {
    try {
        const { data, error } = await supabaseAdmin
            .rpc('consume_report_credit', { p_user_id: userId });

        if (error) {
            if (error.message?.includes('NO_CREDITS')) {
                return { success: false, ledgerId: null, source: 'none', error: 'NO_CREDITS' };
            }
            console.error('[Entitlements] Credit consumption error:', error);
            return { success: false, ledgerId: null, source: 'none', error: error.message };
        }

        const result = Array.isArray(data) ? data[0] : data;
        return {
            success: true,
            ledgerId: result?.ledger_id || null,
            source: result?.source_type || 'unknown',
        };
    } catch (err: any) {
        console.error('[Entitlements] Unexpected error:', err);
        return { success: false, ledgerId: null, source: 'none', error: err.message };
    }
}

// =============================================================
// CREDIT GRANTING (called after successful purchase)
// =============================================================
export async function grantCredits(opts: {
    userId: string;
    sourceType: 'single_report' | 'pack_100' | 'admin_grant' | 'promo';
    totalCredits: number;
    purchaseReference?: string;
    revenuecatTransactionId?: string;
    promoCode?: string;
    amountPaid?: number;
}): Promise<{ success: boolean; ledgerId?: string; error?: string }> {
    const { data, error } = await supabaseAdmin
        .from('report_credits')
        .insert([{
            user_id: opts.userId,
            source_type: opts.sourceType,
            total_credits: opts.totalCredits,
            purchase_reference: opts.purchaseReference,
            revenuecat_transaction_id: opts.revenuecatTransactionId,
            promo_code: opts.promoCode,
            amount_paid: opts.amountPaid || 0,
            currency: 'INR',
        }])
        .select('id')
        .single();

    if (error) {
        console.error('[Entitlements] Grant credits error:', error);
        return { success: false, error: error.message };
    }

    return { success: true, ledgerId: data?.id };
}

// =============================================================
// MARK CREDIT ON ANALYSIS RESULT
// =============================================================
export async function markCreditConsumed(
    analysisResultId: string,
    ledgerId: string | null,
    source: string
): Promise<void> {
    const { error } = await supabaseAdmin
        .from('analysis_results')
        .update({
            credit_consumed: true,
            credit_source: source,
            consumed_from_ledger_id: ledgerId,
        })
        .eq('id', analysisResultId);

    if (error) {
        console.error('[Entitlements] Failed to mark credit consumed:', error);
    }
}

// =============================================================
// PROMO CODE VALIDATION
// =============================================================
export interface PromoResult {
    valid: boolean;
    code?: string;
    discountPercent?: number;
    appliesTo?: string;
    error?: string;
}

export async function validatePromoCode(code: string, productId?: string): Promise<PromoResult> {
    const normalizedCode = code.trim().toUpperCase();

    const { data: promo, error } = await supabaseAdmin
        .from('promo_codes')
        .select('*')
        .eq('code', normalizedCode)
        .eq('is_active', true)
        .single();

    if (error || !promo) {
        return { valid: false, error: 'Invalid promo code' };
    }

    // Check usage limits
    if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
        return { valid: false, error: 'This promo code has been fully redeemed' };
    }

    // Check date validity
    const now = new Date();
    if (promo.valid_from && new Date(promo.valid_from) > now) {
        return { valid: false, error: 'This promo code is not yet active' };
    }
    if (promo.valid_until && new Date(promo.valid_until) < now) {
        return { valid: false, error: 'This promo code has expired' };
    }

    // Check product applicability
    if (promo.applies_to !== 'all' && productId && promo.applies_to !== productId) {
        return { valid: false, error: `This promo code does not apply to this product` };
    }

    return {
        valid: true,
        code: promo.code,
        discountPercent: promo.discount_percent,
        appliesTo: promo.applies_to,
    };
}

export async function incrementPromoUsage(code: string): Promise<void> {
    const normalizedCode = code.trim().toUpperCase();
    const { error } = await supabaseAdmin.rpc('increment_promo_usage', { p_code: normalizedCode });
    if (error) {
        console.error('[Entitlements] Failed to increment promo usage:', error);
        // Fallback: manual increment
        const { data: promo } = await supabaseAdmin
            .from('promo_codes')
            .select('current_uses')
            .eq('code', normalizedCode)
            .single();
        if (promo) {
            await supabaseAdmin
                .from('promo_codes')
                .update({ current_uses: (promo.current_uses || 0) + 1 })
                .eq('code', normalizedCode);
        }
    }
}

export function applyDiscount(priceInPaise: number, discountPercent: number): number {
    return Math.round(priceInPaise * (1 - discountPercent / 100));
}
