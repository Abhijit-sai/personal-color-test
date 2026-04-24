import { NextResponse } from "next/server";
import { validatePromoCode, getActivePrice, applyDiscount, formatINR } from "@/lib/entitlements";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code, productId } = body;

        if (!code || typeof code !== 'string') {
            return NextResponse.json({ valid: false, error: "Please enter a promo code" }, { status: 400 });
        }

        const result = await validatePromoCode(code, productId);

        if (!result.valid) {
            return NextResponse.json(result, { status: 200 }); // 200 because it's a validation response, not an error
        }

        // Calculate discounted prices for the response
        const singlePrice = getActivePrice('single_report');
        const packPrice = getActivePrice('pack_100');

        const discountedSingle = applyDiscount(singlePrice, result.discountPercent!);
        const discountedPack = applyDiscount(packPrice, result.discountPercent!);

        return NextResponse.json({
            ...result,
            discountedPrices: {
                single_report: {
                    original: singlePrice,
                    discounted: discountedSingle,
                    formattedOriginal: formatINR(singlePrice),
                    formattedDiscounted: formatINR(discountedSingle),
                    savings: formatINR(singlePrice - discountedSingle),
                },
                pack_100: {
                    original: packPrice,
                    discounted: discountedPack,
                    formattedOriginal: formatINR(packPrice),
                    formattedDiscounted: formatINR(discountedPack),
                    savings: formatINR(packPrice - discountedPack),
                },
            },
        });
    } catch (error: any) {
        console.error("[Promo] Validation error:", error);
        return NextResponse.json({ valid: false, error: "Failed to validate promo code" }, { status: 500 });
    }
}
