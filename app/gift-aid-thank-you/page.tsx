'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Heart, Leaf, Mail, Send } from 'lucide-react';
import { createThankYouMail } from '@/shared/api';

interface ThankYouData {
  campaignTitle: string;
  donationAmount: number;
  giftAidBonus: number;
  totalImpact: number;
  donorName: string;
  declarationId: string;
  transactionId?: string;
}

// ─── Shared spinner ───────────────────────────────────────────────────────────
const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center space-y-3">
      <div className="w-10 h-10 rounded-full border-2 border-green-600 border-t-transparent animate-spin mx-auto" />
      <p className="text-sm text-gray-500">Loading…</p>
    </div>
  </div>
);

// ─── Fallback (no session data) ───────────────────────────────────────────────
const Fallback = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-white rounded-2xl shadow-md overflow-hidden">
      <div className="bg-green-700 px-6 py-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-white">Gift Aid Submitted</h1>
        <p className="mt-2 text-sm text-green-100 leading-relaxed">
          Your declaration has been successfully processed.
        </p>
      </div>
    </div>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────
export default function GiftAidThankYouPage() {
  const [data, setData] = useState<ThankYouData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('giftAidThankYou');
    if (stored) {
      const parsed = JSON.parse(stored) as ThankYouData;
      setData(parsed);
      sessionStorage.removeItem('giftAidThankYou');
    }
    const storedEmail = sessionStorage.getItem('donorEmail');
    if (storedEmail) {
      setEmail(storedEmail);
    }
    setLoading(false);
  }, []);

  const handleEmailConfirmation = () => {
    setShowEmailForm((current) => !current);
    setEmailError(null);
  };

  const handleSendReceipt = async () => {
    const normalizedEmail = email.trim();
    const transactionId = data?.transactionId?.trim();

    if (!normalizedEmail) {
      setEmailError('Please enter an email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError('Please enter a valid email address.');
      return;
    }

    if (!transactionId) {
      setEmailError('Receipt reference unavailable for this donation.');
      return;
    }

    setIsSendingEmail(true);
    setEmailError(null);

    try {
      await createThankYouMail(normalizedEmail, data?.campaignTitle, transactionId);
      setEmailSent(true);
      setShowEmailForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setEmailError(
        message.toLowerCase().includes('processing')
          ? 'Your donation is still being finalized. Please try again in a few seconds.'
          : 'We could not send the receipt right now. Please try again.',
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (loading) return <Spinner />;
  if (!data) return <Fallback />;

  const firstName = data.donorName.split(' ')[0] || data.donorName;
  const canSendReceipt = Boolean(data.transactionId?.trim());
  // Strip any "Campaign Title:" prefix that may come from the backend
  const campaignName = data.campaignTitle.replace(/^Campaign Title:\s*/i, '').trim();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-md overflow-hidden">
        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="bg-green-700 px-6 py-5 text-center">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Heart className="w-7 h-7 text-white fill-white" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-white">Thank You, {firstName}!</h1>
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-6 space-y-4">
          {/* Campaign card */}
          <div className="border border-gray-200 rounded-xl px-5 py-4 shadow-sm">
            <p className="text-sm text-gray-700 leading-relaxed">
              Thank you for your generous gift. With your Gift Aid boost, your support for{' '}
              <span className="font-semibold text-gray-900">{campaignName}</span> goes even further.
            </p>
          </div>

          {/* Donation breakdown */}
          <div className="border border-gray-200 rounded-xl px-5 py-4 shadow-sm space-y-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Donation breakdown</p>

            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Donation Amount</span>
              <span className="text-sm font-medium text-gray-700">
                £{data.donationAmount.toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Leaf className="w-3.5 h-3.5 text-green-600 shrink-0" />
                <span className="text-sm text-gray-600">Gift Aid (25%)</span>
              </div>
              <span className="text-sm font-medium text-green-600">
                +£{data.giftAidBonus.toFixed(2)}
              </span>
            </div>

            <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">Total Impact</span>
              <span className="text-xl font-bold text-green-700">
                £{data.totalImpact.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            {!emailSent && !showEmailForm && (
              <button
                onClick={handleEmailConfirmation}
                disabled={!canSendReceipt}
                className="w-full min-h-[48px] rounded-full bg-green-700 hover:bg-green-800 active:bg-green-900 text-white font-medium text-base tracking-wide flex items-center justify-center gap-2 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Mail className="w-4 h-4" />
                Send Receipt to Email
              </button>
            )}

            {showEmailForm && !emailSent && (
              <div className="border border-green-200 rounded-2xl px-4 py-4 bg-green-50/70 space-y-3">
                <div className="space-y-1">
                  <label
                    htmlFor="receipt-email"
                    className="block text-sm font-medium text-gray-800"
                  >
                    Email address
                  </label>
                  <input
                    id="receipt-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    disabled={isSendingEmail}
                    className="w-full min-h-[48px] rounded-xl border border-green-200 bg-white px-4 text-sm text-gray-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 disabled:bg-gray-100"
                  />
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">
                  We'll only use this email to send your receipt and contact you regarding this
                  donation.
                </p>

                {emailError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-sm text-red-700">{emailError}</p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSendReceipt}
                  disabled={isSendingEmail}
                  className="w-full min-h-[48px] rounded-full bg-green-700 hover:bg-green-800 active:bg-green-900 text-white font-medium text-base tracking-wide flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSendingEmail ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send Receipt
                    </>
                  )}
                </button>
              </div>
            )}

            {emailSent && (
              <div className="border border-green-200 rounded-2xl px-4 py-3 bg-green-50">
                <p className="text-sm text-green-800 text-center">
                  Receipt sent to <span className="font-medium">{email}</span>.
                </p>
              </div>
            )}

            {!canSendReceipt && !emailSent && !showEmailForm && (
              <p className="text-xs text-center text-gray-500">
                Receipt email is unavailable for this session because the donation reference is
                missing.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
