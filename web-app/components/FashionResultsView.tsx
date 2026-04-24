import { Share2, Download, RefreshCw, AlertTriangle, Info, X, Loader2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { toPng } from "html-to-image";

interface ColorResult {
    skin: {
        hex_actual: string;
        hex_normalized: string;
        hue_deg: number;
    };
    debug?: {
        stats_actual?: {
            ITA?: number;
        };
        reasons?: string[];
    };
    season: {
        season4: string;
        season12: string;
        confidence: number;
        undertone: string;
        depth: string;
        clarity: string;
    };
    best_colors: string[];
    neutrals: string[];
    avoid_colors: string[];
}

interface FashionResultsViewProps {
    data: ColorResult;
    image: string | null;
    onReset: () => void;
    onClose?: () => void;
}

const STYLE_ADVICE: Record<string, { vibe: string; fashion: string; makeup: string }> = {
    "Light Spring": {
        vibe: "Fresh, delicate, and luminous. You shine in bright, warm, and clear pastels.",
        fashion: "Opt for lightweight fabrics like chiffon and silk. Monochromatic light palettes or gentle color blocking works best. Avoid heavy, dark fabrics.",
        makeup: "Peachy pinks, warm coral lips, and a dewy finish. Avoid heavy contouring or dark smokey eyes."
    },
    "True Spring": {
        vibe: "Warm, radiant, and sunny. Pure warm colors with medium contrast.",
        fashion: "Use medium-high contrast color combinations. Warm metals like pure gold elevate your look. Floral prints in bright, warm colors suit you beautifully.",
        makeup: "Warm apricot blush, coral or warm red lips. Dewy and luminous base."
    },
    "Bright Spring": {
        vibe: "Energetic, clear, and highly contrasted. You carry highly saturated, bright warm colors beautifully.",
        fashion: "Embrace high-contrast color blocking. Glossy and smooth fabrics like silk and satin reflect your natural clarity best.",
        makeup: "Vibrant coral or bright pink lips with a glossy finish. Keep lines crisp and clear."
    },
    "Light Summer": {
        vibe: "Cool, airy, and gentle. Light cool tones with soft contrast.",
        fashion: "Soft, flowing fabrics like linen or soft cotton in pastel cool tones. Monochromatic dressing in icy pastels looks incredibly elegant.",
        makeup: "Soft rosy blush, cool pink lip tints, and a sheer base."
    },
    "True Summer": {
        vibe: "Cool, serene, and elegant. Completely cool undertones with muted softness.",
        fashion: "Medium-low contrast outfits. Silver jewelry is your best friend. Soft, matte textures like suede and cashmere enhance your natural elegance.",
        makeup: "Cool mauve lips, soft rosy cheeks, and matte or satin finishes rather than high gloss."
    },
    "Soft Summer": {
        vibe: "Muted, blended, and sophisticated. Cool greyed tones that are velvety and subtle.",
        fashion: "Tonal dressing in dusty, muted shades. Matte fabrics, brushed cotton, and soft denim. Avoid high-contrast patterns.",
        makeup: "Soft smokey eyes in taupe, dusty rose lips, and completely matte finishes."
    },
    "Soft Autumn": {
        vibe: "Earthy, muted, and toasted. Warm, blended colors with low contrast.",
        fashion: "Texture is key: corduroy, suede, soft knits, and tweed in earthy tones. Tonal layering looks very expensive on you. Antique gold metals.",
        makeup: "Nude lips, warm peach blush, and soft diffused eyeshadow in bronze or taupe."
    },
    "True Autumn": {
        vibe: "Rich, golden, and warm. The deep, vibrant colors of a fall landscape.",
        fashion: "Medium contrast outfits with rich, warm colors. Heavy textures like leather, wool, and velvet work phenomenally well. Wear bronze and copper accessories.",
        makeup: "Terracotta blush, warm brick red lips, and a bronzed, golden glow."
    },
    "Dark Autumn": {
        vibe: "Deep, intense, and mysterious. Warm, dark colors with rich contrast.",
        fashion: "High contrast works perfectly. Pair deep warm darks with slightly lighter earthy tones. Velvet, leather, and rich brocade enhance your depth.",
        makeup: "Deep plum or brick red lipstick, dark bronze smokey eyes, and warm contouring."
    },
    "Dark Winter": {
        vibe: "Deep, bold, and dramatic. Cool, dark colors with high contrast striking features.",
        fashion: "High contrast dressing, pairing icy lights with deepest darks. Smooth, crisp fabrics like formal suiting and patent leather. Silver and platinum.",
        makeup: "Deep berry or burgundy lips, dramatic black eyeliner, and cool, crisp contour."
    },
    "True Winter": {
        vibe: "Vivid, striking, and icy. Pure cool tones with jewel-like clarity.",
        fashion: "Bold color blocking with jewel tones. High contrast combinations like stark black and pristine white. Crisp, smooth, structured fabrics.",
        makeup: "True blue-based red lipstick, classic cat-eye liner, and cool pink blush."
    },
    "Bright Winter": {
        vibe: "Luminous, crystalline, and dazzling. The highest contrast with clear, cool, neon-like brightness.",
        fashion: "Extreme contrast and vibrant jewel tones. Reflective fabrics, sequins, and patent leather. Do not shy away from the boldest, clearest colors.",
        makeup: "Fuchsia or vivid cherry lips, high-shine finishes, and crisp, clear eye makeup."
    }
};

export default function FashionResultsView({ data, image, onReset, onClose }: FashionResultsViewProps) {
    const { season, skin, best_colors, neutrals, avoid_colors, debug } = data;
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const reportRef = useRef<HTMLDivElement>(null);

    const _season12 = season?.season12 || "Soft Autumn";
    const _season4 = season?.season4 || "Autumn";
    const advice = STYLE_ADVICE[_season12] || STYLE_ADVICE["Soft Autumn"];
    const config = { bg: "bg-[#050505]", text: "text-white/90" };
    const itaScore = debug?.stats_actual?.ITA?.toFixed(1) || "N/A";
    const analysisDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // --- COLOR THEORY MATH ---
    const hexToHSL = (hex: string) => {
        let cleanHex = hex.replace(/^#/, '');
        if (cleanHex.length === 3) cleanHex = cleanHex.split('').map(c => c + c).join('');
        const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
        const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
        const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return { h: h * 360, s: s * 100, l: l * 100, hex: '#' + cleanHex };
    };

    const safeBest = best_colors || [];
    const safeNeutrals = neutrals || [];

    // Parse and sort
    const hslNeutrals = safeNeutrals.map(hexToHSL).sort((a, b) => a.l - b.l); // Darkest to lightest
    const hslBest = safeBest.map(hexToHSL).sort((a, b) => b.s - a.s); // Most saturated to least

    const darkestNeutral = hslNeutrals[0] || { hex: "#000" };
    const lightestNeutral = hslNeutrals[hslNeutrals.length - 1] || { hex: "#fff" };
    const midNeutral = hslNeutrals[Math.floor(hslNeutrals.length / 2)] || darkestNeutral;

    // Highest saturation for the main pop of color
    const popColor1 = hslBest[0] || { hex: "#fff", h: 0 };
    // Find a second pop color that has a noticeably different hue, or just pick the next best
    const popColor2 = hslBest.find(c => Math.abs(c.h - popColor1.h) > 30) || hslBest[1] || popColor1;

    // Combo 1: The Core Foundation (Dark + Light Accent)
    // Classic high-contrast 2-piece (e.g., Black + Peach)
    const c1_neutral = darkestNeutral.hex;
    const c1_accent = popColor1.hex;

    // Combo 2: Tonal Harmony (Light/Mid Neutral + 2 Analogous Colors)
    const c2_neutral = midNeutral.hex;
    const c2_color1 = hslBest[0] || { hex: "#fff" };
    const c2_color2 = hslBest.find(c => c.hex !== c2_color1.hex && Math.abs(c.h - c2_color1.h) <= 45) || hslBest[1] || c2_color1;

    // Combo 3: The Editorial Edge (Darkest Neutral + Lightest Neutral + Accent)
    // Classic 3-piece high contrast (e.g., Black + White + Olive)
    const c3_neutral_dark = darkestNeutral.hex;
    const c3_neutral_light = lightestNeutral.hex;
    const c3_accent = popColor2.hex;

    const signatureCombinations = [
        {
            title: "The Core Foundation",
            desc: "Your deepest neutral anchored by a highly saturated signature pop of color.",
            colors: [c1_accent, c1_neutral] // Accent on top, dark neutral at back
        },
        {
            title: "Tonal Harmony",
            desc: "A sophisticated blend of analogous hues balanced by a mid-tone neutral.",
            colors: [c2_color1.hex, c2_color2.hex, c2_neutral]
        },
        {
            title: "The Editorial Edge",
            desc: "High-contrast statement: your darkest and lightest neutrals framing a bold accent.",
            colors: [c3_accent, c3_neutral_light, c3_neutral_dark] // Accent on top, light mid, dark back
        }
    ];

    const handleShare = async () => {
        const shareData = {
            title: `My Season is ${_season12} âœ¨`,
            text: `I just found my personal color seasonal palette: ${_season12}! Discover your true colors here:`,
            url: window.location.origin,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.log('Error sharing:', error);
            }
        }
    };

    const handleDownload = async () => {
        if (!reportRef.current || isDownloading) return;
        setIsDownloading(true);
        try {
            // Hide action buttons during capture
            const noCapture = reportRef.current.querySelectorAll('.no-capture');
            noCapture.forEach(el => (el as HTMLElement).style.display = 'none');

            const dataUrl = await toPng(reportRef.current, {
                quality: 1.0,
                pixelRatio: 2,
                backgroundColor: '#050505',
            });

            // Restore action buttons
            noCapture.forEach(el => (el as HTMLElement).style.display = '');

            const link = document.createElement('a');
            link.download = `color-analysis-${_season12.replace(/\s+/g, '-').toLowerCase()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error('Failed to generate image:', error);
            // Restore buttons on error too
            const noCapture = reportRef.current.querySelectorAll('.no-capture');
            noCapture.forEach(el => (el as HTMLElement).style.display = '');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div ref={reportRef} className={`report-container relative w-full min-h-[100dvh] ${config.bg} font-sans ${config.text}`}>
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#C48B7A]/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />


            {/* Info Modal */}
            <AnimatePresence>
                {isInfoOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm no-print"
                        onClick={() => setIsInfoOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 10 }}
                            className="bg-white rounded-[2rem] p-8 max-w-sm w-full relative shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => setIsInfoOpen(false)} className="absolute top-6 right-6 p-2 rounded-full hover:bg-neutral-100 transition-colors">
                                <X className="w-5 h-5 text-neutral-400" />
                            </button>
                            <h3 className="text-xl font-serif font-bold mb-4 text-[#4A3d36]">Technical Details</h3>
                            <div className="space-y-4 text-sm text-neutral-600 leading-relaxed">
                                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                                    <p className="font-bold text-neutral-800 mb-1">Skin Color Coordinates</p>
                                    <p>Detected Hex: {skin.hex_actual}</p>
                                    <p>Hue Angle: {skin.hue_deg.toFixed(1)}Â°</p>
                                    <p>ITA (Individual Typology Angle): {itaScore}</p>
                                </div>
                                <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                                    <p className="font-bold text-neutral-800 mb-1">Classification</p>
                                    <p><strong>Season:</strong> {_season12}</p>
                                    <p><strong>Undertone:</strong> {season.undertone}</p>
                                    <p><strong>Depth & Clarity:</strong> {season.depth} & {season.clarity}</p>
                                    <p><strong>AI Confidence:</strong> {(season.confidence * 100).toFixed(0)}%</p>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TOP ACTIONS - MOBILE */}
            <div className="fixed top-4 right-4 z-50 flex gap-2 md:hidden no-capture">
                <button onClick={onClose || onReset} className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-md shadow-sm flex items-center justify-center border border-black/5">
                    <X className="w-4 h-4 text-black" />
                </button>
                <button onClick={onReset} className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-md shadow-sm flex items-center justify-center border border-black/5">
                    <RefreshCw className="w-4 h-4 text-black" />
                </button>
            </div>


            <div className="max-w-[1200px] mx-auto px-6 py-10 md:py-16">
                
                {/* HEADER */}
                <header className="mb-12 pb-8 border-b border-white/10 rpt-divider rpt-header">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl">
                            {/* BACK BUTTON */}
                            <button onClick={onClose || onReset} className="mb-6 flex items-center gap-2 text-white/50 hover:text-white transition-colors text-[11px] font-bold uppercase tracking-widest no-capture">
                                <ArrowLeft className="w-4 h-4" />
                                Back
                            </button>
                            <p className="text-[11px] font-bold uppercase tracking-[0.25em] mb-3 opacity-50 rpt-muted">Your True Colors</p>
                            <h1 className="text-5xl md:text-6xl font-serif tracking-tight leading-none mb-4 rpt-heading">
                                The {_season12}
                            </h1>
                            <p className="text-lg text-white/60 font-light leading-relaxed rpt-narrative">{advice.vibe}</p>
                        </motion.div>
                        <div className="hidden md:flex items-center gap-3 shrink-0 no-capture">
                            <button onClick={() => setIsInfoOpen(true)} className="px-5 py-2.5 rounded-full bg-white/10 text-sm font-semibold text-white hover:bg-white/20 transition-colors flex items-center gap-2 border border-white/5">
                                <Info className="w-4 h-4" /> Details
                            </button>
                            <button onClick={onReset} className="px-5 py-2.5 rounded-full bg-white/10 text-sm font-semibold text-white hover:bg-white/20 transition-colors flex items-center gap-2 border border-white/5">
                                <RefreshCw className="w-4 h-4" /> Reset
                            </button>
                            <button onClick={handleDownload} disabled={isDownloading} className="px-5 py-2.5 rounded-full bg-white text-sm font-semibold text-black hover:bg-neutral-200 shadow-xl transition-colors flex items-center gap-2 disabled:opacity-50">
                                {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {isDownloading ? 'Saving...' : 'Save Image'}
                            </button>
                            <button onClick={handleShare} className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#C48B7A] to-[#A06B5E] text-white text-sm font-semibold shadow-xl hover:brightness-110 transition-all flex items-center gap-2">
                                <Share2 className="w-4 h-4" /> Share
                            </button>
                        </div>
                    </div>
                </header>

                {/* BENTO BOX GRID */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-start rpt-grid">
                    
                    {/* LEFT COLUMN: Profile Card */}
                    <div className="md:col-span-5 md:sticky md:top-8 flex flex-col gap-6 rpt-left">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="rpt-card bg-white/5 backdrop-blur-2xl rounded-[2rem] p-6 shadow-2xl flex flex-col items-center border border-white/10"
                        >
                            {/* Portrait */}
                            <div className="rpt-portrait w-full aspect-[4/5] bg-white/5 rounded-t-full rounded-b-[4rem] overflow-hidden shadow-inner mb-8 relative">
                                {image ? (
                                    <img src={image} className="w-full h-full object-cover" alt="User portrait" crossOrigin="anonymous" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/30 font-serif">Portrait</div>
                                )}
                            </div>

                            {/* Key Stats */}
                            <div className="w-full space-y-5 rpt-stats">
                                <div className="flex justify-between items-center border-b border-white/10 rpt-divider pb-4">
                                    <span className="text-xs text-white/40 rpt-muted font-semibold uppercase tracking-wider">Season</span>
                                    <span className="flex items-center gap-2.5">
                                        <div 
                                            className="w-4 h-4 rounded-full border border-white/20 rpt-skin-dot shadow-sm"
                                            style={{ backgroundColor: skin.hex_actual }}
                                        />
                                        <span className="font-serif text-lg font-medium text-white rpt-value">{_season12}</span>
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/10 rpt-divider pb-4">
                                    <span className="text-xs text-white/40 rpt-muted font-semibold uppercase tracking-wider">Undertone</span>
                                    <span className="font-medium text-white rpt-value">{season.undertone}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-white/10 rpt-divider pb-4">
                                    <span className="text-xs text-white/40 rpt-muted font-semibold uppercase tracking-wider">Depth & Clarity</span>
                                    <span className="font-medium text-white rpt-value">{season.depth} & {season.clarity}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-xs text-white/40 rpt-muted font-semibold uppercase tracking-wider">Analysis Date</span>
                                    <span className="text-sm text-white/60 rpt-muted">{analysisDate}</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* RIGHT COLUMN: Color Cards */}
                    <div className="md:col-span-7 flex flex-col gap-6 md:gap-8 min-w-0 rpt-right">
                        
                        {/* YOUR BEST COLORS */}
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
                            className="rpt-card bg-white/5 backdrop-blur-2xl rounded-[2rem] p-8 md:p-10 shadow-2xl border border-white/10"
                        >
                            <div className="mb-6">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50 rpt-muted mb-1">Your Best Colors</h3>
                                <p className="text-sm text-white/70 rpt-sub">Your core seasonal colors. Wear these close to your face for maximum impact.</p>
                            </div>
                            <div className="grid grid-cols-5 gap-y-8 gap-x-4 rpt-best-grid">
                                {best_colors.map((hex, i) => (
                                    <div key={i} className="flex flex-col items-center gap-3">
                                        <div
                                            className="rpt-swatch-circle w-12 h-12 md:w-16 md:h-16 rounded-full shadow-inner border border-white/10 rpt-swatch"
                                            style={{ backgroundColor: hex }}
                                        />
                                        <p className="rpt-hex-label text-[9px] md:text-[10px] font-mono text-white/40 rpt-muted uppercase tracking-widest">{hex}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* YOUR NEUTRALS */}
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
                            className="rpt-card bg-white/5 backdrop-blur-2xl rounded-[2rem] p-8 md:p-10 shadow-2xl border border-white/10"
                        >
                            <div className="mb-6">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50 rpt-muted mb-1">Your Neutrals</h3>
                                <p className="text-sm text-white/70 rpt-sub">Your go-to neutrals for foundational pieces, coats, and trousers.</p>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                {neutrals.map((hex, i) => (
                                    <div
                                        key={i}
                                        className="rpt-neutral-swatch w-14 h-14 md:w-20 md:h-20 rounded-2xl border border-white/20 rpt-swatch shadow-sm"
                                        style={{ backgroundColor: hex }}
                                    />
                                ))}
                            </div>
                        </motion.div>

                        {/* SHADES TO AVOID */}
                        <motion.div 
                            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
                            className="rpt-avoid bg-red-950/20 backdrop-blur-2xl rounded-[2rem] p-8 md:p-10 border border-red-500/20"
                        >
                            <div className="mb-6">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-red-400 rpt-avoid-title mb-1 flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Shades To Avoid
                                </h3>
                                <p className="text-sm text-red-200/60 rpt-avoid-desc">Colors that may clash with your natural undertone or wash you out.</p>
                            </div>
                            <div className="flex flex-wrap gap-4">
                                {avoid_colors.slice(0, 9).map((hex, i) => (
                                    <div key={i} className="rpt-avoid-swatch w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/10 rpt-swatch shadow-sm relative overflow-hidden">
                                        <div className="absolute inset-0" style={{ backgroundColor: hex }} />
                                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[2px] bg-white/70 rotate-45" />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* SIGNATURE COMBINATIONS */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                    className="mt-10 md:mt-14"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50 rpt-muted">Signature Combinations</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {signatureCombinations.map((combo, idx) => (
                            <div key={idx} className="rpt-card bg-white/5 backdrop-blur-2xl rounded-[2rem] p-8 shadow-2xl border border-white/10 flex flex-col items-center text-center">
                                <div className="flex items-center justify-center mb-6 h-20">
                                    {combo.colors.map((hex, cIdx) => (
                                        <div 
                                            key={cIdx} 
                                            className="w-16 h-16 rounded-full border-4 border-[#1A1817] shadow-xl relative"
                                            style={{ 
                                                backgroundColor: hex,
                                                marginLeft: cIdx === 0 ? '0' : '-1.5rem',
                                                zIndex: combo.colors.length - cIdx 
                                            }}
                                        />
                                    ))}
                                </div>
                                <h4 className="font-bold text-white rpt-heading text-sm uppercase tracking-widest mb-2 font-serif">{combo.title}</h4>
                                <p className="text-white/50 text-[11px] leading-relaxed rpt-sub">{combo.desc}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* STYLE GUIDE â€” Full Width 3-Column */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
                    className="mt-10 md:mt-14 rpt-style-grid"
                >
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50 rpt-muted mb-6">Style Guide</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="rpt-guide bg-white/5 backdrop-blur-2xl rounded-[2rem] p-8 shadow-2xl border border-white/10">
                            <h4 className="font-bold text-white rpt-guide-title text-sm uppercase tracking-widest mb-3 font-serif">Your Vibe</h4>
                            <p className="text-white/60 rpt-guide-text text-sm leading-relaxed">{advice.vibe}</p>
                        </div>
                        <div className="rpt-guide bg-white/5 backdrop-blur-2xl rounded-[2rem] p-8 shadow-2xl border border-white/10">
                            <h4 className="font-bold text-white rpt-guide-title text-sm uppercase tracking-widest mb-3 font-serif">Fashion & Fabrics</h4>
                            <p className="text-white/60 rpt-guide-text text-sm leading-relaxed">{advice.fashion}</p>
                        </div>
                        <div className="rpt-guide bg-white/5 backdrop-blur-2xl rounded-[2rem] p-8 shadow-2xl border border-white/10">
                            <h4 className="font-bold text-white rpt-guide-title text-sm uppercase tracking-widest mb-3 font-serif">Beauty Harmonies</h4>
                            <p className="text-white/60 rpt-guide-text text-sm leading-relaxed">{advice.makeup}</p>
                        </div>
                    </div>
                </motion.div>

                {/* FOOTER */}
                <footer className="rpt-footer mt-16 pt-10 border-t border-white/10 flex flex-col md:flex-row items-center justify-between text-center md:text-left gap-8 pb-10">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-white rpt-footer-brand mb-1">Personal Color Analysis</h2>
                        <p className="text-sm text-white/50 rpt-footer-sub font-medium mb-3">AI-Powered Seasonal Color Analysis</p>
                        <p className="text-xs text-white/40 rpt-muted mb-1">
                            <a href="https://personalcoloranalysis.madsoul.in/" target="_blank" rel="noreferrer" className="text-white/70 rpt-footer-link font-semibold underline hover:text-white">personalcoloranalysis.madsoul.in</a>
                        </p>
                        <p className="text-xs text-white/30 rpt-muted">Generated {analysisDate}</p>
                    </div>
                    <div className="w-24 h-24 bg-white p-2 rounded-xl shadow-2xl border border-white/10 flex items-center justify-center">
                        <img src="/qr-code.png" alt="Scan QR Code" className="w-full h-full object-contain" onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" fill="%23f0f0f0"><rect width="100" height="100"/></svg>';
                        }} />
                    </div>
                </footer>

                {/* MOBILE FAB */}
                <div className="fixed bottom-6 w-full px-6 flex justify-center gap-4 md:hidden z-50 no-capture" style={{ left: 0 }}>
                    <button onClick={handleDownload} disabled={isDownloading} className="w-14 h-14 bg-white text-neutral-900 rounded-full shadow-2xl shadow-black/20 flex items-center justify-center border border-black/5 hover:scale-105 transition-transform disabled:opacity-50">
                        {isDownloading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                    </button>
                    <button onClick={handleShare} className="flex-1 max-w-[200px] h-14 bg-[#4A3d36] text-white rounded-full shadow-2xl flex items-center justify-center gap-2 font-bold text-sm tracking-widest uppercase hover:bg-black transition-colors">
                        <Share2 className="w-4 h-4" /> Share
                    </button>
                </div>
            </div>
        </div>
    );
}

