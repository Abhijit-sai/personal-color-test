import { motion } from "framer-motion";

interface SeasonOrbitProps {
    image: string;
    bestColors: string[];
    neutrals: string[];
    season: string;
}

export default function SeasonOrbit({ image, bestColors, neutrals, season }: SeasonOrbitProps) {
    // We'll limit the number of dots to keep it clean
    const ring1 = bestColors.slice(0, 12);
    const ring2 = neutrals.slice(0, 8);

    return (
        <div className="relative w-full aspect-square max-w-[500px] mx-auto flex items-center justify-center my-10">

            {/* Orbits Background to give structure */}
            <div className="absolute inset-0 rounded-full border border-neutral-100/50 scale-[1.0]" />
            <div className="absolute inset-0 rounded-full border border-neutral-100/50 scale-[0.7]" />

            {/* Center Image */}
            <div className="relative z-20 w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white shadow-2xl ring-4 ring-neutral-50">
                <img src={image} alt="User" className="w-full h-full object-cover" />
            </div>

            {/* Ring 1: Best Colors (Inner Orbit) */}
            <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 z-10"
            >
                {ring1.map((color, i) => {
                    const angle = (i / ring1.length) * 360;
                    const radius = "35%"; // Distance from center
                    return (
                        <div
                            key={i}
                            className="absolute w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform"
                            style={{
                                backgroundColor: color,
                                top: `50%`,
                                left: `50%`,
                                transform: `rotate(${angle}deg) translate(clamp(110px, 20vw, 160px)) rotate(-${angle}deg)`
                            }}
                            title={color}
                        />
                    );
                })}
            </motion.div>

            {/* Ring 2: Neutrals (Outer Orbit) */}
            <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 z-0"
            >
                {ring2.map((color, i) => {
                    const angle = (i / ring2.length) * 360;
                    return (
                        <div
                            key={i}
                            className="absolute w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-white shadow-sm transform -translate-x-1/2 -translate-y-1/2"
                            style={{
                                backgroundColor: color,
                                top: `50%`,
                                left: `50%`,
                                transform: `rotate(${angle}deg) translate(clamp(150px, 28vw, 220px)) rotate(-${angle}deg)`
                            }}
                            title={color}
                        />
                    );
                })}
            </motion.div>

            {/* Season Label Floating */}
            <div className="absolute -bottom-12 md:-bottom-16 left-1/2 -translate-x-1/2 text-center bg-white/80 backdrop-blur-md px-6 py-2 rounded-full border border-neutral-200 shadow-sm">
                <span className="text-xs uppercase tracking-widest text-neutral-400">Your Season</span>
                <h2 className="text-xl font-heading font-bold text-foreground whitespace-nowrap">{season}</h2>
            </div>

        </div>
    );
}
