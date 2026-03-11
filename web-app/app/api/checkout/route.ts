import { NextResponse } from 'next/server';
import Stripe from 'stripe';

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
        const stripe = getStripe();
        if (!stripe) {
            return NextResponse.json({ error: "Stripe is not configured." }, { status: 500 });
        }
        const { origin } = new URL(req.url);

        // Create Checkout Sessions from body params.
        const session = await stripe.checkout.sessions.create({
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: 'Personal Color analysis',
                            description: 'Full seasonal color analysis report with clothing recommendations.',
                        },
                        unit_amount: 900, // $9.00
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/?canceled=true`,
        });

        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        console.error("Stripe Error:", err);
        return NextResponse.json({ error: err.message }, { status: err.statusCode || 500 });
    }
}
