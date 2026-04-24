import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { grantCredits, incrementPromoUsage } from '@/lib/entitlements';

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
    const stripe = getStripe();
    if (!stripe) {
        return NextResponse.json({ error: "Stripe not configured" }, { status: 500 });
    }

    const body = await req.text();
    const sig = req.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
        console.error("[Stripe Webhook] Missing signature or webhook secret");
        return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
        console.error("[Stripe Webhook] Signature verification failed:", err.message);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const metadata = session.metadata;

        if (!metadata?.user_id || !metadata?.product_id || !metadata?.credits) {
            console.error("[Stripe Webhook] Missing metadata:", metadata);
            return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
        }

        const userId = metadata.user_id;
        const productId = metadata.product_id as 'single_report' | 'pack_100';
        const credits = parseInt(metadata.credits);
        const promoCode = metadata.promo_code || undefined;
        const amountPaid = parseInt(metadata.amount_paid || '0');

        console.log(`[Stripe Webhook] Payment confirmed for user: ${userId}, product: ${productId}, credits: ${credits}`);

        // Grant credits
        const result = await grantCredits({
            userId,
            sourceType: productId,
            totalCredits: credits,
            purchaseReference: session.id,
            promoCode,
            amountPaid,
        });

        if (result.success) {
            console.log(`[Stripe Webhook] Granted ${credits} credits to user: ${userId} (ledger: ${result.ledgerId})`);

            // Increment promo usage if applicable
            if (promoCode) {
                await incrementPromoUsage(promoCode);
                console.log(`[Stripe Webhook] Incremented promo usage for: ${promoCode}`);
            }
        } else {
            console.error(`[Stripe Webhook] Failed to grant credits:`, result.error);
        }
    }

    return NextResponse.json({ received: true });
}
