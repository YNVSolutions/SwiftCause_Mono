'use client';

import React from 'react';
import { Heart, Terminal, Zap, PieChart } from 'lucide-react';

export function FeaturesSection() {
  const features: { title: string; description: string; icon: React.ReactNode; iconBg?: string }[] =
    [
      {
        title: 'Campaign Management',
        description:
          'Launch fundraisers for specific causes with stories, goals, and real-time impact metrics.',
        icon: <Heart className="w-5 h-5 sm:w-6 sm:h-6" />,
      },
      {
        title: 'In-Person Collection',
        description:
          'Turn any tablet or phone into a secure donation point — no specialist hardware needed.',
        icon: <Terminal className="w-5 h-5 sm:w-6 sm:h-6" />,
      },
      {
        title: 'Gift Aid & GASDS',
        description:
          'Boost donations by 25% with automatic Gift Aid. Plus claim up to £8,000/year in GASDS matching — no donor details needed.',
        icon: <Zap className="w-5 h-5 sm:w-6 sm:h-6" />,
        iconBg: '#fff3e0',
      },
      {
        title: 'Real-time Analytics',
        description:
          'Gain instant visibility into fundraising performance across all digital and physical channels.',
        icon: <PieChart className="w-5 h-5 sm:w-6 sm:h-6" />,
      },
    ];

  return (
    <section id="features" className="py-16 sm:py-20 md:py-24 bg-white px-4 sm:px-6">
      <div className="container mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16 md:mb-20 space-y-3 sm:space-y-4">
          <h2 className="text-xs sm:text-sm font-bold text-[#0f5132] uppercase tracking-[0.2em]">
            Our Platform
          </h2>
          <p className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#064e3b] tracking-tight px-4">
            Everything you need to grow your impact.
          </p>
          <p className="text-base sm:text-lg text-slate-600 px-4">
            We handle the technical complexity so you can focus on what matters: your mission.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="p-6 sm:p-8 rounded-[2rem] bg-[#F7F6F2] border border-transparent hover:border-[#064e3b]/10 hover:shadow-xl transition-all group"
            >
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-[#064e3b] shadow-sm mb-4 sm:mb-6 group-hover:bg-[#064e3b] group-hover:text-white transition-all duration-300"
                style={{ backgroundColor: feature.iconBg ?? '#ffffff' }}
              >
                {feature.icon}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#064e3b] mb-3 sm:mb-4">
                {feature.title}
              </h3>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
