import { Share2, RefreshCw, Download } from "lucide-react";
import SeasonOrbit from "./SeasonOrbit";

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

interface ResultsViewProps {
    data: ColorResult;
    image: string | null;
    onReset: () => void;
}

export default function ResultsView({ data, image, onReset }: ResultsViewProps) {
    const { season, skin, best_colors, neutrals, avoid_colors } = data;

    return (
        <div className="w-full max-w-4xl mx-auto animate-fade-in pb-20">

            {/* Header: Concise and Elegant */}
            <div className="text-center mb-8">
                <h1 className="text-5xl md:text-7xl font-heading font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-dark to-primary tracking-tight">
                    {season.season4}
                </h1>
                <div className="flex items-center justify-center gap-2 mt-2 text-neutral-500 font-medium">
                    <span className="uppercase tracking-widest text-sm">{season.season12}</span>
                    <span className="w-1 h-1 bg-neutral-300 rounded-full" />
                    <span className="text-sm">{(season.confidence * 100).toFixed(0)}% Match</span>
                </div>
            </div>

            {/* Main Viz: The Planetary System */}
            <div className="relative mb-16">
                <SeasonOrbit
                    image={image || "/placeholder.jpg"}
                    bestColors={best_colors}
                    neutrals={neutrals}
                    season={season.season12}
                />
            </div>

            {/* Analysis Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">

                {/* Skin Analysis Card */}
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-neutral-100 shadow-sm">
                    <h3 className="font-heading font-bold text-xl mb-6 flex items-center gap-2">
                        <span>🧬 Skin Analysis</span>
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                            <span className="text-neutral-500">Undertone</span>
                            <span className="font-bold text-foreground">{season.undertone}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                            <span className="text-neutral-500">Quality</span>
                            <span className="font-bold text-foreground">{season.clarity} & {season.depth}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                            <span className="text-neutral-500">Skin Tone</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-neutral-400">{skin.hex_normalized}</span>
                                <div className="w-6 h-6 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: skin.hex_normalized }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Avoid Palette Card */}
                <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 border border-neutral-100 shadow-sm">
                    <h3 className="font-heading font-bold text-xl mb-6 flex items-center gap-2 text-red-500">
                        <span>⛔ Colors to Avoid</span>
                    </h3>
                    <p className="text-sm text-neutral-500 mb-4">These colors may wash you out or clash with your natural harmony.</p>
                    <div className="flex flex-wrap gap-3">
                        {avoid_colors.slice(0, 10).map((hex, i) => (
                            <div key={i} className="group relative">
                                <div
                                    className="w-10 h-10 rounded-full border border-neutral-100 shadow-sm cursor-help hover:scale-110 transition-transform"
                                    style={{ backgroundColor: hex }}
                                />
                                <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                    {hex}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>


            {/* Footer Actions */}
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center">
                <button onClick={onReset} className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-all font-bold shadow-sm">
                    <RefreshCw className="w-5 h-5" />
                    Try Another Photo
                </button>
                <button className="w-full md:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-2xl bg-black text-white hover:bg-neutral-800 transition-all font-bold shadow-xl shadow-black/10 transform hover:-translate-y-1">
                    <Share2 className="w-5 h-5" />
                    Share Results
                </button>
            </div>

            <p className="text-center text-neutral-400 text-xs mt-12 max-w-md mx-auto">
                *AI analysis is an estimation based on lighting and skin detection. For 100% accuracy, consult a professional color draping analyst.
            </p>

        </div>
    );
}
