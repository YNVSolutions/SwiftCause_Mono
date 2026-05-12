'use client';

import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';

interface NavbarProps {
  onLogin: () => void;
  onSignup: () => void;
  onNavigate: (screen: string) => void;
}

export function Navbar({ onLogin, onSignup, onNavigate }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-[#F3F1EA]/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-4 sm:py-5'
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 flex items-center justify-between">
        <button onClick={() => onNavigate('home')} className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="SwiftCause Logo"
            width={32}
            height={32}
            className="sm:w-10 sm:h-10 rounded-xl shadow-lg"
          />
          <span className="text-xl sm:text-2xl font-bold text-[#064e3b] tracking-tight">
            SwiftCause
          </span>
        </button>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6 lg:gap-8">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className="text-[#064e3b]/80 hover:text-[#064e3b] font-medium transition-colors cursor-pointer text-sm lg:text-base"
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3 lg:gap-4">
          <button
            onClick={onLogin}
            className="px-4 lg:px-5 py-2 text-[#064e3b] font-semibold hover:bg-[#064e3b]/5 rounded-lg transition-colors text-sm lg:text-base"
          >
            Login
          </button>
          <button
            onClick={onSignup}
            className="px-5 lg:px-6 py-2 bg-[#064e3b] text-white font-semibold rounded-lg shadow-md hover:bg-[#0f5132] transition-all transform hover:-translate-y-0.5 active:translate-y-0 text-sm lg:text-base"
          >
            Sign Up
          </button>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden p-2 text-[#064e3b]" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-[#F3F1EA] border-b border-[#064e3b]/10 shadow-xl p-6 flex flex-col gap-4">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              onClick={(e) => handleNavClick(e, item.href)}
              className="text-lg font-medium text-[#064e3b] cursor-pointer"
            >
              {item.label}
            </a>
          ))}
          <div className="flex flex-col gap-3 pt-4 border-t border-[#064e3b]/10">
            <button
              onClick={onLogin}
              className="w-full py-3 text-[#064e3b] font-semibold border border-[#064e3b]/20 rounded-xl"
            >
              Login
            </button>
            <button
              onClick={onSignup}
              className="w-full py-3 bg-[#064e3b] text-white font-semibold rounded-xl shadow-lg"
            >
              Sign Up Free
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
