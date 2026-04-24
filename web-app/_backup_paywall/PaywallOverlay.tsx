"use client";

import { useState } from "react";
import { X, Sparkles, Check, Tag, Loader2, Zap, Crown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface PricingInfo {
    single_report: {
        activePrice: number;
        activePriceFormatted: string;
        basePriceFormatted: string;
        isIntroPrice: boolean;
        credits: number;
    };
    pack_100: {
        activePrice: number;
        activePriceFormatted: string;
        credits: number;
    };
}

interface PaywallOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    pricing: PricingInfo | null;
    remainingCredits?: number;
}

const REPORT_FEATURES = [
    "Your seasonal color type",
    "Skin undertone & depth analysis",
    "10 best colors to wear",
    "5 core neutrals",
    "Shades to avoid",
    "3 signature outfit combinations",
    "Personalized style guide",
    "Premium downloadable report",
];

export default function PaywallOverlay({ isOpen, onClose, pricing, remainingCredits }: PaywallOverlayProps) {
    const [promoCode, setPromoCode] = useState("");
    const [promoResult, setPromoResult] = useState<any>(null);
    const [isValidatingPromo, setIsValidatingPromo] = useState(false);
    const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);

    const validatePromo = async () => {
        if (!promoCode.trim()) return;
        setIsValidatingPromo(true);
        setPromoResult(null);
        try {
            const res = await fetch("/api/promo/validate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: promoCode }),
            });
            const data = await res.json();
            setPromoResult(data);
        } catch {
            setPromoResult({ valid: false, error: "Failed to validate" });
        } finally {
            setIsValidatingPromo(false);
        }
    };

    const handleCheckout = async (productId: 'single_report' | 'pack_100') => {
        setIsCheckingOut(productId);
        try {
            const res = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    productId,
                    promoCode: promoResult?.valid ? promoResult.code : undefined,
                }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error("Checkout error:", data.error);
                setIsCheckingOut(null);
            }
        } catch (err) {
            console.error("Checkout error:", err);
            setIsCheckingOut(null);
        }
    };

    const getSinglePrice = () => {
        if (promoResult?.valid && promoResult.discountedPrices) {
            return promoResult.discountedPrices.single_report;
        }
        return null;
    };

    const getPackPrice = () => {
        if (promoResult?.valid && promoResult.discountedPrices) {
            return promoResult.discountedPrices.pack_100;
        }
        return null;
    };

    if (!isOpen || !pricing) return null;

    const discountedSingle = getSinglePrice();
    const discountedPack = getPackPrice();

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0D0C0B] rounded-[2rem] border border-white/10 shadow-2xl"
                >
                    {/* Close Button */}
                    <button onClick={onClose} className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors z-10">
                        <X className="w-5 h-5" />
                    </button>

                    <div className="p-8 md:p-12">
                        {/* Header */}
                        <div className="text-center mb-10">
                            <div className="w-16 h-16 bg-gradient-to-br from-[#C48B7A] to-[#A06B5E] rounded-[1.2rem] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-[#C48B7A]/20 rotate-3">
                                <Sparkles className="w-8 h-8 text-white" />
                            </div>
                            <h2 className="text-3xl md:text-4xl font-serif text-white tracking-tight mb-3">
                                Unlock Your Color Report
                            </h2>
                            <p className="text-white/50 text-sm leading-relaxed max-w-md mx-auto">
                                Your AI-powered personal color analysis is ready. Purchase access to reveal your complete seasonal palette and styling guide.
                            </p>
                        </div>

                        {/* Features List */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-10 px-2">
                            {REPORT_FEATURES.map((feature, i) => (
                                <div key={i} className="flex items-center gap-2.5">
                                    <Check className="w-3.5 h-3.5 text-[#C48B7A] shrink-0" />
                                    <span className="text-white/60 text-[12px]">{feature}</span>
                                </div>
                            ))}
                        </div>

                        {/* Pricing Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                            {/* Single Report */}
                            <div className="relative bg-white/5 rounded-2xl border border-white/10 p-6 flex flex-col">
                                {pricing.single_report.isIntroPrice && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#C48B7A] to-[#A06B5E] rounded-full text-[10px] font-bold text-white uppercase tracking-widest shadow-lg">
                                        Intro Offer
                                    </div>
                                )}
                                <div className="flex items-center gap-2 mb-4 mt-2">
                                    <Zap className="w-4 h-4 text-[#C48B7A]" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">Single Report</span>
                                </div>
                                <div className="mb-4">
                                    {discountedSingle ? (
                                        <>
                                            <span className="text-3xl font-bold text-white">{discountedSingle.formattedDiscounted}</span>
                                            <span className="text-white/30 text-sm line-through ml-2">{discountedSingle.formattedOriginal}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-3xl font-bold text-white">{pricing.single_report.activePriceFormatted}</span>
                                            {pricing.single_report.isIntroPrice && (
                                                <span className="text-white/30 text-sm line-through ml-2">{pricing.single_report.basePriceFormatted}</span>
                                            )}
                                        </>
                                    )}
                                </div>
                                <p className="text-white/40 text-[11px] mb-6 flex-1">One full personal color analysis report.</p>
                                <button
                                    onClick={() => handleCheckout('single_report')}
                                    disabled={!!isCheckingOut}
                                    className="w-full py-3.5 bg-white text-black font-bold text-sm rounded-xl hover:bg-neutral-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isCheckingOut === 'single_report' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    {isCheckingOut === 'single_report' ? 'Redirecting...' : 'Get My Report'}
                                </button>
                            </div>

                            {/* 100 Pack */}
                            <div className="relative bg-gradient-to-br from-[#C48B7A]/10 to-[#A06B5E]/5 rounded-2xl border border-[#C48B7A]/30 p-6 flex flex-col">
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-white rounded-full text-[10px] font-bold text-black uppercase tracking-widest shadow-lg flex items-center gap-1">
                                    <Crown className="w-3 h-3" /> Best Value
                                </div>
                                <div className="flex items-center gap-2 mb-4 mt-2">
                                    <Crown className="w-4 h-4 text-[#C48B7A]" />
                                    <span className="text-[11px] font-bold uppercase tracking-widest text-white/50">100 Report Pack</span>
                                </div>
                                <div className="mb-4">
                                    {discountedPack ? (
                                        <>
                                            <span className="text-3xl font-bold text-white">{discountedPack.formattedDiscounted}</span>
                                            <span className="text-white/30 text-sm line-through ml-2">{discountedPack.formattedOriginal}</span>
                                        </>
                                    ) : (
                                        <span className="text-3xl font-bold text-white">{pricing.pack_100.activePriceFormatted}</span>
                                    )}
                                </div>
                                <p className="text-white/40 text-[11px] mb-6 flex-1">100 reports. Lifetime validity. Analyze yourself and others.</p>
                                <button
                                    onClick={() => handleCheckout('pack_100')}
                                    disabled={!!isCheckingOut}
                                    className="w-full py-3.5 bg-gradient-to-r from-[#C48B7A] to-[#A06B5E] text-white font-bold text-sm rounded-xl hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-[#C48B7A]/20"
                                >
                                    {isCheckingOut === 'pack_100' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    {isCheckingOut === 'pack_100' ? 'Redirecting...' : 'Get 100 Reports'}
                                </button>
                            </div>
                        </div>

                        {/* Promo Code Section */}
                        <div className="border-t border-white/10 pt-6">
                            <div className="flex items-center gap-2 mb-3">
                                <Tag className="w-3.5 h-3.5 text-white/40" />
                                <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">Have a promo code?</span>
                            </div>
                            <div className="flex gap-3">
                                <input
                                    type="text"
                                    value={promoCode}
                                    onChange={(e) => {
                                        setPromoCode(e.target.value.toUpperCase());
                                        setPromoResult(null);
                                    }}
                                    placeholder="Enter code"
                                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#C48B7A]/50 transition-colors font-mono tracking-wider"
                                    onKeyDown={(e) => e.key === 'Enter' && validatePromo()}
                                />
                                <button
                                    onClick={validatePromo}
                                    disabled={!promoCode.trim() || isValidatingPromo}
                                    className="px-6 py-3 bg-white/10 text-white text-sm font-bold rounded-xl hover:bg-white/20 transition-colors disabled:opacity-30 flex items-center gap-2"
                                >
                                    {isValidatingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                                </button>
                            </div>
                            {promoResult && (
                                <div className={`mt-3 px-4 py-2.5 rounded-xl text-[12px] font-medium ${
                                    promoResult.valid
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                                }`}>
                                    {promoResult.valid
                                        ? `✓ ${promoResult.discountPercent}% discount applied!`
                                        : promoResult.error || 'Invalid code'
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
