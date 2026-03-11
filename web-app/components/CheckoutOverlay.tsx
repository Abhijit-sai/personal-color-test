import React from 'react';
import { CreditCard, Shield, Zap, CheckCircle2, Loader2 } from 'lucide-react';

interface CheckoutOverlayProps {
    onCheckout: () => void;
    onCancel: () => void;
    isLoading?: boolean;
}

export default function CheckoutOverlay({ onCheckout, onCancel, isLoading }: CheckoutOverlayProps) {
    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
            <div className="bg-white rounded-[40px] max-w-md w-full overflow-hidden shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 duration-700">
                {/* Header */}
                <div className="relative h-48 bg-neutral-900 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)]" />
                    <Zap className="w-16 h-16 text-primary fill-primary animate-pulse" />
                </div>

                {/* Content */}
                <div className="p-10 space-y-8 text-center">
                    <div className="space-y-2">
                        <h2 className="text-3xl font-bold font-heading">Unlock Your Palette</h2>
                        <p className="text-neutral-500">Get your full color analysis and downloadable report for $9.00.</p>
                    </div>

                    <div className="space-y-4">
                        <Benefit item="Full 12-season seasonal analysis" />
                        <Benefit item="Downloadable PDF & Image report" />
                        <Benefit item="Personalized clothing color guide" />
                    </div>

                    <div className="space-y-4 pt-4">
                        <button
                            onClick={onCheckout}
                            disabled={isLoading}
                            className="w-full py-5 rounded-3xl bg-black text-white text-lg font-bold hover:bg-neutral-800 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl"
                        >
                            {isLoading ? (
                                <Loader2 className="w-6 h-6 animate-spin" />
                            ) : (
                                <>
                                    <CreditCard className="w-5 h-5" /> Pay with Stripe
                                </>
                            )}
                        </button>
                        <button
                            onClick={onCancel}
                            disabled={isLoading}
                            className="w-full py-3 text-neutral-400 font-medium hover:text-neutral-600 transition-colors text-sm"
                        >
                            Maybe Later
                        </button>
                    </div>

                    <div className="pt-2 flex items-center justify-center gap-2 text-xs text-neutral-400 font-medium uppercase tracking-widest">
                        <Shield className="w-3 h-3 text-green-500" /> Secure Checkout
                    </div>
                </div>
            </div>
        </div>
    );
}

function Benefit({ item }: { item: string }) {
    return (
        <div className="flex items-center gap-3 text-sm font-medium text-neutral-700">
            <div className="w-5 h-5 rounded-full bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            </div>
            <span>{item}</span>
        </div>
    );
}
