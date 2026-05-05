'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Mail, ArrowLeft, Lock, CheckCircle, Loader2 } from 'lucide-react';
import { FUNCTION_URLS } from '@/shared/config/functions';

export function ManageCheckEmailScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') || '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');

  const maskEmail = (raw: string) => {
    if (!raw) return '';
    const [local, domain] = raw.split('@');
    if (!domain) return raw;
    const masked = local.length > 4 ? local.substring(0, 4) + '***' : local;
    return `${masked}@${domain}`;
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    try {
      const response = await fetch(FUNCTION_URLS.sendSubscriptionMagicLink, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to resend link');
      }

      if (data.devLink) {
        console.warn('Development Magic Link:', data.devLink);
      }

      setResent(true);
    } catch (err) {
      console.error('Error resending magic link:', err);
      setError('Could not resend the link. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EEEFF3] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] px-8 py-10">
          {/* Icon */}
          <div className="flex justify-center mb-7">
            <div className="w-16 h-16 rounded-full bg-[#D1FAE5] flex items-center justify-center">
              <Mail className="w-8 h-8 text-[#047857]" />
            </div>
          </div>

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-[28px] font-bold text-[#111827] leading-tight mb-3">
              Check your email
            </h1>
            <p className="text-base text-[#6B7280] leading-relaxed">We sent a secure link to</p>
            <p className="text-base font-semibold text-[#111827] mt-1">{maskEmail(email)}</p>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            {/* Resend / Sent state */}
            {resent ? (
              <div className="w-full h-14 flex items-center justify-center gap-2.5 rounded-xl bg-[#D1FAE5] border border-[#6EE7B7] text-[#047857] font-semibold text-base">
                <CheckCircle className="w-5 h-5" />
                Link sent — check your inbox
              </div>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full h-14 flex items-center justify-center gap-2 border-2 border-[#047857] text-[#047857] hover:bg-[#047857] hover:text-white disabled:opacity-50 font-semibold text-base rounded-xl transition-colors"
              >
                {resending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Resend link'
                )}
              </button>
            )}

            {error && <p className="text-sm text-red-600 text-center">{error}</p>}

            {/* Back */}
            <button
              onClick={() => router.push('/manage')}
              className="w-full h-12 flex items-center justify-center gap-2 text-sm font-medium text-[#6B7280] hover:text-[#111827] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </button>
          </div>

          {/* Divider */}
          <div className="my-7 border-t border-[#F3F4F6]" />

          {/* Security note */}
          <div className="flex items-start gap-3 text-sm text-[#9CA3AF]">
            <Lock className="w-4 h-4 shrink-0 mt-0.5" />
            <span>The link expires after 15 minutes and can only be used once.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
