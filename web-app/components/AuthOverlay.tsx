"use client";

import { SignIn } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";

interface AuthOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuthOverlay({ isOpen, onClose }: AuthOverlayProps) {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
                    >
                        {/* Design Elements */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary-light/10 rounded-full -ml-16 -mb-16 blur-3xl" />

                        <div className="relative p-6 flex flex-col items-center">
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-6 right-6 p-2 rounded-full hover:bg-neutral-100 text-neutral-400 transition-colors z-10"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Icon Container */}
                            <div className="w-12 h-12 bg-neutral-50 rounded-xl flex items-center justify-center mb-6 shadow-inner border border-neutral-100">
                                <Sparkles className="w-6 h-6 text-primary" />
                            </div>

                            <div className="w-full clerk-auth-container">
                                <SignIn
                                    routing="hash"
                                    appearance={{
                                        elements: {
                                            rootBox: "w-full",
                                            card: "shadow-none p-0 w-full bg-transparent",
                                            headerTitle: "text-2xl font-serif text-neutral-900",
                                            headerSubtitle: "text-neutral-500 text-sm",
                                            socialButtonsBlockButton: "rounded-2xl border-neutral-100 hover:bg-neutral-50 font-bold",
                                            formButtonPrimary: "bg-black hover:bg-neutral-800 rounded-2xl py-4 font-black uppercase text-xs tracking-[0.2em] shadow-xl",
                                            formFieldInput: "rounded-2xl bg-neutral-50 border-neutral-100 focus:border-primary focus:ring-primary/20",
                                            footerActionLink: "text-primary hover:text-primary-dark font-bold",
                                            identityPreviewText: "text-neutral-900 font-bold",
                                            identityPreviewEditButtonIcon: "text-primary"
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
