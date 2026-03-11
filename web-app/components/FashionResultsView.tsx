import { Share2, Download, RefreshCw, AlertTriangle, Info, X, HelpCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useRef, useState } from "react";

interface ColorResult {
    skin: {
        hex_actual: string;
        hex_normalized: string;
        hue_deg: number;
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
}

export default function FashionResultsView({ data, image, onReset }: FashionResultsViewProps) {
    const { season, skin, best_colors, neutrals, avoid_colors } = data;
    const [isInfoOpen, setIsInfoOpen] = useState(false);
    const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);

    // Determine gradient overlay based on season
    const getGradient = (seasonName: string) => {
        const s = seasonName.toLowerCase();
        if (s.includes("spring")) return "from-transparent via-orange-100/20 to-orange-200/90";
        if (s.includes("summer")) return "from-transparent via-blue-100/20 to-blue-200/90";
        if (s.includes("autumn")) return "from-transparent via-amber-100/20 to-amber-900/80";
        if (s.includes("winter")) return "from-transparent via-purple-100/20 to-fuchsia-900/80";
        return "from-transparent via-neutral-100/20 to-neutral-200/90";
    };

    const gradientClass = getGradient(season.season4);

    const handleShare = async () => {
        const shareData = {
            title: `My Season is ${season.season12} ✨`,
            text: `I just found my personal color seasonal palette: ${season.season12}! Discover your true colors here:`,
            url: window.location.origin,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (error) {
                console.log('Error sharing:', error);
            }
        } else {
            alert("Sharing is not supported on this device. Copy the URL: " + window.location.origin);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const disclaimerText = "This seasonal analysis is an AI-generated estimation based on your uploaded photo. Lighting, camera quality, and shadows can affect the result. This is not a substitute for a professional in-person color analysis. Use these palettes as a guide to discover what makes you glow!";

    return (
        <div className="relative w-full h-[100dvh] bg-black font-sans text-neutral-900 flex flex-col md:flex-row overflow-hidden print:h-auto print:overflow-visible print:block">

            {/* --- PRINT STYLES --- */}
            <style jsx global>{`
                @media print {
                    @page { 
                        margin: 0; 
                        size: portrait; 
                    }
                    body { 
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important; 
                        background: white !important; 
                    }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    
                    /* Reset container for print */
                    .print-container {
                        position: static !important;
                        height: auto !important;
                        width: 100% !important;
                        overflow: visible !important;
                        padding: 2cm !important;
                        background: white !important;
                    }
                    
                    .print-break-inside { break-inside: avoid; page-break-inside: avoid; }
                    
                    /* Refined Typography for PDF */
                    h1 { font-size: 48pt !important; color: black !important; margin-bottom: 0.5cm !important; }
                    h2 { font-size: 24pt !important; color: black !important; margin-bottom: 1cm !important; }
                    p, span:not([style*="background-color"]) { color: #333 !important; }

                    /* Ensure background colors show up */
                    [style*="background-color"] {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    ::-webkit-scrollbar { display: none; }
                }
            `}</style>


            {/* --- MODALS (Hidden on Print) --- */}
            <AnimatePresence>
                {/* Season Info Modal */}
                {isInfoOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm no-print"
                        onClick={() => setIsInfoOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-2xl p-6 max-w-md w-full relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => setIsInfoOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-100">
                                <X className="w-5 h-5 text-neutral-500" />
                            </button>
                            <h3 className="text-xl font-heading font-bold mb-4">Understanding Color Seasons</h3>
                            <div className="space-y-4 text-sm text-neutral-600 leading-relaxed">
                                <p>Personal Color Analysis categorizes your coloring into one of 4 main seasons (Spring, Summer, Autumn, Winter), often subdivided into 12 subtypes.</p>
                                <div className="grid grid-cols-1 gap-2">
                                    <div className="p-2 bg-neutral-50 rounded">
                                        <strong>Undertone:</strong> Warm (Yellow/Gold) vs Cool (Blue/Pink).
                                    </div>
                                    <div className="p-2 bg-neutral-50 rounded">
                                        <strong>Clarity:</strong> Clear (Bright) vs Soft (Muted).
                                    </div>
                                    <div className="p-2 bg-neutral-50 rounded">
                                        <strong>Depth:</strong> Light (Pale) vs Deep (Dark).
                                    </div>
                                </div>
                                <div className="p-3 bg-neutral-900 text-white rounded-lg border border-neutral-800 text-xs mt-4">
                                    <strong>Your Result: {season.season12}</strong> indicates {season.undertone} undertones with {season.clarity} & {season.depth} qualities.
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}

                {/* Disclaimer Modal (Mobile) */}
                {isDisclaimerOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm no-print"
                        onClick={() => setIsDisclaimerOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.9, y: 20 }}
                            className="bg-white rounded-2xl p-6 max-w-sm w-full relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button onClick={() => setIsDisclaimerOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-neutral-100">
                                <X className="w-5 h-5 text-neutral-500" />
                            </button>
                            <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                                <Info className="w-5 h-5" /> Disclaimer
                            </h3>
                            <p className="text-sm text-neutral-600 leading-relaxed">
                                {disclaimerText}
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>


            {/* --- LEFT / BACKGROUND: IMAGE --- */}
            {/* HIDDEN ON PRINT: The user requested the report NOT have the image. */}
            <div className="absolute inset-0 z-0 md:relative md:w-1/2 md:h-full md:inset-auto no-print">
                <img
                    src={image || "/placeholder.jpg"}
                    alt="Cover"
                    className="w-full h-full object-cover opacity-90 md:opacity-100"
                    crossOrigin="anonymous"
                />
                {/* Mobile: Scrims for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 md:hidden" />
                <div className={`absolute inset-0 bg-gradient-to-t ${gradientClass} opacity-90 md:hidden`} />
            </div>

            {/* --- RIGHT / FOREGROUND: CONTENT --- */}
            {/* PRINT OPTIMIZATION: Full width, no scrolling, simple white background */}
            <div className="absolute inset-0 z-10 md:static md:w-1/2 md:h-full md:bg-neutral-50 flex flex-col md:overflow-y-auto print-container overflow-y-auto">

                {/* Header Actions - Static on mobile to allow scrolling content away */}
                <div className="p-6 md:p-8 flex justify-between items-start md:bg-white md:border-b md:border-neutral-100 md:sticky md:top-0 md:z-20 print:static print:p-0 print:mb-8 print:border-none bg-black/20 backdrop-blur-sm md:backdrop-blur-none border-b border-white/10 md:border-none">
                    <div className="flex items-start gap-4">
                        <div className="text-white md:text-neutral-900 drop-shadow-md md:drop-shadow-none">
                            <p className="text-[10px] tracking-[0.2em] font-bold uppercase opacity-90 mb-2 text-white/60 md:text-neutral-500 print:text-neutral-600">
                                Your True Colors
                            </p>
                            {/* Force text-black in print to avoid white-on-white issues if parent contrast fails */}
                            <h1 className="text-4xl md:text-6xl font-serif leading-none tracking-tighter print:text-black">
                                {season.season4}
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="font-serif italic text-lg opacity-90 print:text-black">
                                    You belong to <span className="underline decoration-white/30 md:decoration-neutral-300 print:decoration-neutral-300">{season.season12}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <button onClick={onReset} className="p-2.5 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 border border-white/20 md:bg-neutral-100 md:text-neutral-600 md:border-neutral-200 md:hover:bg-neutral-200 transition-all shadow-xl md:shadow-none no-print">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className="flex-1 p-4 md:p-8 pb-32 md:pb-8">
                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="w-full max-w-2xl mx-auto"
                    >
                        {/* Card Container */}
                        <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-2xl text-neutral-900 border border-white/20 md:border-none print:shadow-none print:p-0">

                            <div className="space-y-10 print:space-y-6">

                                {/* Confidence Score & Stats */}
                                <div className="flex items-center gap-5 border-b border-neutral-100 pb-6 print-break-inside">

                                    {image && (
                                        <div className="w-20 h-20 rounded-full ring-4 ring-neutral-50 overflow-hidden shadow-sm flex-shrink-0">
                                            <img src={image} className="w-full h-full object-cover" alt="User" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                                        </div>
                                    )}

                                    <div className="flex-1 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                        <div>
                                            <p className="text-[10px] uppercase text-neutral-400 font-bold mb-1 tracking-widest">Undertone</p>
                                            <p className="font-semibold text-neutral-900">{season.undertone}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase text-neutral-400 font-bold mb-1 tracking-widest">Confidence</p>
                                            <p className="font-semibold text-neutral-900">{(season.confidence * 100).toFixed(0)}%</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-[10px] uppercase text-neutral-400 font-bold mb-1 tracking-widest">Quality</p>
                                            <p className="font-semibold text-neutral-900">{season.clarity} & {season.depth}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* BEST COLORS */}
                                <div className="print-break-inside">
                                    <p className="text-[11px] uppercase text-neutral-400 font-black mb-5 tracking-[0.2em]">Power Palette</p>
                                    <div className="grid grid-cols-5 gap-3 md:gap-4 print:flex print:flex-wrap">
                                        {best_colors.map((hex, i) => (
                                            <div key={i} className="flex flex-col items-center gap-2">
                                                <div
                                                    className="w-full aspect-square rounded-full shadow-inner border border-black/5 transition-transform hover:scale-110"
                                                    style={{ backgroundColor: hex, printColorAdjust: 'exact' }}
                                                />
                                                <p className="text-[8px] font-mono text-neutral-400 uppercase">{hex}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* NEUTRALS */}
                                <div className="print-break-inside">
                                    <p className="text-[11px] uppercase text-neutral-400 font-black mb-5 tracking-[0.2em]">Essentials</p>
                                    <div className="flex gap-4">
                                        {neutrals.map((hex, i) => (
                                            <div key={i} className="flex flex-col items-center gap-2">
                                                <div
                                                    className="w-10 h-10 rounded-full border border-neutral-100 shadow-sm"
                                                    style={{ backgroundColor: hex, printColorAdjust: 'exact' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* AVOID COLORS */}
                                <div className="bg-red-50/50 rounded-3xl p-6 border border-red-100 flex flex-col gap-5 print:bg-white print:border-neutral-200 print-break-inside">
                                    <div className="flex items-center gap-2 text-red-400">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="text-[10px] uppercase font-black tracking-[0.2em]">Avoid These</span>
                                    </div>

                                    <div className="flex flex-wrap gap-3">
                                        {avoid_colors.slice(0, 10).map((hex, i) => (
                                            <div key={i} className="w-8 h-8 rounded-full border border-black/5 relative shadow-sm">
                                                <div className="absolute inset-0 rounded-full" style={{ backgroundColor: hex, printColorAdjust: 'exact' }} />
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <div className="w-[1.5px] h-full bg-white/40 rotate-45" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Bottom Disclaimer - part of flow */}
                                <div className="pt-10 border-t border-neutral-100 text-[10px] leading-relaxed text-neutral-400 print:text-neutral-500">
                                    <p className="flex items-start gap-2">
                                        <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-40" />
                                        <span>
                                            <strong>Disclaimer:</strong> {disclaimerText}
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* DESKTOP FOOTER ACTIONS - part of flow */}
                        <div className="hidden md:flex gap-4 mt-12 no-print">
                            <button onClick={handlePrint} className="flex-1 py-4 bg-white border border-neutral-200 text-neutral-900 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-neutral-50 transition-all flex items-center justify-center gap-2 shadow-sm">
                                <Download className="w-4 h-4" /> Download Report
                            </button>
                            <button onClick={handleShare} className="flex-1 py-4 bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 shadow-xl">
                                <Share2 className="w-4 h-4" /> Share My Results
                            </button>
                        </div>
                    </motion.div>
                </div>

                {/* MOBILE FIXED ACTIONS - With blur and proper spacing to not overlap card content if scrolled to bottom */}
                <div className="md:hidden fixed bottom-6 left-6 right-6 z-30 flex gap-3 no-print">
                    <button onClick={handlePrint} className="w-14 h-14 flex items-center justify-center bg-white border border-neutral-200 text-neutral-900 rounded-2xl shadow-2xl active:scale-90 transition-transform">
                        <Download className="w-5 h-5" />
                    </button>
                    <button onClick={handleShare} className="flex-1 h-14 bg-black text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] shadow-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
                        <Share2 className="w-5 h-5" /> Share Result
                    </button>
                </div>
            </div>

        </div>
    );
}
