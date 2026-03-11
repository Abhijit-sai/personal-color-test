import React, { useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, Camera, Scan, Palette, Shield, CheckCircle2, Star, ChevronRight } from 'lucide-react';

interface LandingPageProps {
    onStart: () => void;
}

/* ─── Scroll-reveal hook ─── */
function useReveal() {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const obs = new IntersectionObserver(
            ([e]) => { if (e.isIntersecting) { el.classList.add('revealed'); obs.unobserve(el); } },
            { threshold: 0.15 }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, []);
    return ref;
}

function Reveal({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
    const ref = useReveal();
    return (
        <div
            ref={ref}
            className={`reveal-on-scroll ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
}

/* ─── Season Data ─── */
const SEASONS = [
    { name: 'Spring', undertone: 'Warm undertone', depth: 'Light depth', contrast: 'Soft contrast', gradient: 'from-amber-100 to-rose-100', colors: ['#FFB347', '#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'] },
    { name: 'Summer', undertone: 'Cool undertone', depth: 'Light depth', contrast: 'Low contrast', gradient: 'from-blue-100 to-purple-100', colors: ['#A8D8EA', '#AA96DA', '#FCBAD3', '#C4E8C6', '#B5B5E0'] },
    { name: 'Autumn', undertone: 'Warm undertone', depth: 'Deep depth', contrast: 'Muted contrast', gradient: 'from-orange-100 to-amber-100', colors: ['#D4A373', '#8B4513', '#556B2F', '#B8860B', '#A0522D'] },
    { name: 'Winter', undertone: 'Cool undertone', depth: 'Deep depth', contrast: 'Bold contrast', gradient: 'from-slate-100 to-blue-100', colors: ['#1B263B', '#E63946', '#F1FAEE', '#457B9D', '#2A9D8F'] },
];

export default function LandingPage({ onStart }: LandingPageProps) {
    return (
        <div className="min-h-screen bg-[#FDFBF7] text-neutral-900 selection:bg-primary/20 overflow-x-hidden">

            {/* ─── 1. NAVIGATION ─── */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/85 backdrop-blur-xl border-b border-neutral-200/40">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#C48B7A] to-[#E8A09A] flex items-center justify-center shadow-sm">
                            <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="font-heading text-lg font-bold tracking-tight">
                            Personal Color <span className="text-[#C48B7A] italic">AI</span>
                        </span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-[13px] font-semibold text-neutral-400">
                        <a href="#how-it-works" className="hover:text-neutral-800 transition-colors">How it Works</a>
                        <a href="#seasons" className="hover:text-neutral-800 transition-colors">Seasons</a>
                        <a href="#pricing" className="hover:text-neutral-800 transition-colors">Pricing</a>
                    </div>
                    <button
                        onClick={onStart}
                        className="px-5 py-2.5 rounded-full bg-[#C48B7A] text-white text-sm font-bold hover:bg-[#B07A6A] transition-all active:scale-95 shadow-md shadow-[#C48B7A]/20"
                    >
                        Try Free
                    </button>
                </div>
            </nav>

            {/* ─── 2. HERO ─── */}
            <section className="relative pt-28 pb-20 md:pt-40 md:pb-32 px-6">
                {/* Gradient orbs */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-[10%] left-[10%] w-[500px] h-[500px] bg-[#F5E6D3]/60 rounded-full blur-[120px]" />
                    <div className="absolute bottom-[5%] right-[10%] w-[400px] h-[400px] bg-[#E8C4B8]/40 rounded-full blur-[100px]" />
                </div>

                <div className="relative max-w-5xl mx-auto text-center space-y-8">
                    <Reveal>
                        <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#C48B7A]/8 border border-[#C48B7A]/15 text-[#C48B7A] text-xs font-bold tracking-[0.2em] uppercase">
                            <Sparkles className="w-3.5 h-3.5" />
                            Takes Less Than 2 Minutes
                        </div>
                    </Reveal>

                    <Reveal delay={100}>
                        <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-heading font-bold tracking-tight leading-[1.05]">
                            Discover the Colors<br />
                            That Make You <span className="text-[#C48B7A] italic">Glow</span>
                        </h1>
                    </Reveal>

                    <Reveal delay={200}>
                        <p className="text-neutral-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                            Your best colors are determined by your unique undertone, contrast, and depth.
                            Find your seasonal color palette with our AI-powered analysis — no appointments, no draping, just science and style.
                        </p>
                    </Reveal>

                    <Reveal delay={300}>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <button
                                onClick={onStart}
                                className="group w-full sm:w-auto px-9 py-4 rounded-full bg-[#C48B7A] text-white text-lg font-bold hover:bg-[#B07A6A] transition-all flex items-center justify-center gap-3 shadow-xl shadow-[#C48B7A]/25 active:scale-[0.97]"
                            >
                                Start Free Analysis
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </button>
                            <a
                                href="#pricing"
                                className="flex items-center gap-2 px-6 py-4 rounded-full text-neutral-500 text-sm font-semibold hover:text-neutral-800 transition-colors"
                            >
                                See Pro Report <ChevronRight className="w-4 h-4" />
                            </a>
                        </div>
                    </Reveal>

                    <Reveal delay={400}>
                        <div className="flex items-center justify-center gap-6 pt-2 text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                            <div className="flex items-center gap-1.5">
                                <Shield className="w-3.5 h-3.5 text-green-500" /> Private & Secure
                            </div>
                            <span className="text-neutral-200">·</span>
                            <span>Free to Start</span>
                            <span className="text-neutral-200">·</span>
                            <span>Instant Results</span>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ─── 3. WHY PERSONAL COLOR MATTERS ─── */}
            <section className="py-20 md:py-28 px-6 bg-white">
                <div className="max-w-6xl mx-auto">
                    <Reveal>
                        <div className="text-center mb-16 space-y-4">
                            <p className="text-[#C48B7A] text-xs font-bold tracking-[0.25em] uppercase">Why Personal Color Matters</p>
                            <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">
                                The Right Colors Change <span className="italic">Everything</span>
                            </h2>
                        </div>
                    </Reveal>

                    <div className="grid md:grid-cols-2 gap-12 lg:gap-20 items-center">
                        <Reveal delay={100}>
                            <div className="rounded-3xl overflow-hidden shadow-2xl shadow-neutral-200/60">
                                <img
                                    src="/wrong-vs-right-colors.png"
                                    alt="Comparison: Wrong colors make skin look dull versus right colors that make you glow"
                                    className="w-full h-auto"
                                    loading="lazy"
                                />
                            </div>
                        </Reveal>

                        <Reveal delay={200}>
                            <div className="space-y-8">
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center">
                                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        </div>
                                        <h3 className="text-xl font-bold text-green-700">Your Right Colors</h3>
                                    </div>
                                    <ul className="space-y-2.5 text-neutral-600 leading-relaxed ml-[52px]">
                                        <li>Skin looks <strong>radiant and even-toned</strong></li>
                                        <li>Eyes appear <strong>brighter and more defined</strong></li>
                                        <li>You look <strong>healthier, younger, and more vibrant</strong></li>
                                        <li>People notice <strong>you</strong>, not your outfit</li>
                                    </ul>
                                </div>

                                <div className="w-full h-px bg-neutral-100" />

                                <div className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                                            <span className="text-red-400 text-lg">✕</span>
                                        </div>
                                        <h3 className="text-xl font-bold text-red-400">Wrong Colors</h3>
                                    </div>
                                    <ul className="space-y-2.5 text-neutral-500 leading-relaxed ml-[52px]">
                                        <li>Skin appears dull, sallow, or washed out</li>
                                        <li>Dark circles and blemishes become more visible</li>
                                        <li>Features look flat and undefined</li>
                                        <li>The clothes wear you</li>
                                    </ul>
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ─── 4. HOW IT WORKS ─── */}
            <section id="how-it-works" className="py-20 md:py-28 px-6 bg-[#FBF7F2]">
                <div className="max-w-6xl mx-auto">
                    <Reveal>
                        <div className="text-center mb-16 space-y-4">
                            <p className="text-[#C48B7A] text-xs font-bold tracking-[0.25em] uppercase">Simple Process</p>
                            <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">
                                Three Steps to Your Best Colors
                            </h2>
                            <p className="text-neutral-500 text-lg max-w-xl mx-auto">
                                Our AI-powered analysis takes less than 2 minutes. No appointments, no draping — just science and style.
                            </p>
                        </div>
                    </Reveal>

                    <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
                        {[
                            {
                                icon: Camera,
                                step: '01',
                                title: 'Upload Your Photo',
                                desc: 'Take a selfie in natural lighting with minimal makeup. Our AI needs to see your true skin tone, eye color, and natural hair.',
                            },
                            {
                                icon: Scan,
                                step: '02',
                                title: 'AI Analyzes Your Features',
                                desc: 'Our algorithm detects your undertone warmth, contrast level, and color depth to match you to your seasonal archetype.',
                            },
                            {
                                icon: Palette,
                                step: '03',
                                title: 'Get Your Season & Palette',
                                desc: 'Receive your personalized seasonal type with a curated palette of your most flattering colors for clothing, makeup, and accessories.',
                            },
                        ].map((item, i) => (
                            <Reveal key={i} delay={i * 120}>
                                <div className="relative bg-white rounded-3xl p-8 shadow-sm border border-neutral-100/80 hover:shadow-lg hover:border-[#C48B7A]/20 transition-all duration-300 group">
                                    <div className="absolute -top-3 -right-2 w-8 h-8 rounded-full bg-[#C48B7A] text-white text-xs font-black flex items-center justify-center shadow-md">
                                        {item.step}
                                    </div>
                                    <div className="w-14 h-14 rounded-2xl bg-[#FBF0EC] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                        <item.icon className="w-7 h-7 text-[#C48B7A]" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-3 tracking-tight">{item.title}</h3>
                                    <p className="text-neutral-500 leading-relaxed text-[15px]">{item.desc}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── 5. UNDERSTANDING SEASONAL COLOR ─── */}
            <section id="seasons" className="py-20 md:py-28 px-6 bg-white">
                <div className="max-w-6xl mx-auto">
                    <Reveal>
                        <div className="text-center mb-16 space-y-4">
                            <p className="text-[#C48B7A] text-xs font-bold tracking-[0.25em] uppercase">The 12-Season System</p>
                            <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">
                                Understanding Seasonal Color Analysis
                            </h2>
                            <p className="text-neutral-500 text-lg max-w-2xl mx-auto">
                                Every person falls into one of four seasonal families, each with three sub-types. Your season determines which colors harmonize with your natural coloring.
                            </p>
                        </div>
                    </Reveal>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {SEASONS.map((s, i) => (
                            <Reveal key={s.name} delay={i * 80}>
                                <div className={`rounded-3xl bg-gradient-to-br ${s.gradient} p-6 border border-white/60 shadow-sm hover:shadow-md transition-shadow`}>
                                    <h3 className="text-2xl font-heading font-bold mb-1">{s.name}</h3>
                                    <div className="space-y-1 text-sm text-neutral-600 mb-5">
                                        <p>{s.undertone}</p>
                                        <p>{s.depth}</p>
                                        <p>{s.contrast}</p>
                                    </div>
                                    <div className="flex gap-1.5">
                                        {s.colors.map((c) => (
                                            <div
                                                key={c}
                                                className="w-8 h-8 rounded-lg shadow-sm border border-white/50"
                                                style={{ backgroundColor: c }}
                                                title={c}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── 6. PRICING ─── */}
            <section id="pricing" className="py-20 md:py-28 px-6 bg-[#FBF7F2]">
                <div className="max-w-5xl mx-auto">
                    <Reveal>
                        <div className="text-center mb-16 space-y-4">
                            <p className="text-[#C48B7A] text-xs font-bold tracking-[0.25em] uppercase">Simple Pricing</p>
                            <h2 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">
                                Start Free, Upgrade Anytime
                            </h2>
                        </div>
                    </Reveal>

                    <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
                        {/* Free Tier */}
                        <Reveal delay={100}>
                            <div className="bg-white rounded-3xl p-8 border border-neutral-100 shadow-sm">
                                <div className="mb-6">
                                    <h3 className="text-lg font-bold text-neutral-400 uppercase tracking-wider mb-1">Free</h3>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-4xl font-heading font-bold">$0</span>
                                    </div>
                                    <p className="text-sm text-neutral-400 mt-1">3 analyses included</p>
                                </div>
                                <ul className="space-y-3 mb-8">
                                    {['12-season classification', 'Top 10 best colors', '5 neutral colors', 'Undertone & depth analysis', '3 analyses total'].map((f) => (
                                        <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-600">
                                            <CheckCircle2 className="w-4 h-4 text-[#C48B7A] mt-0.5 shrink-0" /> {f}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={onStart}
                                    className="w-full py-3.5 rounded-2xl border-2 border-neutral-200 text-neutral-700 font-bold hover:border-neutral-300 hover:bg-neutral-50 transition-all active:scale-[0.97]"
                                >
                                    Start Free
                                </button>
                            </div>
                        </Reveal>

                        {/* Pro Tier */}
                        <Reveal delay={200}>
                            <div className="relative bg-gradient-to-br from-[#C48B7A]/80 to-[#A06B5E]/80 rounded-3xl p-8 text-white shadow-xl shadow-[#C48B7A]/10">
                                <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-white/25 text-xs font-bold tracking-wider uppercase backdrop-blur-sm">
                                    Coming Soon
                                </div>
                                <div className="mb-6">
                                    <h3 className="text-lg font-bold text-white/70 uppercase tracking-wider mb-1">Pro</h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-3xl font-heading font-bold">Unlimited</span>
                                    </div>
                                    <p className="text-sm text-white/50 mt-1">Unlimited generations per month</p>
                                </div>
                                <ul className="space-y-3 mb-8">
                                    {[
                                        'Everything in Free',
                                        'Unlimited analyses',
                                        'Downloadable PDF report',
                                        'Avoid colors palette',
                                        'Priority processing',
                                        'Analysis history & timeline',
                                    ].map((f) => (
                                        <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                                            <CheckCircle2 className="w-4 h-4 text-white/50 mt-0.5 shrink-0" /> {f}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    disabled
                                    className="w-full py-3.5 rounded-2xl bg-white/30 text-white font-bold cursor-not-allowed shadow-lg"
                                >
                                    Coming Soon
                                </button>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ─── 7. FINAL CTA ─── */}
            <section className="py-24 md:py-32 px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-[#F5E6D3] via-[#FCE9E8] to-[#E8D5CF]" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgba(255,255,255,0.5),transparent_70%)]" />

                <div className="relative max-w-3xl mx-auto text-center space-y-8">
                    <Reveal>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 backdrop-blur-sm border border-white/60 text-[#C48B7A] text-xs font-bold tracking-[0.2em] uppercase">
                            <Sparkles className="w-3.5 h-3.5" />
                            Takes Less Than 2 Minutes
                        </div>
                    </Reveal>
                    <Reveal delay={100}>
                        <h2 className="text-4xl md:text-6xl font-heading font-bold tracking-tight leading-tight">
                            Ready to Find Your<br /><span className="text-[#C48B7A] italic">Perfect Palette?</span>
                        </h2>
                    </Reveal>
                    <Reveal delay={200}>
                        <p className="text-neutral-600 text-lg md:text-xl max-w-xl mx-auto">
                            Join thousands who've transformed their wardrobe, makeup routine, and confidence with personalized color analysis.
                        </p>
                    </Reveal>
                    <Reveal delay={300}>
                        <button
                            onClick={onStart}
                            className="px-10 py-5 rounded-full bg-[#C48B7A] text-white text-xl font-bold hover:bg-[#B07A6A] transition-all shadow-2xl shadow-[#C48B7A]/30 active:scale-[0.97]"
                        >
                            Start Your Color Test →
                        </button>
                        <p className="text-neutral-500 text-sm mt-4">Free to start · No account required · Instant results</p>
                    </Reveal>
                </div>
            </section>

            {/* ─── 8. FOOTER ─── */}
            <footer className="py-12 bg-neutral-900 text-center">
                <div className="max-w-7xl mx-auto px-6 space-y-4">
                    <div className="flex items-center justify-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center">
                            <Sparkles className="w-4 h-4 text-white/60" />
                        </div>
                        <span className="text-white/60 font-bold text-sm">Personal Color AI</span>
                    </div>
                    <p className="text-neutral-500 text-sm">
                        AI-powered seasonal color analysis for your most flattering wardrobe.
                    </p>
                    <p className="text-neutral-600 text-xs">© {new Date().getFullYear()} Personal Color AI. All rights reserved.</p>
                </div>
            </footer>
        </div>
    );
}
