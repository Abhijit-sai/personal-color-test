import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getServerUser } from '@/lib/authHelper';
import { getActivePrice, applyDiscount, validatePromoCode, PRICING } from '@/lib/entitlements';

let stripeInstance: Stripe | null = null;

function getStripe() {
    if (!stripeInstance && process.env.STRIPE_SECRET_KEY) {
        stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: '2023-10-16' as any,
        });
    }
    return stripeInstance;
}

export async function POST(req: Request) {
    try {
        const user = await getServerUser(req);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const stripe = getStripe();
        if (!stripe) {
            return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
        }

        const body = await req.json();
        const { productId, promoCode } = body as { productId: 'single_report' | 'pack_100'; promoCode?: string };

        if (!productId || !PRICING[productId]) {
            return NextResponse.json({ error: "Invalid product" }, { status: 400 });
        }

        const product = PRICING[productId];
        let finalPrice = getActivePrice(productId);
        let appliedPromo: string | undefined;
        let discountPercent = 0;

        // Validate and apply promo code
        if (promoCode) {
            const promoResult = await validatePromoCode(promoCode, productId);
            if (promoResult.valid && promoResult.discountPercent) {
                finalPrice = applyDiscount(finalPrice, promoResult.discountPercent);
                appliedPromo = promoResult.code;
                discountPercent = promoResult.discountPercent;
            }
        }

        const { origin } = new URL(req.url);

        const productName = productId === 'single_report'
            ? 'Personal Color Report — Single Analysis'
            : 'Personal Color Report — 100 Analysis Pack';

        const productDescription = productId === 'single_report'
            ? 'Full seasonal color analysis: season, undertone, best colors, neutrals, styling guide, and signature combinations.'
            : '100 report credits. Lifetime validity. Analyze yourself and others — unlimited reruns.';

        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: 'inr',
                        product_data: {
                            name: productName,
                            description: productDescription,
                        },
                        unit_amount: finalPrice,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/?payment_success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/?payment_cancelled=true`,
            metadata: {
                user_id: user.id,
                product_id: productId,
                credits: String(product.credits),
                promo_code: appliedPromo || '',
                discount_percent: String(discountPercent),
                amount_paid: String(finalPrice),
            },
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error("Checkout Error:", err);
        return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 });
    }
}
