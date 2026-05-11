'use client';

import { useState, useEffect } from 'react';
import {
  Megaphone,
  Smartphone,
  BadgePercent,
  BarChart2,
  ArrowRight,
  Menu,
  X,
  PenTool,
  Activity,
  Send,
  Github,
  Linkedin,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import Image from 'next/image';
import { AnimatedDashboardDemo } from './components/AnimatedDashboardDemo';

interface HomePageProps {
  onLogin: () => void;
  onSignup: () => void;
  onNavigate: (screen: string) => void;
}

export function HomePage({ onLogin, onSignup, onNavigate }: HomePageProps) {
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeDemoIndex, setActiveDemoIndex] = useState(0);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Features', href: '#features' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsMenuOpen(false);
    }
  };

  const features = [
    {
      title: 'Campaign Management',
      description:
        'Launch fundraisers for specific causes with stories, goals, and real-time impact metrics.',
      icon: <Megaphone className="w-6 h-6" />,
    },
    {
      title: 'In-Person Collection',
      description:
        'Turn any tablet or phone into a secure donation point. No specialist hardware needed.',
      icon: <Smartphone className="w-6 h-6" />,
    },
    {
      title: 'Gift Aid & GASDS',
      description:
        'Boost donations by 25% with automatic Gift Aid. Plus claim up to £8,000/year in GASDS matching, with no donor details needed.',
      icon: <BadgePercent className="w-6 h-6" />,
    },
    {
      title: 'Real-time Analytics',
      description:
        'Gain instant visibility into fundraising performance across all digital and physical channels.',
      icon: <BarChart2 className="w-6 h-6" />,
    },
  ];

  const faqs = [
    {
      question: 'What is SwiftCause?',
      answer:
        'SwiftCause is a fundraising platform built for UK charities to accept donations online and in person, manage multiple campaigns, and track fundraising performance from one central dashboard.',
    },
    {
      question: 'How much does it cost?',
      answer:
        'SwiftCause has a free tier with no monthly fee. Just 5p per donation plus Stripe processing. Paid plans start at £9/month for charities that need more campaigns and features.',
    },
    {
      question: 'How does Gift Aid work on SwiftCause?',
      answer:
        'When a UK taxpayer donates, we capture their Gift Aid declaration automatically. No paper forms. We generate HMRC-ready R68 reports so your treasurer can claim the 25% boost without manual data entry.',
    },
    {
      question: 'What is GASDS and how do I benefit?',
      answer:
        'The Gift Aid Small Donations Scheme lets eligible charities claim 25% top-up on contactless donations up to £30, without needing a Gift Aid declaration. SwiftCause tracks GASDS-eligible donations automatically, worth up to £8,000/year.',
    },
    {
      question: 'Do donors need to create an account?',
      answer:
        'No. Donors can give instantly by tapping a link, scanning a QR code, or tapping their phone. No app download, no account creation.',
    },
    {
      question: 'Is my data secure?',
      answer:
        'All payments are processed by Stripe, a PCI Level 1 certified payment processor. Donor data is encrypted and stored in UK data centres. We never sell or share donor information.',
    },
    {
      question: 'How quickly can I get started?',
      answer:
        'You can create your first campaign in under 60 seconds. Connect your Stripe account, create a campaign, and start accepting donations the same day. No hardware to order, no training required.',
    },
  ];

  const demoFeatures = [
    {
      title: 'Create Campaigns in Seconds',
      description: 'Build and launch fundraising campaigns instantly.',
      icon: <PenTool className="w-5 h-5" />,
    },
    {
      title: 'Assign to Kiosk',
      description: 'Push any campaign to a physical collection point in one tap.',
      icon: <Smartphone className="w-5 h-5" />,
    },
    {
      title: 'Admin Dashboard',
      description: 'Track performance and manage your organisation in real time.',
      icon: <Activity className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-screen selection:bg-[#0f9d58] selection:text-white">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
        }`}
      >
        <div className="container mx-auto px-6 flex items-center justify-between">
          {/* Logo — always left */}
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 flex-shrink-0"
          >
            <Image
              src="/logo.png"
              alt="SwiftCause Logo"
              width={40}
              height={40}
              className="rounded-xl shadow-lg"
            />
            <span className="text-2xl tracking-tight">
              <span className="font-extrabold text-[#1a2332]">Swift</span>
              <span className="font-bold text-[#0f9d58]">Cause</span>
            </span>
          </button>

          {/* Nav links + auth — all grouped right */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="text-[#1a2332]/70 hover:text-[#1a2332] font-medium transition-colors cursor-pointer"
              >
                {item.label}
              </a>
            ))}
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-[#e5e7eb]">
              <button
                onClick={onLogin}
                className="px-4 py-2 text-[#9ca3af] font-semibold rounded-lg transition-colors"
              >
                Login
              </button>
              <button
                onClick={onSignup}
                className="px-5 py-2 bg-[#f57c00] text-white font-semibold rounded-lg shadow-md hover:bg-[#e65100] transition-all"
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 text-[#1a2332]"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {/* Mobile Menu - Slide from Right */}
        {isMenuOpen && (
          <>
            {/* Backdrop with blur */}
            <div
              className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-fade-in"
              onClick={() => setIsMenuOpen(false)}
            />

            {/* Sidebar Menu */}
            <div className="md:hidden fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#e5e7eb]">
                <div className="flex items-center gap-2">
                  <Image
                    src="/logo.png"
                    alt="SwiftCause Logo"
                    width={32}
                    height={32}
                    className="rounded-xl shadow-lg"
                  />
                  <span className="text-xl tracking-tight">
                    <span className="font-extrabold text-[#1a2332]">Swift</span>
                    <span className="font-bold text-[#0f9d58]">Cause</span>
                  </span>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 hover:bg-[#f9fafb] rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-[#1a2332]" />
                </button>
              </div>

              {/* Navigation Links */}
              <div className="flex-1 overflow-y-auto p-6">
                <nav className="flex flex-col gap-2">
                  {navItems.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={(e) => handleNavClick(e, item.href)}
                      className="text-lg font-medium text-[#1a2332] hover:bg-[#f9fafb] px-4 py-3 rounded-xl transition-colors cursor-pointer"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-[#e5e7eb] space-y-3">
                <button
                  onClick={onLogin}
                  className="w-full py-3 text-[#9ca3af] font-semibold border-2 border-[#e5e7eb] rounded-xl transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={onSignup}
                  className="w-full py-3 bg-[#f57c00] text-white font-semibold rounded-xl shadow-lg hover:bg-[#e65100] transition-colors"
                >
                  Sign Up Free
                </button>
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Hero Section */}
      <main className="animate-fade-in">
        <section className="pt-24 pb-16 md:pt-32 md:pb-24 px-6 overflow-hidden">
          <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 flex flex-col items-center text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#e8f5e9] text-[#0f9d58] rounded-full text-sm font-semibold border border-[#0f9d58]/20">
                <span className="flex h-2 w-2 rounded-full bg-[#0f9d58] animate-pulse"></span>
                Designed for UK Charities
              </div>

              <h1 className="text-5xl md:text-6xl font-bold text-[#1a2332] leading-[1.1] tracking-tight">
                Turn any device into a donation point.
              </h1>

              <p className="text-lg text-slate-600 leading-relaxed max-w-lg">
                Accept contactless donations from any smartphone, tablet, or browser. Gift Aid
                captured automatically. Start free in 60 seconds.
              </p>

              <div className="flex flex-col items-center gap-2">
                <button
                  onClick={onSignup}
                  className="px-8 py-4 bg-[#f57c00] text-white font-bold rounded-2xl shadow-xl hover:bg-[#e65100] transition-all flex items-center justify-center gap-2 group"
                >
                  Start Free Today
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <span className="text-sm text-slate-500">No credit card required</span>
              </div>
            </div>

            <AnimatedDashboardDemo />
          </div>
        </section>

        {/* Trust strip */}
        <section className="py-14 bg-white px-6">
          <div className="container mx-auto max-w-4xl">
            <p className="text-center text-[10px] font-semibold text-[#9ca3af] uppercase tracking-[0.2em] mb-10">
              Built on infrastructure trusted worldwide
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {/* Stripe wordmark */}
              <svg
                viewBox="0 0 360 151"
                className="h-6 opacity-40 hover:opacity-70 transition-opacity duration-300 cursor-default"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-label="Stripe"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M360 78.2001C360 52.6001 347.6 32.4001 323.9 32.4001C300.1 32.4001 285.7 52.6001 285.7 78.0001C285.7 108.1 302.7 123.3 327.1 123.3C339 123.3 348 120.6 354.8 116.8V96.8001C348 100.2 340.2 102.3 330.3 102.3C320.6 102.3 312 98.9002 310.9 87.1002H359.8C359.8 85.8002 360 80.6002 360 78.2001ZM310.6 68.7001C310.6 57.4002 317.5 52.7001 323.8 52.7001C329.9 52.7001 336.4 57.4002 336.4 68.7001H310.6Z"
                  fill="#061B31"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M247.1 32.4001C237.3 32.4001 231 37.0001 227.5 40.2001L226.2 34.0001H204.2V150.6L229.2 145.3L229.3 117C232.9 119.6 238.2 123.3 247 123.3C264.9 123.3 281.2 108.9 281.2 77.2001C281.1 48.2001 264.6 32.4001 247.1 32.4001ZM241.1 101.3C235.2 101.3 231.7 99.2001 229.3 96.6002L229.2 59.5001C231.8 56.6001 235.4 54.6002 241.1 54.6002C250.2 54.6002 256.5 64.8001 256.5 77.9001C256.5 91.3001 250.3 101.3 241.1 101.3Z"
                  fill="#061B31"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M169.8 26.5L194.9 21.1V0.800049L169.8 6.10005V26.5Z"
                  fill="#061B31"
                />
                <path d="M194.9 34.1001H169.8V121.6H194.9V34.1001Z" fill="#061B31" />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M142.9 41.5001L141.3 34.1001H119.7V121.6H144.7V62.3001C150.6 54.6001 160.6 56.0001 163.7 57.1001V34.1001C160.5 32.9001 148.8 30.7001 142.9 41.5001Z"
                  fill="#061B31"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M92.8999 12.4001L68.4999 17.6001L68.3999 97.7001C68.3999 112.5 79.4999 123.4 94.2999 123.4C102.5 123.4 108.5 121.9 111.8 120.1V99.8001C108.6 101.1 92.7999 105.7 92.7999 90.9001V55.4001H111.8V34.1002H92.7999L92.8999 12.4001Z"
                  fill="#061B31"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M25.3 59.5001C25.3 55.6001 28.5 54.1002 33.8 54.1002C41.4 54.1002 51 56.4001 58.6 60.5001V37.0001C50.3 33.7001 42.1 32.4001 33.8 32.4001C13.5 32.4001 0 43.0001 0 60.7001C0 88.3001 38 83.9001 38 95.8001C38 100.4 34 101.9 28.4 101.9C20.1 101.9 9.5 98.5002 1.1 93.9002V117.7C10.4 121.7 19.8 123.4 28.4 123.4C49.2 123.4 63.5 113.1 63.5 95.2001C63.4 65.4001 25.3 70.7001 25.3 59.5001Z"
                  fill="#061B31"
                />
              </svg>

              {/* HMRC compliant */}
              <div className="flex items-center gap-2 opacity-40 hover:opacity-70 transition-opacity duration-300 cursor-default text-[#1a2332]">
                <svg
                  viewBox="0 0 32 32"
                  className="h-5 w-5 flex-shrink-0"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path d="M16 2a14 14 0 1 0 0 28A14 14 0 0 0 16 2zm0 4a10 10 0 1 1 0 20A10 10 0 0 1 16 6zm-1 4v6H9v2h6v4h2v-4h6v-2h-6v-6h-2z" />
                </svg>
                <span className="text-[13px] font-semibold tracking-tight">HMRC compliant</span>
              </div>

              {/* PCI DSS Level 1 */}
              <div className="flex items-center gap-2 opacity-40 hover:opacity-70 transition-opacity duration-300 cursor-default text-[#1a2332]">
                <Lock className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                <span className="text-[13px] font-semibold tracking-tight">
                  PCI DSS <span className="font-normal">Level 1</span>
                </span>
              </div>

              {/* GDPR Compliant */}
              <div className="flex items-center gap-2 opacity-40 hover:opacity-70 transition-opacity duration-300 cursor-default text-[#1a2332]">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" strokeWidth={2} />
                <span className="text-[13px] font-semibold tracking-tight">GDPR Compliant</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-white px-6">
          <div className="container mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
              <h2 className="text-sm font-bold text-[#0f9d58] uppercase tracking-[0.2em]">
                Our Platform
              </h2>
              <p className="text-4xl md:text-5xl font-bold text-[#1a2332] tracking-tight">
                Everything you need to grow your impact.
              </p>
              <p className="text-lg text-[#4b5563]">
                We handle the technical complexity so you can focus on what matters: your mission.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="p-8 rounded-[2rem] bg-[#f9fafb] border border-[#e5e7eb] hover:shadow-xl transition-all group"
                >
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-[#0f9d58] shadow-sm mb-6 group-hover:bg-[#0f9d58] group-hover:text-white transition-all duration-300"
                    style={{
                      backgroundColor: (feature as { iconBg?: string }).iconBg ?? '#e8f5e9',
                    }}
                  >
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-[#1a2332] mb-4">{feature.title}</h3>
                  <p className="text-[#4b5563] leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-24 bg-white border-t border-[#e5e7eb] px-6">
          <div className="container mx-auto">
            <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
              <p className="text-xs font-bold text-[#0f9d58] uppercase tracking-[0.2em]">
                How It Works
              </p>
              <h2 className="text-4xl md:text-5xl font-bold text-[#1a2332] tracking-tight">
                Live in three steps.
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              {[
                {
                  step: '01',
                  icon: <Megaphone className="w-6 h-6" />,
                  title: 'Create a campaign',
                  body: 'Name it, set a goal, add your story. Takes 60 seconds. No training needed.',
                },
                {
                  step: '02',
                  icon: <Smartphone className="w-6 h-6" />,
                  title: 'Share or tap',
                  body: 'Share a link, show a QR code, or let donors tap their phone. Works on any device your volunteers already own.',
                },
                {
                  step: '03',
                  icon: <BadgePercent className="w-6 h-6" />,
                  title: 'Money + Gift Aid',
                  body: 'Donations go straight to your Stripe account. Gift Aid declarations captured automatically. GASDS tracked from day one.',
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="p-8 rounded-[2rem] bg-[#f9fafb] border border-[#e5e7eb] hover:shadow-xl transition-all group relative overflow-hidden"
                >
                  <span className="absolute top-6 right-7 text-5xl font-black text-[#e5e7eb] leading-none select-none">
                    {s.step}
                  </span>
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-[#0f9d58] bg-[#e8f5e9] shadow-sm mb-6 group-hover:bg-[#0f9d58] group-hover:text-white transition-all duration-300 relative z-10">
                    {s.icon}
                  </div>
                  <h3 className="text-xl font-bold text-[#1a2332] mb-3 relative z-10">{s.title}</h3>
                  <p className="text-[#4b5563] leading-relaxed relative z-10">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo Section */}
        <section id="demo" className="bg-[#F3F1EA] py-24 px-6">
          <div className="container mx-auto">
            <div className="flex flex-col lg:flex-row gap-12 items-stretch">
              {/* Left: Clickable feature list */}
              <div className="lg:w-2/5 flex flex-col justify-center space-y-8">
                <div className="space-y-3">
                  <p className="text-xs font-bold text-[#0f9d58] uppercase tracking-[0.2em]">
                    Simplified Tools
                  </p>
                  <h2 className="text-4xl font-bold text-[#1a2332] leading-tight">
                    Simplified tools for complex goals.
                  </h2>
                </div>
                <div className="space-y-3">
                  {demoFeatures.map((feat, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveDemoIndex(idx)}
                      className={`w-full px-5 py-5 rounded-2xl flex items-center gap-5 text-left transition-all duration-200 border ${
                        activeDemoIndex === idx
                          ? 'bg-white border-[#0f9d58]/30 shadow-md'
                          : 'bg-white/40 border-transparent hover:bg-white/70 hover:border-[#e5e7eb]'
                      }`}
                    >
                      <div
                        className={`w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center transition-colors duration-200 ${activeDemoIndex === idx ? 'text-[#0f9d58]' : 'text-[#9ca3af]'}`}
                        style={{
                          backgroundColor:
                            activeDemoIndex === idx
                              ? ((feat as { iconBg?: string }).iconBg ?? '#e8f5e9')
                              : '#ebe9e1',
                        }}
                      >
                        {feat.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4
                          className={`font-bold transition-colors duration-200 ${activeDemoIndex === idx ? 'text-[#1a2332] text-lg' : 'text-[#4b5563] text-base'}`}
                        >
                          {feat.title}
                        </h4>
                        <p
                          className={`text-sm leading-relaxed mt-1 transition-colors duration-200 ${activeDemoIndex === idx ? 'text-[#4b5563]' : 'text-[#9ca3af]'}`}
                        >
                          {feat.description}
                        </p>
                      </div>
                      <div
                        className={`w-1.5 h-10 rounded-full flex-shrink-0 transition-all duration-200 ${activeDemoIndex === idx ? 'bg-[#0f9d58]' : 'bg-transparent'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Animated demo panels */}
              <div className="hidden lg:flex lg:w-3/5 flex-col">
                <div className="w-full flex-1 flex items-stretch">
                  {/* Panel 0 — Create Campaigns */}
                  {activeDemoIndex === 0 && (
                    <div className="w-full self-stretch bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-fadeIn flex flex-col">
                      {/* Mac-style title bar */}
                      <div className="h-9 bg-slate-50 border-b border-slate-200 flex items-center px-4 gap-2 flex-shrink-0">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                        <span className="ml-2 text-[9px] text-slate-400 uppercase tracking-wider">
                          Edit • Campaign
                        </span>
                      </div>
                      <div className="flex flex-1 min-h-0">
                        {/* Sidebar */}
                        <div className="w-36 bg-gray-50 border-r border-slate-200 p-3 flex flex-col flex-shrink-0">
                          <div className="mb-3">
                            <div className="text-[10px] font-semibold text-slate-700">Campaign</div>
                            <div className="text-[8px] text-slate-400">Configuration</div>
                          </div>
                          <div className="space-y-1">
                            {[
                              { label: 'Basic Info', active: true },
                              { label: 'Details', active: false },
                              { label: 'Media', active: false },
                              { label: 'Distribution', active: false },
                            ].map((item) => (
                              <div
                                key={item.label}
                                className={`px-2.5 py-2 rounded-lg text-[10px] font-medium transition-all ${
                                  item.active
                                    ? 'bg-gradient-to-r from-[#0f9d58] to-[#0d8a4e] text-white shadow-sm'
                                    : 'text-slate-500 hover:bg-slate-100'
                                }`}
                              >
                                {item.label}
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Form content */}
                        <div className="flex-1 flex flex-col min-w-0">
                          <div className="flex-1 p-4 overflow-y-auto space-y-3">
                            <h3 className="text-sm font-bold text-slate-800 mb-3">
                              Basic Information
                            </h3>
                            <div>
                              <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                                Campaign Title
                              </label>
                              <input
                                readOnly
                                value="Bristol Community Kitchen: Warm Meals This Winter"
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                                Brief Overview
                              </label>
                              <textarea
                                readOnly
                                rows={2}
                                value="Help us provide hot meals and warm shelter to those sleeping rough in Bristol this winter."
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 resize-none"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                                  Fundraising Goal
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                                    £
                                  </span>
                                  <input
                                    readOnly
                                    value="5,000"
                                    className="w-full pl-5 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                                  Status
                                </label>
                                <div className="px-3 py-2 border border-slate-200 rounded-lg text-[11px] text-slate-700 bg-white flex items-center justify-between">
                                  <span>Online</span>
                                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-[9px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
                                Campaign Mode
                              </label>
                              <div className="flex gap-2">
                                <div className="px-3 py-1.5 border-2 border-[#0f9d58] bg-[#0f9d58]/5 rounded-lg text-[10px] font-semibold text-[#0f9d58]">
                                  Donation Mode
                                </div>
                                <div className="px-3 py-1.5 border border-slate-200 rounded-lg text-[10px] font-medium text-slate-400">
                                  Activity Mode
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center justify-between py-2.5 px-3 bg-green-50 border border-green-100 rounded-lg">
                              <div>
                                <p className="text-[10px] font-semibold text-slate-700">
                                  Gift Aid Enabled
                                </p>
                                <p className="text-[8px] text-slate-400">
                                  Automatically capture declarations
                                </p>
                              </div>
                              <div className="w-8 h-4 bg-[#0f9d58] rounded-full relative flex-shrink-0">
                                <div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm" />
                              </div>
                            </div>
                          </div>
                          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-end gap-2 flex-shrink-0">
                            <button className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded-lg text-[10px] font-medium">
                              Save Draft
                            </button>
                            <button className="px-3 py-1.5 bg-black text-white rounded-lg text-[10px] font-semibold">
                              Update Campaign
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Panel 1 — Assign to Kiosk */}
                  {activeDemoIndex === 1 && (
                    <div className="w-full self-stretch bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-fadeIn flex flex-col">
                      <div className="h-9 bg-slate-50 border-b border-slate-200 flex items-center px-4 gap-2 flex-shrink-0">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                        <span className="ml-2 text-[9px] text-slate-400 uppercase tracking-wider">
                          Edit • Campaign
                        </span>
                      </div>
                      <div className="flex flex-1 min-h-0">
                        {/* Sidebar matching CampaignForm */}
                        <div className="w-36 bg-gray-50 border-r border-gray-200 p-3 flex flex-col flex-shrink-0">
                          <div className="mb-3">
                            <div className="text-[10px] font-semibold text-gray-700">Campaign</div>
                            <div className="text-[8px] text-gray-400">Configuration</div>
                          </div>
                          <div className="space-y-1">
                            {['Basic Info', 'Details', 'Media', 'Distribution'].map((item, i) => (
                              <div
                                key={item}
                                className={`px-2.5 py-2 rounded-lg text-[10px] font-medium ${i === 3 ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-sm' : 'text-gray-500'}`}
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Main content matching CampaignForm distribution section */}
                        <div className="flex-1 flex flex-col min-w-0">
                          <div className="flex-1 p-4 flex flex-col gap-3 overflow-hidden">
                            <h3 className="text-sm font-bold text-gray-800">Kiosk Distribution</h3>

                            {/* Global Distribution toggle */}
                            <div className="p-3 rounded-lg border border-green-200 bg-green-50 flex items-center justify-between">
                              <div>
                                <p className="text-[11px] font-semibold text-gray-900">
                                  Global Distribution
                                </p>
                                <p className="text-[9px] text-gray-500 mt-0.5">
                                  Campaign is visible on all kiosks
                                </p>
                              </div>
                              <div className="w-8 h-4 bg-green-500 rounded-full relative flex-shrink-0 ml-4">
                                <div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm" />
                              </div>
                            </div>

                            {/* Kiosk Assignment list */}
                            <div className="flex-1 bg-white rounded-lg border border-gray-200 p-3 flex flex-col gap-2 overflow-hidden">
                              <div className="flex items-center justify-between flex-shrink-0">
                                <span className="text-[10px] font-semibold text-gray-700">
                                  Kiosk Assignment
                                </span>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-full text-[8px] font-semibold bg-blue-100 text-blue-700 border border-blue-200">
                                    2 Selected
                                  </span>
                                  <button className="text-[9px] text-gray-500 hover:text-gray-700">
                                    Clear
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-1.5 overflow-y-auto">
                                {[
                                  {
                                    name: 'Kiosk 01',
                                    location: 'Main Entrance',
                                    status: 'online',
                                    checked: true,
                                  },
                                  {
                                    name: 'Kiosk 02',
                                    location: 'Coffee Station',
                                    status: 'online',
                                    checked: true,
                                  },
                                  {
                                    name: 'Kiosk 03',
                                    location: 'Exit Foyer',
                                    status: 'offline',
                                    checked: false,
                                  },
                                  {
                                    name: 'Kiosk 04',
                                    location: 'Garden Tent',
                                    status: 'maintenance',
                                    checked: false,
                                  },
                                ].map((k) => (
                                  <div
                                    key={k.name}
                                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors ${k.checked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                                  >
                                    <div
                                      className={`w-3.5 h-3.5 rounded border-2 flex-shrink-0 flex items-center justify-center ${k.checked ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'}`}
                                    >
                                      {k.checked && (
                                        <div className="w-1.5 h-1 border-b border-r border-white rotate-45 -mt-0.5" />
                                      )}
                                    </div>
                                    <div
                                      className={`w-2 h-2 rounded-full flex-shrink-0 ${k.status === 'online' ? 'bg-green-500' : k.status === 'maintenance' ? 'bg-yellow-500' : 'bg-gray-400'}`}
                                    />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-[10px] font-medium text-gray-900 truncate">
                                        {k.name}
                                      </p>
                                      <p className="text-[8px] text-gray-500">{k.location}</p>
                                    </div>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[7px] font-semibold border capitalize ${
                                        k.status === 'online'
                                          ? 'bg-green-100 text-green-700 border-green-200'
                                          : k.status === 'maintenance'
                                            ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                            : 'bg-gray-100 text-gray-700 border-gray-200'
                                      }`}
                                    >
                                      {k.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2 flex-shrink-0">
                            <button className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-[10px] font-medium">
                              Cancel
                            </button>
                            <button className="px-3 py-1.5 bg-black text-white rounded-lg text-[10px] font-semibold">
                              Save Configuration
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Panel 2 — Admin Dashboard */}
                  {activeDemoIndex === 2 && (
                    <div className="w-full self-stretch bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-fadeIn flex flex-col">
                      {/* Mac-style title bar */}
                      <div className="h-9 bg-slate-50 border-b border-slate-200 flex items-center px-4 gap-2 flex-shrink-0">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                      </div>
                      {/* Dashboard body */}
                      <div className="flex flex-1 min-h-0">
                        {/* Sidebar */}
                        <div className="w-32 bg-[#064e3b] p-3 flex flex-col flex-shrink-0">
                          <div className="mb-4">
                            <div className="text-white text-[10px] font-bold">SwiftCause</div>
                            <div className="text-white/50 text-[8px]">Admin Portal</div>
                          </div>
                          <div className="space-y-0.5">
                            {[
                              'Dashboard',
                              'Campaigns',
                              'Donations',
                              'Kiosks',
                              'Users',
                              'Gift Aid',
                            ].map((item, i) => (
                              <div
                                key={item}
                                className={`px-2 py-1.5 rounded text-[10px] font-medium ${i === 0 ? 'bg-white/15 text-white' : 'text-white/55'}`}
                              >
                                {item}
                              </div>
                            ))}
                          </div>
                        </div>
                        {/* Main content */}
                        <div className="flex-1 bg-[#F7F6F2] p-3 overflow-hidden flex flex-col gap-2.5 min-w-0">
                          <div>
                            <p className="text-[11px] font-bold text-[#064e3b]">Dashboard</p>
                            <p className="text-[8px] text-slate-400">
                              Real-time view of fundraising activity
                            </p>
                          </div>
                          {/* Stat cards */}
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              {
                                label: 'TOTAL RAISED',
                                value: '£2,847',
                                sub: '+12.5% today',
                                color: 'border-emerald-400',
                              },
                              {
                                label: 'CAMPAIGNS',
                                value: '12',
                                sub: '4 active',
                                color: 'border-blue-400',
                              },
                              {
                                label: 'DONATIONS',
                                value: '476',
                                sub: '3 this hour',
                                color: 'border-purple-400',
                              },
                              {
                                label: 'GIFT AID',
                                value: '£711',
                                sub: '+25% boost',
                                color: 'border-amber-400',
                              },
                            ].map((s, i) => (
                              <div
                                key={i}
                                className={`bg-white rounded-lg p-2 border ${s.color} shadow-sm`}
                              >
                                <p className="text-[7px] text-slate-400 uppercase tracking-wide mb-0.5">
                                  {s.label}
                                </p>
                                <p className="text-sm font-bold text-[#064e3b]">{s.value}</p>
                                <p className="text-[7px] text-emerald-600 mt-0.5">{s.sub}</p>
                              </div>
                            ))}
                          </div>
                          {/* Revenue chart */}
                          <div className="bg-white rounded-lg p-2.5 border border-slate-100 flex-1 flex flex-col min-h-0">
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <p className="text-[9px] font-bold text-[#064e3b]">
                                  Revenue Growth
                                </p>
                                <p className="text-[7px] text-slate-400">
                                  Monthly revenue trends including Gift Aid uplift
                                </p>
                              </div>
                              <span className="text-[8px] text-emerald-600 font-semibold">
                                ↑ 24.3%
                              </span>
                            </div>
                            <div className="relative flex-1 pl-6 min-h-[60px]">
                              <svg
                                className="w-full h-full"
                                viewBox="0 0 300 100"
                                preserveAspectRatio="none"
                              >
                                <line
                                  x1="0"
                                  y1="25"
                                  x2="300"
                                  y2="25"
                                  stroke="#e2e8f0"
                                  strokeWidth="0.5"
                                />
                                <line
                                  x1="0"
                                  y1="50"
                                  x2="300"
                                  y2="50"
                                  stroke="#e2e8f0"
                                  strokeWidth="0.5"
                                />
                                <line
                                  x1="0"
                                  y1="75"
                                  x2="300"
                                  y2="75"
                                  stroke="#e2e8f0"
                                  strokeWidth="0.5"
                                />
                                <defs>
                                  <linearGradient id="dg3" x1="0%" y1="0%" x2="0%" y2="100%">
                                    <stop offset="0%" stopColor="#064e3b" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#064e3b" stopOpacity="0" />
                                  </linearGradient>
                                </defs>
                                <polygon
                                  points="0,85 50,72 100,63 150,50 200,38 250,29 300,21 300,100 0,100"
                                  fill="url(#dg3)"
                                />
                                <polyline
                                  points="0,85 50,72 100,63 150,50 200,38 250,29 300,21"
                                  fill="none"
                                  stroke="#064e3b"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <circle cx="300" cy="21" r="3" fill="#064e3b" />
                                <polyline
                                  points="0,90 50,78 100,69 150,57 200,43 250,35 300,27"
                                  fill="none"
                                  stroke="#0f5132"
                                  strokeWidth="1.5"
                                  strokeDasharray="3,3"
                                />
                              </svg>
                              <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[6px] text-slate-400">
                                <span>£50</span>
                                <span>£40</span>
                                <span>£30</span>
                                <span>£20</span>
                              </div>
                              <div className="absolute bottom-0 left-6 right-0 flex justify-between text-[6px] text-slate-400 -mb-3">
                                <span>Dec</span>
                                <span>Jan</span>
                                <span>Feb</span>
                                <span>Mar</span>
                                <span>Apr</span>
                              </div>
                            </div>
                            <div className="flex gap-3 mt-4 justify-center">
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-0.5 bg-[#0f5132]" />
                                <span className="text-[6px] text-slate-500">Donations</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <div className="w-3 h-0.5 bg-[#064e3b]" />
                                <span className="text-[6px] text-slate-500">Total Revenue</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 bg-white px-6">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-[#1a2332]">Common Questions</h2>
              <p className="text-[#6b7280] mt-4">Everything you need to know about the platform.</p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="border border-[#e5e7eb] rounded-3xl bg-[#f9fafb] shadow-sm"
                >
                  <div className="px-8 py-6">
                    <h3 className="text-lg font-bold text-[#1a2332] mb-3">{faq.question}</h3>
                    <p className="text-[#4b5563] leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-24 bg-[#1a2332] px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="bg-white rounded-[3rem] p-8 md:p-16 shadow-2xl flex flex-col lg:flex-row gap-16 overflow-hidden relative">
              <div className="lg:w-1/2 space-y-8 relative z-10">
                <h2 className="text-4xl font-bold text-[#1a2332]">
                  Let's talk about your mission.
                </h2>
                <p className="hidden md:block text-lg text-[#4b5563]">
                  Ready to streamline your fundraising? Whether you have a question about Gift Aid,
                  GASDS, or getting started, our team is here to help.
                </p>
              </div>

              <div className="lg:w-1/2 relative z-10">
                <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#4b5563] ml-1">Full Name</label>
                      <input
                        type="text"
                        placeholder="Jane Doe"
                        className="w-full px-6 py-4 bg-[#f9fafb] border border-[#e5e7eb] focus:border-[#0f9d58] focus:bg-white focus:ring-4 focus:ring-[#0f9d58]/10 rounded-2xl transition-all outline-none"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-[#4b5563] ml-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="jane@charity.org"
                        className="w-full px-6 py-4 bg-[#f9fafb] border border-[#e5e7eb] focus:border-[#0f9d58] focus:bg-white focus:ring-4 focus:ring-[#0f9d58]/10 rounded-2xl transition-all outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-[#4b5563] ml-1">Message</label>
                    <textarea
                      rows={4}
                      placeholder="Tell us about your organisation..."
                      className="w-full px-6 py-4 bg-[#f9fafb] border border-[#e5e7eb] focus:border-[#0f9d58] focus:bg-white focus:ring-4 focus:ring-[#0f9d58]/10 rounded-2xl transition-all outline-none resize-none"
                    ></textarea>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 bg-[#f57c00] text-white font-bold rounded-2xl shadow-lg hover:bg-[#e65100] transition-all flex items-center justify-center gap-2 group"
                  >
                    Send Message
                    <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              </div>

              <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#0f9d58]/5 rounded-full blur-3xl"></div>
            </div>
          </div>
        </section>
        {/* Pre-footer CTA banner */}
        <section className="py-20 bg-[#1a2332] px-6 text-center">
          <div className="container mx-auto max-w-2xl">
            <h2 className="text-4xl font-extrabold text-white mb-4">
              Ready to modernise your fundraising?
            </h2>
            <p className="text-white/70 text-lg mb-10">
              Join UK charities already using SwiftCause to collect more, claim more, and spend
              less.
            </p>
            <button
              onClick={onSignup}
              className="inline-flex items-center gap-2 px-9 py-4 bg-[#f57c00] text-white font-bold rounded-[10px] hover:bg-[#e65100] transition-all group"
            >
              Start Free Today
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#111827] pt-16 pb-8 px-6">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            {/* Col 1 — Brand */}
            <div className="space-y-4">
              <button onClick={() => onNavigate('home')} className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="SwiftCause Logo"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-xl tracking-tight">
                  <span className="font-extrabold text-white">Swift</span>
                  <span className="font-bold text-[#4ade80]">Cause</span>
                </span>
              </button>
              <p className="text-white/60 text-sm leading-relaxed">
                Simplifying digital and physical fundraising for charities across the United
                Kingdom. Built for impact, designed for trust.
              </p>
            </div>

            {/* Col 2 — Navigation */}
            <div className="space-y-4">
              <h5 className="font-bold text-white/40 uppercase tracking-wider text-xs">
                Navigation
              </h5>
              <ul className="space-y-2 text-sm">
                {[
                  {
                    label: 'Features',
                    action: () => {
                      const el = document.querySelector('#features');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    },
                  },
                  {
                    label: 'FAQ',
                    action: () => {
                      const el = document.querySelector('#faq');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    },
                  },
                  { label: 'Contact', action: () => onNavigate('contact') },
                  { label: 'Login', action: onLogin },
                  { label: 'Sign Up', action: onSignup },
                ].map((item) => (
                  <li key={item.label}>
                    <button
                      onClick={item.action}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 3 — Legal */}
            <div className="space-y-4">
              <h5 className="font-bold text-white/40 uppercase tracking-wider text-xs">Legal</h5>
              <ul className="space-y-2 text-sm">
                {[
                  { label: 'Terms of Service', screen: 'terms' },
                  { label: 'Privacy Policy', screen: 'terms' },
                  { label: 'Cookie Policy', screen: 'terms' },
                ].map((item) => (
                  <li key={item.label}>
                    <button
                      onClick={() => onNavigate(item.screen)}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Col 4 — Connect */}
            <div className="space-y-4">
              <h5 className="font-bold text-white/40 uppercase tracking-wider text-xs">Connect</h5>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="https://www.linkedin.com/company/ynv-solutions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Linkedin className="w-4 h-4" /> LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com/YNVSolutions/SwiftCause_Web"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/60 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Github className="w-4 h-4" /> GitHub
                  </a>
                </li>
                <li>
                  <span className="text-white/40 text-sm">hello@swiftcause.com</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-2 text-xs text-white/40">
            <span>© 2026 SwiftCause Ltd. Registered in England &amp; Wales.</span>
            <span className="italic">[FCA regulatory statement, per fintech lawyer]</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
