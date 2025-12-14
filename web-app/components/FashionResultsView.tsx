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
                    @page { margin: 1cm; size: portrait; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
                    .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    .print-break-inside { break-inside: avoid; page-break-inside: avoid; }
                    /* Ensure text is black for readability */
                    h1, h2, h3, p, span, div { color: black !important; text-shadow: none !important; }
                     /* Hide scrollbars */
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
            <div className="absolute inset-0 z-10 md:static md:w-1/2 md:h-full md:bg-neutral-50 flex flex-col justify-between md:overflow-y-auto print:static print:w-full print:h-auto print:bg-white print:overflow-visible">

                {/* Header Actions */}
                <div className="p-6 flex justify-between items-start md:bg-white md:border-b md:border-neutral-100 md:sticky md:top-0 md:z-20 print:static print:p-0 print:mb-8 print:border-none">
                    <div className="flex items-start gap-4">
                        <div className="text-white md:text-neutral-900 drop-shadow-md md:drop-shadow-none">
                            <p className="text-[10px] tracking-[0.2em] font-bold uppercase opacity-90 mb-2 text-neutral-500 print:text-neutral-600">
                                Your True Colors
                            </p>
                            {/* Force text-black in print to avoid white-on-white issues if parent contrast fails */}
                            <h1 className="text-5xl md:text-6xl font-serif leading-none tracking-tighter print:text-black">
                                {season.season4}
                            </h1>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="font-serif italic text-lg opacity-90 print:text-black">
                                    You belong to <span className="underline decoration-white/30 md:decoration-neutral-300 print:decoration-neutral-300">{season.season12}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <button onClick={onReset} className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 border border-white/20 md:bg-neutral-100 md:text-neutral-600 md:border-neutral-200 md:hover:bg-neutral-200 transition-all shadow-lg md:shadow-none no-print">
                        <RefreshCw className="w-5 h-5" />
                    </button>
                </div>

                {/* SCROLLABLE CONTENT AREA */}
                {/* Print: Remove all extra margins/padding constraints, let it flow naturally */}
                <div className="flex-1 md:p-8 flex flex-col justify-end md:justify-start overflow-y-auto md:overflow-visible no-scrollbar pb-6 md:pb-0 px-4 md:px-0 print:p-0 print:block">

                    <motion.div
                        initial={{ y: "20%", opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ duration: 0.8, ease: "circOut" }}
                        className="md:m-0 w-full"
                    >
                        {/* Card Container */}
                        {/* Print: Remove shadows, borders, backgrounds. Just clean text/layout. */}
                        <div className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-[2rem] p-6 shadow-2xl text-neutral-900 overflow-hidden relative md:bg-white md:backdrop-blur-none md:border-none md:shadow-none md:rounded-3xl md:p-8 print:bg-transparent print:p-0 print:shadow-none print:border-none print:rounded-none">

                            {/* Mobile Noise Texture (Hidden on Print) */}
                            <div className="absolute inset-0 opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] md:hidden no-print" />

                            <div className="relative z-10 space-y-8 print:space-y-6">

                                {/* Confidnece Score & Stats */}
                                <div className="flex items-center gap-4 border-b border-black/10 pb-4 md:border-neutral-200 print:border-neutral-200 print-break-inside">

                                    {/* Avatar Inside Card - Left as is, per user asking to remove 'image' referring to the Hero image likely. If they meant this too, they didn't specify small avatar versus hero. Assuming Hero. */}
                                    {image && (
                                        <div className="w-16 h-16 rounded-full border-2 border-white/50 overflow-hidden shadow-sm flex-shrink-0 print:border-neutral-200">
                                            <img src={image} className="w-full h-full object-cover" alt="User" referrerPolicy="no-referrer" crossOrigin="anonymous" />
                                        </div>
                                    )}

                                    <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                        <div>
                                            <p className="text-[10px] uppercase text-neutral-600 font-bold mb-0.5">Undertone</p>
                                            <p className="font-semibold leading-tight">{season.undertone}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className="flex items-center justify-end gap-1 mb-0.5">
                                                <p className="text-[10px] uppercase text-neutral-600 tracking-wider font-bold">Confidence</p>
                                            </div>
                                            <p className="font-semibold text-sm leading-tight">{(season.confidence * 100).toFixed(0)}%</p>
                                        </div>
                                        <div className="col-span-2">
                                            <p className="text-[10px] uppercase text-neutral-600 font-bold mb-0.5">Quality</p>
                                            <p className="font-semibold leading-tight">{season.clarity} & {season.depth}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* BEST COLORS */}
                                <div className="print-break-inside">
                                    <p className="text-[10px] uppercase text-neutral-600 font-bold mb-3 flex items-center justify-between">
                                        <span>Power Palette</span>
                                    </p>
                                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x md:flex-wrap md:overflow-visible print:flex-wrap print:gap-3 print:overflow-visible">
                                        {best_colors.map((hex, i) => (
                                            <div key={i} className="group flex-shrink-0 snap-center flex flex-col items-center gap-2">
                                                <div
                                                    className="w-14 h-14 rounded-full transition-transform hover:scale-110 border border-black/5 print:w-12 print:h-12 print:border-neutral-200"
                                                    style={{ backgroundColor: hex, printColorAdjust: 'exact' }}
                                                />
                                                <p className="text-[9px] font-mono opacity-60 uppercase">{hex}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* NEUTRALS */}
                                <div className="print-break-inside">
                                    <p className="text-[10px] uppercase text-neutral-600 font-bold mb-3">Essentials (Neutrals)</p>
                                    <div className="flex gap-3 print:gap-2">
                                        {neutrals.map((hex, i) => (
                                            <div key={i} className="flex flex-col items-center gap-1">
                                                <div
                                                    className="w-10 h-10 rounded-full border border-black/10 print:w-8 print:h-8 print:border-neutral-200"
                                                    style={{ backgroundColor: hex, printColorAdjust: 'exact' }}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* AVOID COLORS */}
                                <div className="bg-red-50/80 rounded-xl p-4 border border-red-100 relative overflow-hidden print:bg-white print:border-neutral-200 print:p-4 print-break-inside">
                                    <div className="flex items-center gap-2 mb-3 text-red-500">
                                        <AlertTriangle className="w-4 h-4" />
                                        <span className="text-[10px] uppercase font-bold tracking-wider">Avoid These</span>
                                    </div>

                                    <div className="flex flex-wrap gap-2 relative z-10 print:gap-2">
                                        {avoid_colors.slice(0, 7).map((hex, i) => (
                                            <div key={i} className="w-8 h-8 rounded-full border border-black/5 relative hover:scale-110 transition-transform print:border-neutral-200">
                                                <div className="absolute inset-0 bg-current rounded-full" style={{ backgroundColor: hex, printColorAdjust: 'exact' }} />
                                                <div className="absolute inset-0 flex items-center justify-center opacity-50">
                                                    <div className="w-[1px] h-full bg-white/50 rotate-45" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* ACTIONS: Download & Share (HIDDEN ON PRINT) */}
                                <div className="flex flex-col gap-3 md:mt-8 no-print">

                                    <div className="flex gap-3">
                                        {/* Download Report (Triggers Print) */}
                                        <button onClick={handlePrint} className="flex-none w-12 p-0 md:w-auto md:flex-1 md:py-3 bg-white border border-neutral-200 text-neutral-800 rounded-xl hover:bg-neutral-50 transition-all shadow-sm flex items-center justify-center gap-2">
                                            <Download className="w-4 h-4" />
                                            <span className="hidden md:inline text-xs font-bold tracking-widest uppercase">Download Report</span>
                                        </button>

                                        {/* Native Share */}
                                        <button onClick={handleShare} className="flex-1 py-3 bg-black text-white rounded-xl text-xs font-bold tracking-widest uppercase hover:scale-[1.02] active:scale-95 transition-all shadow-xl flex items-center justify-center gap-2">
                                            <Share2 className="w-4 h-4" />
                                            Share Result
                                        </button>
                                    </div>

                                </div>

                                {/* DISCLAIMER */}
                                <div className="hidden md:block mt-8 pt-6 border-t border-black/5 text-[10px] leading-relaxed text-neutral-400 print:block print:mt-4 print:pt-4 print:text-neutral-500">
                                    <p className="flex items-start gap-1">
                                        <Info className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-50" />
                                        <span>
                                            <strong>Disclaimer:</strong> {disclaimerText}
                                        </span>
                                    </p>
                                </div>

                            </div>
                        </div>

                    </motion.div>
                </div>
            </div>

        </div>
    );
}
