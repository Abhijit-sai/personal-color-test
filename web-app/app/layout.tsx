import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display, Inter } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Personal Color AI — Find Your Best Colors with AI Seasonal Color Analysis",
  description: "Discover your seasonal color type in under 2 minutes. Our AI analyzes your skin undertone, depth, and contrast to find the colors that make you glow. Free to start — no appointments, no draping.",
  keywords: ["personal color analysis", "seasonal color analysis", "skin undertone", "color season", "AI color analysis", "best colors for skin tone", "12 season color analysis"],
  openGraph: {
    title: "Personal Color AI — Find Your Best Colors with AI Seasonal Color Analysis",
    description: "Discover the colors that make you glow. AI-powered seasonal color analysis in under 2 minutes.",
    type: "website",
    siteName: "Personal Color AI",
  },
  twitter: {
    card: "summary_large_image",
    title: "Personal Color AI — Find Your Best Colors",
    description: "AI-powered seasonal color analysis. Find your undertone, your season, and your perfect palette in 2 minutes.",
  },
};

import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${inter.variable} antialiased font-sans`}
        >
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
