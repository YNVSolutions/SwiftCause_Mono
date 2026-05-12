'use client';

import { useState, useEffect } from 'react';
import {
  Heart,
  Terminal,
  Zap,
  PieChart,
  ArrowRight,
  Menu,
  X,
  PenTool,
  Tv,
  Activity,
  Layout,
  TrendingUp,
  Plus,
  Minus,
  Send,
  Github,
  Linkedin,
  MessageCircle,
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
  const [activeTab, setActiveTab] = useState<'campaign' | 'kiosk' | 'dashboard'>('campaign');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { label: 'Features', href: '#features' },
    { label: 'Tools', href: '#tools' },
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
        'Launch specific fundraisers for unique causes with stories, goals, and visual impact metrics.',
      icon: <Heart className="w-6 h-6" />,
    },
    {
      title: 'Physical Kiosks',
      description:
        'Bridge the physical-digital gap with secure, easy-to-use donation terminals for events and public spaces.',
      icon: <Terminal className="w-6 h-6" />,
    },
    {
      title: 'Gift Aid Boost',
      description:
        'Increase donation value by 25% automatically for UK taxpayers without additional setup hurdles.',
      icon: <Zap className="w-6 h-6" />,
    },
    {
      title: 'Real-time Analytics',
      description:
        'Gain instant visibility into fundraising performance across all digital and physical channels.',
      icon: <PieChart className="w-6 h-6" />,
    },
  ];

  const faqs = [
    {
      question: 'What is SwiftCause?',
      answer:
        'SwiftCause is a fundraising platform built for UK charities to accept donations online and in person, manage multiple campaigns, and track fundraising performance from one central dashboard.',
    },
    {
      question: 'Who is SwiftCause for?',
      answer:
        'SwiftCause is designed for UK-based charities and nonprofit organisations of all sizes — from small community groups to national charities running multiple campaigns and events.',
    },
    {
      question: 'Do donors need an account to donate?',
      answer:
        'No. Donors can make a donation without creating an account. They only provide the details required for the donation and, if applicable, Gift Aid.',
    },
    {
      question: 'Can multiple team members access the account?',
      answer:
        'Yes. You can invite team members and assign roles with different permission levels, such as admin, manager, or view-only access.',
    },
  ];

  const demoContent = {
    campaign: {
      title: 'Create Campaigns in Seconds',
      description: 'Build and launch fundraising campaigns instantly.',
      image: 'https://picsum.photos/1000/600?random=builder',
      icon: <PenTool className="w-5 h-5" />,
    },
    kiosk: {
      title: 'Assign to Kiosk',
      description: 'Connect campaigns to physical donation terminals.',
      image: 'https://picsum.photos/1000/600?random=kiosk',
      icon: <Tv className="w-5 h-5" />,
    },
    dashboard: {
      title: 'Admin Dashboard',
      description: 'Track performance and manage your organization.',
      image: 'https://picsum.photos/1000/600?random=analytics',
      icon: <Activity className="w-5 h-5" />,
    },
  };

  return (
    <div className="min-h-screen selection:bg-[#0f5132] selection:text-white">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-[#F3F1EA]/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'
        }`}
      >
        <div className="container mx-auto px-6 flex items-center justify-between">
          <button onClick={() => onNavigate('home')} className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="SwiftCause Logo"
              width={40}
              height={40}
              className="rounded-xl shadow-lg"
            />
            <span className="text-2xl font-bold text-[#064e3b] tracking-tight">SwiftCause</span>
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.href)}
                className="text-[#064e3b]/80 hover:text-[#064e3b] font-medium transition-colors cursor-pointer"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={onLogin}
              className="px-5 py-2 text-[#064e3b] font-semibold hover:bg-[#064e3b]/5 rounded-lg transition-colors"
            >
              Login
            </button>
            <button
              onClick={onSignup}
              className="px-6 py-2 bg-[#064e3b] text-white font-semibold rounded-lg shadow-md hover:bg-[#0f5132] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Sign Up
            </button>
          </div>

          {/* Mobile Toggle */}
          <button
            className="md:hidden p-2 text-[#064e3b]"
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
            <div className="md:hidden fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-[#F3F1EA] shadow-2xl z-50 flex flex-col animate-slide-in-right">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#064e3b]/10">
                <div className="flex items-center gap-2">
                  <Image
                    src="/logo.png"
                    alt="SwiftCause Logo"
                    width={32}
                    height={32}
                    className="rounded-xl shadow-lg"
                  />
                  <span className="text-xl font-bold text-[#064e3b]">SwiftCause</span>
                </div>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 hover:bg-[#064e3b]/5 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-[#064e3b]" />
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
                      className="text-lg font-medium text-[#064e3b] hover:bg-[#064e3b]/5 px-4 py-3 rounded-xl transition-colors cursor-pointer"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>

              {/* Action Buttons */}
              <div className="p-6 border-t border-[#064e3b]/10 space-y-3">
                <button
                  onClick={onLogin}
                  className="w-full py-3 text-[#064e3b] font-semibold border-2 border-[#064e3b]/20 rounded-xl hover:bg-[#064e3b]/5 transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={onSignup}
                  className="w-full py-3 bg-[#064e3b] text-white font-semibold rounded-xl shadow-lg hover:bg-[#0f5132] transition-colors"
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
        <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
          <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#064e3b]/10 text-[#064e3b] rounded-full text-sm font-semibold border border-[#064e3b]/20">
                <span className="flex h-2 w-2 rounded-full bg-[#064e3b] animate-pulse"></span>
                Designed for UK Nonprofits
              </div>

              <h1 className="text-5xl md:text-7xl font-bold text-[#064e3b] leading-[1.1] tracking-tight">
                Fundraising, <br />
                <span className="text-[#0f5132]">streamlined.</span>
              </h1>

              <p className="text-xl text-slate-600 leading-relaxed max-w-lg">
                Empower your charity with modern digital tools for fast setup, seamless donations,
                and kiosk-based giving.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={onSignup}
                  className="px-8 py-4 bg-[#064e3b] text-white font-bold rounded-2xl shadow-xl hover:bg-[#0f5132] transition-all flex items-center justify-center gap-2 group"
                >
                  Start Raising Today
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </div>

            <AnimatedDashboardDemo />
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-white px-6">
          <div className="container mx-auto">
            <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
              <h2 className="text-sm font-bold text-[#0f5132] uppercase tracking-[0.2em]">
                Our Platform
              </h2>
              <p className="text-4xl md:text-5xl font-bold text-[#064e3b] tracking-tight">
                Everything you need to grow your impact.
              </p>
              <p className="text-lg text-slate-600">
                We handle the technical complexity so you can focus on what matters: your mission.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, idx) => (
                <div
                  key={idx}
                  className="p-8 rounded-[2rem] bg-[#F7F6F2] border border-transparent hover:border-[#064e3b]/10 hover:shadow-xl transition-all group"
                >
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-[#064e3b] shadow-sm mb-6 group-hover:bg-[#064e3b] group-hover:text-white transition-all duration-300">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold text-[#064e3b] mb-4">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tools Section */}
        <section id="tools" className="py-24 bg-[#F3F1EA] px-6 overflow-hidden">
          <div className="container mx-auto">
            <div className="flex flex-col lg:flex-row gap-16 items-center">
              <div className="lg:w-1/3 space-y-8">
                <h2 className="text-4xl font-bold text-[#064e3b] leading-tight">
                  Simplified tools for complex goals.
                </h2>

                <div className="space-y-4">
                  {(Object.keys(demoContent) as Array<'campaign' | 'kiosk' | 'dashboard'>).map(
                    (tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`w-full p-5 rounded-2xl flex items-center gap-4 text-left transition-all border ${
                          activeTab === tab
                            ? 'bg-white border-[#064e3b]/10 shadow-lg scale-[1.02]'
                            : 'bg-transparent border-transparent hover:bg-white/50 text-slate-500'
                        }`}
                      >
                        <div
                          className={`p-3 rounded-xl ${activeTab === tab ? 'bg-[#064e3b] text-white' : 'bg-slate-200'}`}
                        >
                          {demoContent[tab].icon}
                        </div>
                        <div>
                          <h4
                            className={`font-bold ${activeTab === tab ? 'text-[#064e3b]' : 'text-slate-600'}`}
                          >
                            {demoContent[tab].title}
                          </h4>
                          <p className="text-sm opacity-80 line-clamp-1">
                            {demoContent[tab].description}
                          </p>
                        </div>
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="hidden lg:block lg:w-2/3 relative">
                <div className="w-full h-full min-h-[400px]  p-6 flex items-stretch justify-center">
                  {/* Campaign Builder Demo */}
                  {activeTab === 'campaign' && (
                    <div className="w-full max-w-2xl h-full flex items-center justify-center animate-fade-in">
                      <div className="bg-white rounded-2xl shadow-2xl w-full h-full overflow-hidden border border-slate-200">
                        {/* Modal Header */}
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">
                              Edit • Campaign
                            </div>
                            <h3 className="text-sm font-bold text-[#064e3b]">
                              General Information
                            </h3>
                          </div>
                          <button className="w-6 h-6 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex h-[calc(100%-56px)]">
                          {/* Sidebar */}
                          <div className="w-36 bg-slate-50 border-r border-slate-200 p-2.5">
                            <div className="mb-2">
                              <div className="text-[9px] font-bold text-slate-500 mb-1">
                                Campaign
                              </div>
                              <div className="text-[8px] text-slate-400">Configuration</div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="px-2.5 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-[10px]">
                                BASIC INFO
                              </div>
                              <div className="px-2.5 py-2 text-slate-600 hover:bg-white rounded-lg font-medium text-[10px] cursor-pointer">
                                DETAILS
                              </div>
                              <div className="px-2.5 py-2 text-slate-600 hover:bg-white rounded-lg font-medium text-[10px] cursor-pointer">
                                MEDIA
                              </div>
                              <div className="px-2.5 py-2 text-slate-600 hover:bg-white rounded-lg font-medium text-[10px] cursor-pointer">
                                KIOSK DISTRIBUTION
                              </div>
                            </div>
                          </div>

                          {/* Main Form Content */}
                          <div className="flex-1 p-4 overflow-y-auto">
                            <div className="space-y-3.5">
                              {/* Campaign Title */}
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                  Campaign Title
                                </label>
                                <input
                                  type="text"
                                  value="Warm Clothes & Meals Can Bring Back The Lost Smiles"
                                  readOnly
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700"
                                />
                              </div>

                              {/* Brief Overview */}
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                  Brief Overview
                                </label>
                                <textarea
                                  value="Let us all join hands and support SPYM in their efforts to help those in dire need."
                                  readOnly
                                  rows={2}
                                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-[11px] text-slate-700 resize-none"
                                />
                              </div>

                              {/* Detailed Campaign Story */}
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 block">
                                  Detailed Campaign Story
                                </label>
                                <div className="border-2 border-emerald-500 rounded-lg overflow-hidden">
                                  {/* Rich Text Toolbar */}
                                  <div className="bg-white border-b border-slate-200 px-2 py-1.5 flex items-center gap-1.5">
                                    <button className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded">
                                      <span className="font-bold text-[11px]">B</span>
                                    </button>
                                    <button className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded">
                                      <span className="italic text-[11px]">I</span>
                                    </button>
                                    <button className="w-6 h-6 flex items-center justify-center hover:bg-slate-100 rounded">
                                      <span className="text-[11px]">—</span>
                                    </button>
                                  </div>
                                  {/* Text Content */}
                                  <div className="bg-white px-3 py-2 min-h-[100px] text-[11px] text-slate-700 leading-relaxed">
                                    <p>
                                      The chilly winters of Delhi are infamous. Each year, we hear
                                      about <strong>hundreds</strong> of homeless people who have
                                      died braving the cold winter waves. While we are all cuddled
                                      up in our homes with warm clothes and good food, there are so
                                      many on the streets.
                                    </p>
                                    <div className="mt-1.5 w-0.5 h-3 bg-emerald-500 animate-pulse"></div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-200">
                              <button className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-[10px] font-medium">
                                <Layout className="w-3 h-3" />
                                SAVE DRAFT
                              </button>
                              <div className="flex gap-2">
                                <button className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-[10px] font-semibold">
                                  CANCEL
                                </button>
                                <button className="px-3 py-1.5 bg-[#064e3b] text-white rounded-lg text-[10px] font-semibold hover:bg-[#0f5132] flex items-center gap-1.5">
                                  <Layout className="w-3 h-3" />
                                  UPDATE CAMPAIGN
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Kiosk Demo */}
                  {activeTab === 'kiosk' && (
                    <div className="w-full max-w-2xl h-full flex items-center justify-center animate-fade-in">
                      <div className="bg-white rounded-2xl shadow-2xl w-full h-full overflow-hidden border border-slate-200">
                        {/* Modal Header */}
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                          <div>
                            <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">
                              Edit • Kiosk
                            </div>
                            <h3 className="text-sm font-bold text-[#064e3b]">
                              Kiosk Configuration
                            </h3>
                          </div>
                          <button className="w-6 h-6 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex h-[calc(100%-56px)]">
                          {/* Sidebar */}
                          <div className="w-36 bg-slate-50 border-r border-slate-200 p-2.5">
                            <div className="mb-2">
                              <div className="text-[9px] font-bold text-slate-500 mb-1">Kiosk</div>
                              <div className="text-[8px] text-slate-400">Configuration</div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="px-2.5 py-2 text-slate-600 hover:bg-white rounded-lg font-medium text-[10px] cursor-pointer">
                                BASIC INFO
                              </div>
                              <div className="px-2.5 py-2 bg-emerald-600 text-white rounded-lg font-semibold text-[10px]">
                                CAMPAIGNS
                              </div>
                              <div className="px-2.5 py-2 text-slate-600 hover:bg-white rounded-lg font-medium text-[10px] cursor-pointer">
                                DISPLAY
                              </div>
                            </div>
                          </div>

                          {/* Main Content */}
                          <div className="flex-1 p-4 overflow-y-auto">
                            <div className="space-y-4">
                              {/* Available Campaigns */}
                              <div>
                                <div className="flex items-center gap-2 mb-3">
                                  <Plus className="w-4 h-4 text-slate-400" />
                                  <h4 className="text-[11px] font-bold text-slate-700">
                                    Available Campaigns
                                  </h4>
                                  <span className="text-[10px] text-slate-400">2</span>
                                </div>

                                <div className="space-y-2">
                                  {/* Campaign 1 */}
                                  <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3 border border-slate-200">
                                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex-shrink-0 flex items-center justify-center">
                                      <Heart className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[11px] font-semibold text-slate-700 truncate">
                                        Warm Clothes & Meals Can Bring Back The Lost Smiles On T...
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-slate-500">
                                          £12.22 raised
                                        </span>
                                        <span className="text-[9px] text-slate-400">•</span>
                                        <span className="text-[9px] text-slate-500">
                                          17% funded
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button className="text-emerald-600 text-[10px] font-semibold flex items-center gap-1">
                                        <Plus className="w-3 h-3" />
                                        ASSIGN
                                      </button>
                                      <button className="text-blue-600 text-[10px] font-semibold flex items-center gap-1">
                                        <PenTool className="w-3 h-3" />
                                        Edit
                                      </button>
                                    </div>
                                  </div>

                                  {/* Campaign 2 */}
                                  <div className="bg-slate-50 rounded-lg p-3 flex items-center gap-3 border border-slate-200">
                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex-shrink-0 flex items-center justify-center">
                                      <Zap className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[11px] font-semibold text-slate-700 truncate">
                                        Schooling Special needs children
                                      </div>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[9px] text-slate-500">
                                          £0.00 raised
                                        </span>
                                        <span className="text-[9px] text-slate-400">•</span>
                                        <span className="text-[9px] text-slate-500">0% funded</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button className="text-emerald-600 text-[10px] font-semibold flex items-center gap-1">
                                        <Plus className="w-3 h-3" />
                                        ASSIGN
                                      </button>
                                      <button className="text-blue-600 text-[10px] font-semibold flex items-center gap-1">
                                        <PenTool className="w-3 h-3" />
                                        Edit
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Campaign View */}
                              <div className="pt-4 border-t border-slate-200">
                                <h4 className="text-[11px] font-bold text-slate-700 mb-3">
                                  Campaign View
                                </h4>

                                <div className="mb-3">
                                  <div className="text-[10px] font-bold text-slate-600 mb-2">
                                    DISPLAY LAYOUT
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="border-2 border-emerald-500 bg-emerald-50 rounded-lg p-3 flex flex-col items-center gap-2 cursor-pointer">
                                      <Layout className="w-6 h-6 text-emerald-600" />
                                      <span className="text-[10px] font-semibold text-emerald-700">
                                        GRID
                                      </span>
                                    </div>
                                    <div className="border border-slate-200 bg-white rounded-lg p-3 flex flex-col items-center gap-2 cursor-pointer hover:border-slate-300">
                                      <Menu className="w-6 h-6 text-slate-400" />
                                      <span className="text-[10px] font-semibold text-slate-500">
                                        LIST
                                      </span>
                                    </div>
                                    <div className="border border-slate-200 bg-white rounded-lg p-3 flex flex-col items-center gap-2 cursor-pointer hover:border-slate-300">
                                      <Tv className="w-6 h-6 text-slate-400" />
                                      <span className="text-[10px] font-semibold text-slate-500">
                                        CAROUSEL
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-200">
                              <button className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-[10px] font-medium">
                                <Layout className="w-3 h-3" />
                                SAVE DRAFT
                              </button>
                              <div className="flex gap-2">
                                <button className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg text-[10px] font-semibold">
                                  CANCEL
                                </button>
                                <button className="px-3 py-1.5 bg-[#064e3b] text-white rounded-lg text-[10px] font-semibold hover:bg-[#0f5132] flex items-center gap-1.5">
                                  <Layout className="w-3 h-3" />
                                  UPDATE KIOSK
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Dashboard Demo */}
                  {activeTab === 'dashboard' && (
                    <div className="w-full max-w-2xl h-full flex items-center justify-center animate-fade-in">
                      <div className="bg-white rounded-2xl shadow-2xl w-full h-full overflow-hidden border border-slate-200">
                        {/* Mac Window Header */}
                        <div className="h-10 bg-slate-50 border-b flex items-center px-4 gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-400"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                          <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        </div>

                        {/* Mini Dashboard Content */}
                        <div className="flex h-[calc(100%-40px)]">
                          {/* Sidebar */}
                          <div className="w-32 bg-[#064e3b] p-3 flex flex-col">
                            <div className="mb-4">
                              <div className="flex items-center gap-2 mb-1">
                                <Image
                                  src="/logo.png"
                                  alt="Logo"
                                  width={16}
                                  height={16}
                                  className="rounded"
                                />
                                <div className="text-white text-[10px] font-bold">SwiftCause</div>
                              </div>
                              <div className="text-[7px] text-white/60">Admin Portal</div>
                            </div>

                            <div className="space-y-1 flex-1">
                              <div className="px-2 py-1.5 bg-white/10 rounded text-white text-[9px] font-medium">
                                Dashboard
                              </div>
                              <div className="px-2 py-1.5 text-white/60 text-[9px] font-medium">
                                Campaigns
                              </div>
                              <div className="px-2 py-1.5 text-white/60 text-[9px] font-medium">
                                Donations
                              </div>
                              <div className="px-2 py-1.5 text-white/60 text-[9px] font-medium">
                                Kiosks
                              </div>
                              <div className="px-2 py-1.5 text-white/60 text-[9px] font-medium">
                                Users
                              </div>
                            </div>
                          </div>

                          {/* Main Content */}
                          <div className="flex-1 bg-[#F7F6F2] p-3 overflow-hidden">
                            <div className="mb-2">
                              <h3 className="text-xs font-bold text-[#064e3b]">Dashboard</h3>
                              <p className="text-[7px] text-slate-500">
                                Real-time view of fundraising activity
                              </p>
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-4 gap-1.5 mb-2">
                              <div className="bg-white rounded-lg p-1.5 border border-slate-100">
                                <div className="text-[7px] text-slate-500 mb-0.5">TOTAL RAISED</div>
                                <div className="text-[11px] font-bold text-[#064e3b]">£145.39</div>
                              </div>
                              <div className="bg-white rounded-lg p-1.5 border border-slate-100">
                                <div className="text-[7px] text-slate-500 mb-0.5">CAMPAIGNS</div>
                                <div className="text-[11px] font-bold text-[#064e3b]">75</div>
                              </div>
                              <div className="bg-white rounded-lg p-1.5 border border-slate-100">
                                <div className="text-[7px] text-slate-500 mb-0.5">DONATIONS</div>
                                <div className="text-[11px] font-bold text-[#064e3b]">76</div>
                              </div>
                              <div className="bg-white rounded-lg p-1.5 border border-slate-100">
                                <div className="text-[7px] text-slate-500 mb-0.5">GIFT AID</div>
                                <div className="text-[11px] font-bold text-[#064e3b]">£7.23</div>
                              </div>
                            </div>

                            {/* Revenue Chart */}
                            <div className="bg-white rounded-lg p-2.5 border border-slate-100 mb-2">
                              <div className="flex items-center gap-1 mb-1.5">
                                <TrendingUp className="w-3 h-3 text-emerald-600" />
                                <h4 className="text-[9px] font-bold text-[#064e3b]">
                                  Revenue Growth
                                </h4>
                              </div>

                              {/* Simple Line Chart */}
                              <div className="relative h-20 pl-6">
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

                                  <polyline
                                    points="0,85 50,72 100,63 150,50 200,38 250,29 300,21"
                                    fill="none"
                                    stroke="#064e3b"
                                    strokeWidth="2"
                                  />

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
                              </div>

                              <div className="flex gap-2 mt-3 justify-center">
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-0.5 bg-[#0f5132]"></div>
                                  <span className="text-[6px] text-slate-600">Donations</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-0.5 bg-[#064e3b]"></div>
                                  <span className="text-[6px] text-slate-600">Total Revenue</span>
                                </div>
                              </div>
                            </div>

                            {/* Bottom Row: Activity Heatmap & Pie Chart */}
                            <div className="grid grid-cols-2 gap-2">
                              {/* Activity Heatmap */}
                              <div className="bg-white rounded-lg p-2 border border-slate-100">
                                <h4 className="text-[9px] font-bold text-[#064e3b] mb-1.5">
                                  Activity
                                </h4>
                                <div className="space-y-0.5">
                                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                                    <div key={day} className="flex items-center gap-1">
                                      <span className="text-[6px] text-slate-500 w-5">{day}</span>
                                      <div className="flex gap-0.5 flex-1">
                                        {Array.from({ length: 10 }).map((_, j) => {
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
                                              className={`h-1.5 flex-1 rounded-sm ${bgColor}`}
                                            />
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              {/* Pie Chart */}
                              <div className="bg-white rounded-lg p-2 border border-slate-100">
                                <h4 className="text-[9px] font-bold text-[#064e3b] mb-1.5">
                                  Sources
                                </h4>
                                <div className="flex items-center justify-center h-16">
                                  <svg width="60" height="60" viewBox="0 0 100 100">
                                    <circle
                                      cx="50"
                                      cy="50"
                                      r="40"
                                      fill="transparent"
                                      stroke="#10b981"
                                      strokeWidth="20"
                                      strokeDasharray="150.8 251.2"
                                      transform="rotate(-90 50 50)"
                                    />
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
                                    />
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
                                    />
                                  </svg>
                                </div>
                                <div className="space-y-0.5 mt-1">
                                  <div className="flex items-center justify-between text-[6px]">
                                    <div className="flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                      <span className="text-slate-600">Online</span>
                                    </div>
                                    <span className="font-bold text-slate-700">60%</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[6px]">
                                    <div className="flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                                      <span className="text-slate-600">Kiosk</span>
                                    </div>
                                    <span className="font-bold text-slate-700">30%</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[6px]">
                                    <div className="flex items-center gap-1">
                                      <div className="w-1.5 h-1.5 bg-purple-500 rounded-full"></div>
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
                  )}
                </div>
                <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#0f5132]/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-[#064e3b]/10 rounded-full blur-3xl"></div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 bg-white px-6">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-[#064e3b]">Common Questions</h2>
              <p className="text-slate-500 mt-4">Everything you need to know about the platform.</p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className={`border rounded-3xl transition-all cursor-pointer ${
                    openFaqIndex === idx
                      ? 'bg-[#F7F6F2] border-slate-200 shadow-sm'
                      : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                  }`}
                  onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                >
                  <button className="w-full px-8 py-6 flex items-center justify-between text-left focus:outline-none">
                    <span className="text-lg font-bold text-[#064e3b] pr-8">{faq.question}</span>
                    <div
                      className={`transition-transform duration-200 ${openFaqIndex === idx ? 'rotate-180' : ''}`}
                    >
                      {openFaqIndex === idx ? (
                        <Minus className="w-6 h-6 text-[#0f5132]" />
                      ) : (
                        <Plus className="w-6 h-6 text-[#064e3b]" />
                      )}
                    </div>
                  </button>

                  {openFaqIndex === idx && (
                    <div className="px-8 pb-6 animate-fade-in">
                      <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="py-24 bg-[#064e3b] px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="bg-white rounded-[3rem] p-8 md:p-16 shadow-2xl flex flex-col lg:flex-row gap-16 overflow-hidden relative">
              <div className="lg:w-1/2 space-y-8 relative z-10">
                <h2 className="text-4xl font-bold text-[#064e3b]">
                  Let's talk about your mission.
                </h2>
                <p className="hidden md:block text-lg text-slate-600">
                  Ready to streamline your fundraising? Whether you have a question about kiosks,
                  Gift Aid, or custom pricing, our team is here to help.
                </p>
              </div>

              <div className="lg:w-1/2 relative z-10">
                <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 ml-1">Full Name</label>
                      <input
                        type="text"
                        placeholder="Jane Doe"
                        className="w-full px-6 py-4 bg-[#F7F6F2] border-transparent focus:border-[#064e3b]/20 focus:bg-white focus:ring-4 focus:ring-[#064e3b]/5 rounded-2xl transition-all"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500 ml-1">Email Address</label>
                      <input
                        type="email"
                        placeholder="jane@charity.org"
                        className="w-full px-6 py-4 bg-[#F7F6F2] border-transparent focus:border-[#064e3b]/20 focus:bg-white focus:ring-4 focus:ring-[#064e3b]/5 rounded-2xl transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 ml-1">Message</label>
                    <textarea
                      rows={4}
                      placeholder="Tell us about your organization..."
                      className="w-full px-6 py-4 bg-[#F7F6F2] border-transparent focus:border-[#064e3b]/20 focus:bg-white focus:ring-4 focus:ring-[#064e3b]/5 rounded-2xl transition-all resize-none"
                    ></textarea>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-4 bg-[#064e3b] text-white font-bold rounded-2xl shadow-lg hover:bg-[#0f5132] transition-all flex items-center justify-center gap-2 group"
                  >
                    Send Message
                    <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </form>
              </div>

              <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#0f5132]/5 rounded-full blur-3xl"></div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#F3F1EA] pt-20 pb-10 px-6 border-t border-slate-200">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-16">
            <div className="space-y-6">
              <button onClick={() => onNavigate('home')} className="flex items-center gap-2">
                <Image
                  src="/logo.png"
                  alt="SwiftCause Logo"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-xl font-bold text-[#064e3b]">SwiftCause</span>
              </button>
              <p className="text-slate-500 text-sm leading-relaxed max-w-xs">
                Simplifying digital and physical fundraising for charities across the United
                Kingdom. Built for impact, designed for trust.
              </p>
            </div>

            <div className="space-y-4">
              <h5 className="font-bold text-[#064e3b] uppercase tracking-wider text-xs">
                Navigation
              </h5>
              <ul className="flex flex-row gap-4 text-sm text-slate-600 font-medium">
                <li>
                  <button onClick={onLogin} className="hover:text-[#064e3b] transition-colors">
                    Login
                  </button>
                </li>
                <li>
                  <button onClick={onSignup} className="hover:text-[#064e3b] transition-colors">
                    Sign Up
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => onNavigate('terms')}
                    className="hover:text-[#064e3b] transition-colors"
                  >
                    Terms
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-6">
              <h5 className="font-bold text-[#064e3b] uppercase tracking-wider text-xs">
                Join Our Community
              </h5>

              <a
                href="https://discord.gg/3EG7Y5Q9nV"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 bg-[#064e3b] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="font-bold">Join Discord</div>
                    <div className="text-[10px] text-white/70">Connect with other UK charities</div>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </a>

              <div className="flex gap-4 items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Follow us
                </span>
                <div className="flex gap-2">
                  <a
                    href="https://www.linkedin.com/company/ynv-solutions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[#064e3b] hover:bg-[#064e3b] hover:text-white transition-all shadow-sm"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                  <a
                    href="https://github.com/YNVSolutions/SwiftCause_Web"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-[#064e3b] hover:bg-[#064e3b] hover:text-white transition-all shadow-sm"
                  >
                    <Github className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <div className="flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-red-400 fill-red-400" /> in the UK
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
