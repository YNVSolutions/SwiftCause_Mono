'use client';

import { ArrowRight } from 'lucide-react';
import { AnimatedDashboardDemo } from './AnimatedDashboardDemo';

interface HeroSectionProps {
  onSignup: () => void;
}

export function HeroSection({ onSignup }: HeroSectionProps) {
  return (
    <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-4 sm:px-6 overflow-hidden">
      <div className="container mx-auto grid md:grid-cols-2 gap-8 md:gap-12 items-center">
        {/* Left Content */}
        <div className="space-y-6 md:space-y-8 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#064e3b]/10 text-[#064e3b] rounded-full text-xs sm:text-sm font-semibold border border-[#064e3b]/20">
            <span className="flex h-2 w-2 rounded-full bg-[#064e3b] animate-pulse"></span>
            Designed for UK Charities
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#1a2332] leading-[1.1] tracking-tight">
            Turn any device into a donation point.
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed max-w-lg">
            Accept contactless donations from any smartphone, tablet, or browser. Gift Aid captured
            automatically. Start free in 60 seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
            <button
              onClick={onSignup}
              className="px-6 sm:px-8 py-3 sm:py-4 bg-[#f57c00] text-white font-bold rounded-2xl shadow-xl hover:bg-[#e65100] transition-all flex items-center justify-center gap-2 group text-sm sm:text-base"
            >
              Start Free Today
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <span className="text-sm text-slate-500">No credit card required</span>
          </div>
        </div>

        {/* Right Content - Animated Dashboard */}
        <div className="relative mt-8 md:mt-0">
          <AnimatedDashboardDemo />
        </div>
      </div>
    </section>
  );
}
