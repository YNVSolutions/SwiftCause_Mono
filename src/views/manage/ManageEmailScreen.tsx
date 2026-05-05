'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Mail, ArrowRight, Lock, ShieldCheck, Zap, HeartHandshake, Loader2 } from 'lucide-react';
import { FUNCTION_URLS } from '@/shared/config/functions';

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Secure & private',
    description: 'One-time link expires after 15 minutes. No password ever stored.',
  },
  {
    icon: Zap,
    title: 'Instant access',
    description: 'Click the link in your email to see all your active donations instantly.',
  },
  {
    icon: HeartHandshake,
    title: 'Full control',
    description: 'Update payment details or cancel any subscription directly from your dashboard.',
  },
];

export function ManageEmailScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(FUNCTION_URLS.sendSubscriptionMagicLink, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send access link');
      }

      if (data.devLink) {
        console.warn('Development Magic Link:', data.devLink);
      }

      router.push(`/manage/check-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError('Failed to send access link. Please try again.');
      console.error('Error sending magic link:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EEEFF3] flex items-center justify-center p-4 lg:p-0">
      {/* ----------------------------------------------------------------
          Mobile: single centered card
          Desktop: full-height split panel
      ---------------------------------------------------------------- */}
      <div className="w-full max-w-sm lg:max-w-none lg:w-full lg:min-h-screen lg:flex">
        {/* ---- Left panel (desktop only) ---- */}
        <div className="hidden lg:flex lg:w-[38%] bg-[#064E3B] flex-col justify-between px-16 py-14">
          {/* Logo / brand */}
          <div>
            <div className="flex items-center gap-3 mb-20">
              <Image
                src="/logo.png"
                alt="SwiftCause"
                width={36}
                height={36}
                className="rounded-xl"
              />
              <span className="text-white font-semibold text-lg tracking-tight">SwiftCause</span>
            </div>

            {/* Hero copy */}
            <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-5">
              Your donations,
              <br />
              always in reach.
            </h1>
            <p className="text-[#6EE7B7] text-lg leading-relaxed max-w-md">
              Access and manage every recurring donation you've made, securely, in seconds, with no
              password needed.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-7">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-5 h-5 text-[#6EE7B7]" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm mb-0.5">{title}</p>
                  <p className="text-white/60 text-sm leading-relaxed">{description}</p>
                </div>
              </div>
            ))}

            {/* Footer note */}
            <p className="text-white/30 text-xs pt-4 border-t border-white/10">
              © {new Date().getFullYear()} SwiftCause · Payments secured by Stripe
            </p>
          </div>
        </div>

        {/* ---- Right panel (form) ---- */}
        <div className="lg:w-[62%] lg:min-h-screen lg:bg-white lg:flex lg:flex-col">
          {/* Centered form area */}
          <div className="flex-1 flex items-center justify-center px-4 py-8 lg:px-16 xl:px-24">
            {/* White card on mobile, transparent on desktop */}
            <div className="w-full max-w-md bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] px-6 py-8 lg:bg-transparent lg:shadow-none lg:px-0 lg:py-0">
              {/* Icon — mobile only */}
              <div className="flex justify-center mb-6 lg:hidden">
                <Image
                  src="/logo.png"
                  alt="SwiftCause"
                  width={64}
                  height={64}
                  className="rounded-full"
                />
              </div>

              {/* Heading */}
              <div className="mb-7 lg:mb-9">
                <h2 className="text-[28px] lg:text-[36px] font-bold text-[#111827] leading-tight mb-3">
                  Access your donations
                </h2>
                <p className="text-[#6B7280] text-sm lg:text-base leading-relaxed">
                  Enter your email address and we'll send a one-time secure link to your inbox.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-sm font-semibold text-[#374151] uppercase tracking-wider"
                  >
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#9CA3AF] pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="pl-11 h-14 text-base bg-white border-[#D1D5DB] rounded-xl focus-visible:ring-2 focus-visible:ring-[#047857] focus-visible:border-[#047857] placeholder:text-[#D1D5DB]"
                      required
                      disabled={loading}
                      autoComplete="email"
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-14 flex items-center justify-center gap-2.5 bg-[#047857] hover:bg-[#065f46] active:bg-[#064e3b] disabled:opacity-60 text-white font-semibold text-lg rounded-xl shadow-sm transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending link…
                    </>
                  ) : (
                    <>
                      Send secure access link
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="my-7 border-t border-[#F3F4F6]" />

              {/* Security note */}
              <div className="flex items-start gap-3 text-sm text-[#9CA3AF]">
                <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  No password required. The link expires after 15 minutes and can only be used once.
                </span>
              </div>
            </div>
          </div>

          {/* Bottom bar — desktop only */}
          <div className="hidden lg:flex items-center justify-center px-10 py-6">
            <p className="text-xs text-[#D1D5DB]">© {new Date().getFullYear()} SwiftCause</p>
          </div>
        </div>
      </div>
    </div>
  );
}
