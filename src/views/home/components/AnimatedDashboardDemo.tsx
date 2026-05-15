'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Heart, Users, Zap, ArrowUpRight, Globe, Smartphone } from 'lucide-react';
import Image from 'next/image';

interface FloatingFeature {
  icon: React.ReactNode;
  title: string;
  value: string;
  description?: string;
  color: string;
  position: string;
  delay: number;
  size: 'small' | 'large';
}

const isLightTheme = (color: string) => color.includes('white') || color.includes('F7F6F2');

const floatingFeatures: FloatingFeature[] = [
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Gift Aid',
    value: '+25% Boost',
    description: 'Automatic tax reclaim for UK donors',
    color: 'from-[#1a2332] to-[#1a2332]',
    position: 'top-8 -right-4',
    delay: 0,
    size: 'large',
  },
  {
    icon: <Globe className="w-4 h-4" />,
    title: 'Multi-channel',
    value: 'Online, QR & Contactless',
    color: 'from-[#1a2332] to-[#1a2332]',
    position: 'bottom-8 -left-4',
    delay: 1000,
    size: 'small',
  },
  {
    icon: <Smartphone className="w-5 h-5" />,
    title: 'MOBILE READY',
    value: 'Any Device',
    description: 'Any device. Zero hardware.',
    color: 'from-[#1a2332] to-[#1a2332]',
    position: 'top-1/2 -right-12',
    delay: 2000,
    size: 'large',
  },
];

export function AnimatedDashboardDemo() {
  const [totalRaised, setTotalRaised] = useState(2847);
  const [campaigns] = useState(12);
  const [donations, setDonations] = useState(382);
  const [giftAid, setGiftAid] = useState(711);
  const [activeMetric, setActiveMetric] = useState(0);
  const [visibleFeatures, setVisibleFeatures] = useState<number[]>([]);

  // Animate numbers
  useEffect(() => {
    const interval = setInterval(() => {
      setTotalRaised((prev) => prev + Math.random() * 5);
      setDonations((prev) => prev + (Math.random() > 0.7 ? 1 : 0));
      setGiftAid((prev) => prev + Math.random() * 0.5);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Cycle through metrics
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMetric((prev) => (prev + 1) % 4);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Animate floating features appearing one by one
  useEffect(() => {
    floatingFeatures.forEach((feature, index) => {
      setTimeout(() => {
        setVisibleFeatures((prev) => [...prev, index]);
      }, feature.delay);
    });
  }, []);

  return (
    <div className="relative">
      {/* Floating Feature Boxes - Hidden on mobile, visible on md+ */}
      <div className="hidden md:block">
        {floatingFeatures.map((feature, index) => (
          <div key={index}>
            {/* Connecting Arrow Line */}
            <svg
              className={`absolute z-0 pointer-events-none transition-opacity duration-700 ${
                visibleFeatures.includes(index) ? 'opacity-100' : 'opacity-0'
              }`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                overflow: 'visible',
              }}
            >
              <defs>
                <marker
                  id={`arrowhead-${index}`}
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill={`url(#gradient-${index})`} opacity="0.6" />
                </marker>
                <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#064e3b" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#0f5132" stopOpacity="0.7" />
                </linearGradient>
              </defs>
              {/* Arrow path - different for each position */}
              {feature.position.includes('top-8 -right') && (
                <path
                  d="M 420 100 Q 480 80, 520 100"
                  stroke={`url(#gradient-${index})`}
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="5,5"
                  markerEnd={`url(#arrowhead-${index})`}
                  className="animate-dash"
                />
              )}
              {feature.position.includes('bottom-8 -left') && (
                <path
                  d="M 80 430 Q 20 440, -20 420"
                  stroke={`url(#gradient-${index})`}
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="5,5"
                  markerEnd={`url(#arrowhead-${index})`}
                  className="animate-dash"
                />
              )}
              {feature.position.includes('top-1/2 -right') && (
                <path
                  d="M 420 240 Q 480 240, 540 240"
                  stroke={`url(#gradient-${index})`}
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="5,5"
                  markerEnd={`url(#arrowhead-${index})`}
                  className="animate-dash"
                />
              )}
            </svg>

            {/* Feature Box */}
            <div
              className={`absolute ${feature.position} z-10 transition-all duration-700 ${
                visibleFeatures.includes(index)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4'
              }`}
            >
              {feature.size === 'large' ? (
                // Large Box with Description
                <div
                  className={`bg-gradient-to-br ${feature.color} rounded-2xl p-5 shadow-2xl backdrop-blur-sm ${
                    isLightTheme(feature.color)
                      ? 'border-2 border-[#064e3b]/20'
                      : 'border border-white/20'
                  } min-w-[180px] max-w-[200px] hover:scale-105 transition-transform duration-300`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <div
                      className={`rounded-xl p-2 backdrop-blur-sm ${
                        isLightTheme(feature.color) ? 'bg-[#064e3b]/10' : 'bg-white/20'
                      }`}
                    >
                      <div
                        className={isLightTheme(feature.color) ? 'text-[#064e3b]' : 'text-white'}
                      >
                        {feature.icon}
                      </div>
                    </div>
                    <div
                      className={`flex-1 ${isLightTheme(feature.color) ? 'text-[#064e3b]' : 'text-white'}`}
                    >
                      <div className="text-[10px] font-semibold opacity-90 uppercase tracking-wide">
                        {feature.title}
                      </div>
                      <div className="text-sm font-bold mt-0.5">{feature.value}</div>
                    </div>
                  </div>
                  {feature.description && (
                    <div
                      className={`text-[9px] leading-relaxed mt-2 border-t pt-2 ${
                        isLightTheme(feature.color)
                          ? 'text-[#064e3b]/70 border-[#064e3b]/20'
                          : 'text-white/80 border-white/20'
                      }`}
                    >
                      {feature.description}
                    </div>
                  )}
                </div>
              ) : (
                // Small Compact Box
                <div
                  className={`bg-gradient-to-br ${feature.color} rounded-2xl p-4 shadow-2xl backdrop-blur-sm ${
                    isLightTheme(feature.color)
                      ? 'border-2 border-[#064e3b]/20'
                      : 'border border-white/20'
                  } min-w-[140px] hover:scale-105 transition-transform duration-300`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`rounded-lg p-1.5 backdrop-blur-sm ${
                        isLightTheme(feature.color) ? 'bg-[#064e3b]/10' : 'bg-white/20'
                      }`}
                    >
                      <div
                        className={isLightTheme(feature.color) ? 'text-[#064e3b]' : 'text-white'}
                      >
                        {feature.icon}
                      </div>
                    </div>
                    <div className={isLightTheme(feature.color) ? 'text-[#064e3b]' : 'text-white'}>
                      <div className="text-[9px] font-semibold opacity-90">{feature.title}</div>
                      <div className="text-xs font-bold">{feature.value}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="absolute -top-20 -right-20 w-80 h-80 bg-[#064e3b]/5 rounded-full blur-3xl"></div>
      <div className="relative glass-card border border-white p-3 sm:p-4 md:p-6 rounded-2xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden">
        <div className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-inner border border-slate-100">
          {/* Mac Window Header */}
          <div className="h-8 sm:h-10 bg-slate-50 border-b flex items-center px-3 sm:px-4 gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400"></div>
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-400"></div>
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-400"></div>
          </div>

          {/* Mini Dashboard Content */}
          <div className="flex h-[350px] sm:h-[400px] md:h-[480px]">
            {/* Sidebar - Hidden on mobile */}
            <div className="hidden sm:block w-28 md:w-40 bg-[#064e3b] p-2 md:p-4 flex flex-col">
              <div className="mb-4 md:mb-6">
                <div className="flex items-center gap-1.5 md:gap-2 mb-1">
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={16}
                    height={16}
                    className="md:w-5 md:h-5 rounded"
                  />
                  <div className="text-white text-[9px] md:text-xs font-bold">SwiftCause</div>
                </div>
                <div className="text-[7px] md:text-[8px] text-white/60">Admin Portal</div>
              </div>

              <div className="space-y-0.5 md:space-y-1 flex-1">
                <div className="px-1.5 md:px-2 py-1 md:py-1.5 bg-white/10 rounded text-white text-[8px] md:text-[10px] font-medium">
                  Dashboard
                </div>
                <div className="px-1.5 md:px-2 py-1 md:py-1.5 text-white/60 text-[8px] md:text-[10px] font-medium">
                  Campaigns
                </div>
                <div className="px-1.5 md:px-2 py-1 md:py-1.5 text-white/60 text-[8px] md:text-[10px] font-medium">
                  Donations
                </div>
                <div className="px-1.5 md:px-2 py-1 md:py-1.5 text-white/60 text-[8px] md:text-[10px] font-medium">
                  Kiosks
                </div>
                <div className="px-1.5 md:px-2 py-1 md:py-1.5 text-white/60 text-[8px] md:text-[10px] font-medium">
                  Users
                </div>
                <div className="px-1.5 md:px-2 py-1 md:py-1.5 text-white/60 text-[8px] md:text-[10px] font-medium">
                  Gift Aid
                </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-[#F7F6F2] p-2 sm:p-3 md:p-4 overflow-hidden">
              <div className="mb-2 md:mb-3">
                <h3 className="text-xs sm:text-sm font-bold text-[#064e3b]">Dashboard</h3>
                <p className="text-[7px] sm:text-[8px] text-slate-500">
                  Real-time view of fundraising activity
                </p>
              </div>

              {/* Animated Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-2 mb-2 md:mb-3">
                <div
                  className={`bg-white rounded-lg p-1.5 md:p-2 border transition-all duration-300 ${
                    activeMetric === 0
                      ? 'border-emerald-500 shadow-lg scale-105'
                      : 'border-slate-100'
                  }`}
                >
                  <div className="text-[7px] sm:text-[8px] text-slate-500 mb-0.5 md:mb-1 flex items-center justify-between">
                    <span>TOTAL RAISED</span>
                    {activeMetric === 0 && (
                      <ArrowUpRight className="w-1.5 h-1.5 md:w-2 md:h-2 text-emerald-600 animate-bounce" />
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-[#064e3b]">
                    £{totalRaised.toFixed(2)}
                  </div>
                  {activeMetric === 0 && (
                    <div className="text-[6px] sm:text-[7px] text-emerald-600 mt-0.5 md:mt-1">
                      +12.5% today
                    </div>
                  )}
                </div>

                <div
                  className={`bg-white rounded-lg p-1.5 md:p-2 border transition-all duration-300 ${
                    activeMetric === 1 ? 'border-blue-500 shadow-lg scale-105' : 'border-slate-100'
                  }`}
                >
                  <div className="text-[7px] sm:text-[8px] text-slate-500 mb-0.5 md:mb-1 flex items-center justify-between">
                    <span>CAMPAIGNS</span>
                    {activeMetric === 1 && (
                      <Heart className="w-1.5 h-1.5 md:w-2 md:h-2 text-blue-600 animate-pulse" />
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-[#064e3b]">{campaigns}</div>
                  {activeMetric === 1 && (
                    <div className="text-[6px] sm:text-[7px] text-blue-600 mt-0.5 md:mt-1">
                      4 active
                    </div>
                  )}
                </div>

                <div
                  className={`bg-white rounded-lg p-1.5 md:p-2 border transition-all duration-300 ${
                    activeMetric === 2
                      ? 'border-purple-500 shadow-lg scale-105'
                      : 'border-slate-100'
                  }`}
                >
                  <div className="text-[7px] sm:text-[8px] text-slate-500 mb-0.5 md:mb-1 flex items-center justify-between">
                    <span>DONATIONS</span>
                    {activeMetric === 2 && (
                      <Users className="w-1.5 h-1.5 md:w-2 md:h-2 text-purple-600 animate-pulse" />
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-[#064e3b]">{donations}</div>
                  {activeMetric === 2 && (
                    <div className="text-[6px] sm:text-[7px] text-purple-600 mt-0.5 md:mt-1">
                      3 this hour
                    </div>
                  )}
                </div>

                <div
                  className={`bg-white rounded-lg p-1.5 md:p-2 border transition-all duration-300 ${
                    activeMetric === 3 ? 'border-amber-500 shadow-lg scale-105' : 'border-slate-100'
                  }`}
                >
                  <div className="text-[7px] sm:text-[8px] text-slate-500 mb-0.5 md:mb-1 flex items-center justify-between">
                    <span>GIFT AID</span>
                    {activeMetric === 3 && (
                      <Zap className="w-1.5 h-1.5 md:w-2 md:h-2 text-amber-600 animate-bounce" />
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-[#064e3b]">
                    £{giftAid.toFixed(2)}
                  </div>
                  {activeMetric === 3 && (
                    <div className="text-[6px] sm:text-[7px] text-amber-600 mt-0.5 md:mt-1">
                      +25% boost
                    </div>
                  )}
                </div>
              </div>

              {/* Revenue Chart with Animation */}
              <div className="bg-white rounded-lg p-2 md:p-3 border border-slate-100 mb-2 md:mb-3">
                <div className="flex items-center gap-1 mb-1 md:mb-2">
                  <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3 text-emerald-600" />
                  <h4 className="text-[8px] md:text-[10px] font-bold text-[#064e3b]">
                    Revenue Growth
                  </h4>
                  <div className="ml-auto">
                    <span className="text-[7px] md:text-[8px] text-emerald-600 font-semibold">
                      ↑ 24.3%
                    </span>
                  </div>
                </div>
                <p className="text-[6px] md:text-[7px] text-slate-500 mb-2 md:mb-3">
                  Monthly revenue trends including Gift Aid uplift
                </p>

                {/* Animated Line Chart */}
                <div className="relative h-16 sm:h-20 md:h-24 pl-6 md:pl-8">
                  <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                    {/* Grid lines */}
                    <line x1="0" y1="25" x2="300" y2="25" stroke="#e2e8f0" strokeWidth="0.5" />
                    <line x1="0" y1="50" x2="300" y2="50" stroke="#e2e8f0" strokeWidth="0.5" />
                    <line x1="0" y1="75" x2="300" y2="75" stroke="#e2e8f0" strokeWidth="0.5" />

                    {/* Revenue line (going up) with gradient */}
                    <defs>
                      <linearGradient id="revenueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#064e3b" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#064e3b" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    {/* Area fill */}
                    <polygon
                      points="0,85 50,72 100,63 150,50 200,38 250,29 300,21 300,100 0,100"
                      fill="url(#revenueGradient)"
                      className="animate-pulse"
                      style={{ animationDuration: '3s' }}
                    />

                    {/* Revenue line */}
                    <polyline
                      points="0,85 50,72 100,63 150,50 200,38 250,29 300,21"
                      fill="none"
                      stroke="#064e3b"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Animated dots on line */}
                    <circle cx="300" cy="21" r="3" fill="#064e3b" className="animate-pulse" />
                    <circle cx="250" cy="29" r="2" fill="#064e3b" opacity="0.6" />
                    <circle cx="200" cy="38" r="2" fill="#064e3b" opacity="0.4" />

                    {/* Donations line (dashed, going up) */}
                    <polyline
                      points="0,90 50,78 100,69 150,57 200,43 250,35 300,27"
                      fill="none"
                      stroke="#0f5132"
                      strokeWidth="1.5"
                      strokeDasharray="3,3"
                    />
                  </svg>

                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[6px] md:text-[7px] text-slate-400">
                    <span>£50</span>
                    <span>£40</span>
                    <span>£30</span>
                    <span>£20</span>
                  </div>

                  {/* X-axis labels */}
                  <div className="absolute bottom-0 left-6 md:left-8 right-0 flex justify-between text-[6px] md:text-[7px] text-slate-400 -mb-3 md:-mb-4">
                    <span>Dec</span>
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                  </div>
                </div>

                {/* Legend */}
                <div className="flex gap-2 md:gap-3 mt-4 md:mt-5 justify-center">
                  <div className="flex items-center gap-1">
                    <div className="w-2 md:w-3 h-0.5 bg-[#0f5132]"></div>
                    <span className="text-[6px] md:text-[7px] text-slate-600">Donations</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 md:w-3 h-0.5 bg-[#064e3b]"></div>
                    <span className="text-[6px] md:text-[7px] text-slate-600">Total Revenue</span>
                  </div>
                </div>
              </div>

              {/* Bottom Row: Activity Heatmap & Pie Chart */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                {/* Activity Heatmap with Animation */}
                <div className="bg-white rounded-lg p-2 md:p-3 border border-slate-100">
                  <h4 className="text-[8px] md:text-[10px] font-bold text-[#064e3b] mb-1.5 md:mb-2">
                    Activity Heatmap
                  </h4>
                  <div className="space-y-0.5 md:space-y-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                      <div key={day} className="flex items-center gap-0.5 md:gap-1">
                        <span className="text-[6px] md:text-[7px] text-slate-500 w-5 md:w-6">
                          {day}
                        </span>
                        <div className="flex gap-0.5 flex-1">
                          {Array.from({ length: 12 }).map((_, j) => {
                            const intensity = Math.random();
                            const bgColor =
                              intensity > 0.7
                                ? 'bg-emerald-600'
                                : intensity > 0.5
                                  ? 'bg-emerald-400'
                                  : intensity > 0.3
                                    ? 'bg-emerald-200'
                                    : 'bg-slate-100';
                            return (
                              <div
                                key={j}
                                className={`h-1.5 md:h-2 flex-1 rounded-sm ${bgColor} transition-all duration-500`}
                                style={{
                                  animationDelay: `${(i * 12 + j) * 50}ms`,
                                  animation: 'fadeIn 0.5s ease-in-out',
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-1.5 md:mt-2 text-[5px] md:text-[6px] text-slate-400">
                    <span>Less</span>
                    <div className="flex gap-0.5">
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-slate-100 rounded-sm"></div>
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-200 rounded-sm"></div>
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-400 rounded-sm"></div>
                      <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-600 rounded-sm"></div>
                    </div>
                    <span>More</span>
                  </div>
                </div>

                {/* Animated Pie Chart */}
                <div className="bg-white rounded-lg p-2 md:p-3 border border-slate-100">
                  <h4 className="text-[8px] md:text-[10px] font-bold text-[#064e3b] mb-1.5 md:mb-2">
                    Donation Sources
                  </h4>
                  <div className="flex items-center justify-center h-16 sm:h-20 md:h-24">
                    <svg width="60" height="60" viewBox="0 0 100 100" className="sm:w-20 sm:h-20">
                      {/* Online - 60% */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#10b981"
                        strokeWidth="20"
                        strokeDasharray="150.8 251.2"
                        transform="rotate(-90 50 50)"
                        className="transition-all duration-1000"
                      />
                      {/* Kiosk - 30% */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#3b82f6"
                        strokeWidth="20"
                        strokeDasharray="75.4 326.6"
                        strokeDashoffset="-150.8"
                        transform="rotate(-90 50 50)"
                        className="transition-all duration-1000"
                      />
                      {/* Events - 10% */}
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="transparent"
                        stroke="#a855f7"
                        strokeWidth="20"
                        strokeDasharray="25.1 376.9"
                        strokeDashoffset="-226.2"
                        transform="rotate(-90 50 50)"
                        className="transition-all duration-1000"
                      />
                    </svg>
                  </div>
                  <div className="space-y-0.5 md:space-y-1 mt-1.5 md:mt-2">
                    <div className="flex items-center justify-between text-[6px] md:text-[7px]">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        <span className="text-slate-600">Online</span>
                      </div>
                      <span className="font-bold text-slate-700">60%</span>
                    </div>
                    <div className="flex items-center justify-between text-[6px] md:text-[7px]">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-slate-600">Kiosk</span>
                      </div>
                      <span className="font-bold text-slate-700">30%</span>
                    </div>
                    <div className="flex items-center justify-between text-[6px] md:text-[7px]">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-purple-500 rounded-full"></div>
                        <span className="text-slate-600">Events</span>
                      </div>
                      <span className="font-bold text-slate-700">10%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
