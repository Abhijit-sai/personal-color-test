import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/authHelper";
import { checkEntitlement, PRICING, USE_INTRO_PRICING, getActivePrice, formatINR } from "@/lib/entitlements";

export async function GET(request: Request) {
    try {
        const user = await getServerUser(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const entitlement = await checkEntitlement(user.id);

        return NextResponse.json({
            ...entitlement,
            pricing: {
                single_report: {
                    ...PRICING.single_report,
                    activePrice: getActivePrice('single_report'),
                    activePriceFormatted: formatINR(getActivePrice('single_report')),
                    basePriceFormatted: formatINR(PRICING.single_report.basePrice),
                    isIntroPrice: USE_INTRO_PRICING,
                },
                pack_100: {
                    ...PRICING.pack_100,
                    activePrice: getActivePrice('pack_100'),
                    activePriceFormatted: formatINR(getActivePrice('pack_100')),
                    basePriceFormatted: formatINR(PRICING.pack_100.basePrice),
                    perReportPrice: formatINR(Math.round(getActivePrice('pack_100') / 100)),
                },
            },
        });
    } catch (error: any) {
        console.error("[Entitlements] Check error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
