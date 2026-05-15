'use client';

import React, { useState, useEffect } from 'react';
import {
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Mail,
  Menu,
  X,
  Linkedin,
  Github,
} from 'lucide-react';
import Image from 'next/image';
import { submitFeedback, queueContactConfirmationEmail } from '../../shared/api/firestoreService';
import { useToast } from '../../shared/ui/ToastProvider';

export function ContactPage({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const { showToast } = useToast();
  const [scrolled, setScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    message: '',
    website: '',
  });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleChange =
    (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (formData.website.trim()) {
        setIsLoading(false);
        setIsSubmitted(true);
        return;
      }
      await submitFeedback({
        firstName: formData.fullName,
        lastName: '',
        email: formData.email,
        message: formData.message,
      });
      let confirmationEmailFailed = false;
      try {
        await queueContactConfirmationEmail({
          firstName: formData.fullName,
          lastName: '',
          email: formData.email,
          message: formData.message,
        });
      } catch {
        confirmationEmailFailed = true;
      }
      setIsLoading(false);
      setIsSubmitted(true);
      if (confirmationEmailFailed) {
        showToast('Message saved. Confirmation email may be delayed.', 'error', 4000);
      } else {
        showToast('Message sent! We will get back to you soon.', 'success', 3000);
      }
    } catch (err) {
      console.error('Error submitting feedback:', err);
      setIsLoading(false);
      setError('Failed to send message. Please try again.');
      showToast('Failed to send message. Please try again.', 'error', 4000);
    }
  };

  const navItems = [
    { label: 'Features', href: '/#features' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Contact', href: '/contact' },
  ];

  return (
    <div className="min-h-screen bg-white selection:bg-[#0f9d58] selection:text-white">
      {/* Nav */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}
      >
        <div className="container mx-auto px-6 flex items-center justify-between">
          <button onClick={() => onNavigate?.('home')} className="flex items-center gap-2">
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

          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="text-[#1a2332]/70 hover:text-[#1a2332] font-medium transition-colors"
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => onNavigate?.('login')}
              className="px-5 py-2 text-[#9ca3af] font-semibold rounded-lg transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => onNavigate?.('signup')}
              className="px-5 py-2 bg-[#f57c00] text-white font-semibold rounded-lg shadow-md hover:bg-[#e65100] transition-all"
            >
              Sign Up
            </button>
          </div>

          <button
            className="md:hidden p-2 text-[#1a2332]"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X /> : <Menu />}
          </button>
        </div>

        {isMenuOpen && (
          <>
            <div
              className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setIsMenuOpen(false)}
            />
            <div className="md:hidden fixed top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-white shadow-2xl z-50 flex flex-col">
              <div className="flex items-center justify-between p-6 border-b border-[#e5e7eb]">
                <span className="text-xl tracking-tight">
                  <span className="font-extrabold text-[#1a2332]">Swift</span>
                  <span className="font-bold text-[#0f9d58]">Cause</span>
                </span>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-2 hover:bg-[#f9fafb] rounded-lg"
                >
                  <X className="w-6 h-6 text-[#1a2332]" />
                </button>
              </div>
              <div className="flex-1 p-6">
                <nav className="flex flex-col gap-2">
                  {navItems.map((item) => (
                    <a
                      key={item.label}
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className="text-lg font-medium text-[#1a2332] hover:bg-[#f9fafb] px-4 py-3 rounded-xl transition-colors"
                    >
                      {item.label}
                    </a>
                  ))}
                </nav>
              </div>
              <div className="p-6 border-t border-[#e5e7eb] space-y-3">
                <button
                  onClick={() => onNavigate?.('login')}
                  className="w-full py-3 text-[#9ca3af] font-semibold border-2 border-[#e5e7eb] rounded-xl"
                >
                  Login
                </button>
                <button
                  onClick={() => onNavigate?.('signup')}
                  className="w-full py-3 bg-[#f57c00] text-white font-semibold rounded-xl hover:bg-[#e65100] transition-colors"
                >
                  Sign Up Free
                </button>
              </div>
            </div>
          </>
        )}
      </nav>

      <main className="pt-32 pb-20 px-6">
        <div className="container mx-auto">
          <div className="bg-white rounded-[3rem] border border-[#e5e7eb] shadow-xl p-8 md:p-16 flex flex-col lg:flex-row gap-16 max-w-6xl mx-auto relative overflow-hidden">
            {/* Left */}
            <div className="lg:w-1/2 space-y-8 relative z-10">
              <h2 className="text-4xl font-bold text-[#1a2332]">Let's talk about your mission.</h2>
              <p className="text-lg text-[#4b5563]">
                Ready to streamline your fundraising? Whether you have a question about Gift Aid,
                GASDS, or getting started, our team is here to help.
              </p>
              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f5e9] text-[#0f9d58] flex-shrink-0">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1a2332]">Email Us</h3>
                    <p className="text-sm text-[#6b7280]">hello@swiftcause.com</p>
                    <p className="text-xs text-[#6b7280] mt-0.5">General &amp; Support Inquiries</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 rounded-2xl border border-[#e5e7eb] bg-[#f9fafb] p-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f5e9] text-[#0f9d58] flex-shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1a2332]">Response Time</h3>
                    <p className="text-sm text-[#6b7280]">
                      Typically within 24 hours on business days
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — Form */}
            <div className="lg:w-1/2 relative z-10">
              {isSubmitted ? (
                <div className="text-center py-10">
                  <CheckCircle className="h-16 w-16 mx-auto text-[#0f9d58]" />
                  <h2 className="mt-4 text-2xl font-bold text-[#1a2332]">Message Sent!</h2>
                  <p className="mt-2 text-[#4b5563]">
                    Thank you for reaching out. We'll get back to you as soon as possible.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="hidden" aria-hidden="true">
                    <input
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={formData.website}
                      onChange={handleChange('website')}
                    />
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label htmlFor="fullName" className="text-sm font-bold text-[#4b5563] ml-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="fullName"
                      required
                      placeholder="Jane Doe"
                      value={formData.fullName}
                      onChange={handleChange('fullName')}
                      className="w-full px-6 py-4 bg-[#f9fafb] border border-[#e5e7eb] focus:border-[#0f9d58] focus:bg-white focus:ring-4 focus:ring-[#0f9d58]/10 rounded-2xl transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="email" className="text-sm font-bold text-[#4b5563] ml-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="email"
                      required
                      placeholder="jane@charity.org"
                      value={formData.email}
                      onChange={handleChange('email')}
                      className="w-full px-6 py-4 bg-[#f9fafb] border border-[#e5e7eb] focus:border-[#0f9d58] focus:bg-white focus:ring-4 focus:ring-[#0f9d58]/10 rounded-2xl transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="message" className="text-sm font-bold text-[#4b5563] ml-1">
                      Message
                    </label>
                    <textarea
                      id="message"
                      rows={4}
                      required
                      placeholder="Tell us about your organisation..."
                      value={formData.message}
                      onChange={handleChange('message')}
                      className="w-full px-6 py-4 bg-[#f9fafb] border border-[#e5e7eb] focus:border-[#0f9d58] focus:bg-white focus:ring-4 focus:ring-[#0f9d58]/10 rounded-2xl transition-all outline-none resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-[#f57c00] text-white font-bold rounded-2xl shadow-lg hover:bg-[#e65100] transition-all flex items-center justify-center gap-2 group disabled:opacity-60"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" /> Sending...
                      </>
                    ) : (
                      <>
                        Send Message{' '}
                        <Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-[#0f9d58]/5 rounded-full blur-3xl"></div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#111827] pt-16 pb-8 px-6">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-10 mb-12">
            {/* Col 1 — Brand */}
            <div className="space-y-4">
              <button onClick={() => onNavigate?.('home')} className="flex items-center gap-2">
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
                  { label: 'Features', href: '/#features' },
                  { label: 'FAQ', href: '/#faq' },
                  { label: 'Contact', href: '/contact' },
                ].map((item) => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="/signup" className="text-white/60 hover:text-white transition-colors">
                    Register Interest
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3 — Connect */}
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
            <span>
              © 2026 SwiftCause Ltd. Registered in England &amp; Wales. Company No. [TBC].
              Registered office: [TBC].
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
