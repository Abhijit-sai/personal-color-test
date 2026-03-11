import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, ArrowRight, Trash2, ExternalLink } from 'lucide-react';

interface HistoryItem {
    id: string;
    created_at: string;
    image_url: string;
    season: {
        season12: string;
        season4: string;
    };
    skin: {
        hex_actual: string;
    };
}

interface HistoryViewProps {
    items: HistoryItem[];
    onSelectItem: (item: any) => void;
    onNewAnalysis: () => void;
}

export default function HistoryView({ items, onSelectItem, onNewAnalysis }: HistoryViewProps) {
    return (
        <div className="w-full max-w-6xl mx-auto px-6 py-12">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                <div className="space-y-2">
                    <h2 className="text-4xl md:text-5xl font-serif text-white leading-tight">
                        Your <span className="italic opacity-80 decoration-primary-light/30 underline">Fashion</span> <br />
                        <span className="font-sans font-black tracking-tighter uppercase text-3xl md:text-5xl bg-clip-text text-transparent bg-gradient-to-t from-white/40 to-white">Timeline</span>
                    </h2>
                    <p className="text-neutral-500 text-sm max-w-md">
                        Browse through your previous color analyses and track your style journey.
                    </p>
                </div>

                <button
                    onClick={onNewAnalysis}
                    className="px-8 py-4 bg-primary text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 whitespace-nowrap"
                >
                    + New Analysis
                </button>
            </div>

            {items.length === 0 ? (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-20 text-center space-y-6">
                    <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-10 h-10 text-primary/50" />
                    </div>
                    <p className="text-white/60 font-medium">No analyses yet. Start your first one to see it here!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {items.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2rem] overflow-hidden hover:border-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer"
                            onClick={() => onSelectItem(item)}
                        >
                            {/* Card Image Wrapper */}
                            <div className="aspect-[4/3] relative overflow-hidden">
                                <img
                                    src={item.image_url || "/placeholder.jpg"}
                                    alt={item.season.season12}
                                    className="w-full h-full object-cover grayscale-[20%] group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                                {/* Season Tag */}
                                <div className="absolute bottom-4 left-4 flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">
                                        Result
                                    </span>
                                    <span className="text-white font-serif text-xl">
                                        {item.season.season12}
                                    </span>
                                </div>

                                {/* Confidence Score (if available) - simplified as season4 for now */}
                                <div className="absolute top-4 right-4 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full border border-white/10 text-[10px] font-bold text-white/90">
                                    {item.season.season4}
                                </div>
                            </div>

                            {/* Content Under Image */}
                            <div className="p-6 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-4 h-4 rounded-full border border-white/20 shadow-sm"
                                            style={{ backgroundColor: item.skin.hex_actual }}
                                        />
                                        <span className="text-[10px] font-mono text-white/40 uppercase">{item.skin.hex_actual}</span>
                                    </div>
                                    <span className="text-[10px] text-white/40 flex items-center gap-1.5 uppercase tracking-widest font-bold">
                                        <Calendar className="w-3 h-3" />
                                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>

                                <div className="pt-2 border-t border-white/5 flex items-center justify-between group-hover:text-primary-light transition-colors">
                                    <span className="text-[10px] font-black uppercase tracking-widest">View Report</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
}
