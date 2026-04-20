import { useState, FormEvent, ChangeEvent } from 'react';
import { createThankYouMail } from '../../shared/api';
import { Mail, Send, Home, CheckCircle } from 'lucide-react';

interface EmailConfirmationScreenProps {
  transactionId?: string;
  receiptReferenceId?: string;
  campaignName?: string;
  initialEmail?: string;
  accentColorHex?: string;
  onComplete: () => void;
}

export function EmailConfirmationScreen({
  transactionId,
  receiptReferenceId,
  campaignName,
  initialEmail = '',
  accentColorHex,
  onComplete,
}: EmailConfirmationScreenProps) {
  const accentColor =
    typeof accentColorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentColorHex.trim())
      ? accentColorHex.trim().toUpperCase()
      : '#0E8F5A';
  const accentSoft = `${accentColor}14`;
  const accentBorder = `${accentColor}33`;
  const [email, setEmail] = useState(initialEmail);
  const [isSending, setIsSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    setError(null);

    try {
      await createThankYouMail(email, campaignName, receiptReferenceId || transactionId);
      setEmailSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (message.toLowerCase().includes('donation is still processing')) {
        setError('Your donation is still being finalized. Please retry in a few seconds.');
      } else {
        console.error('Error sending receipt email:', err);
        setError('There was an issue sending your receipt. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (emailSent) {
    return (
      <div
        className="min-h-screen flex flex-col relative overflow-hidden"
        style={{ background: `linear-gradient(to bottom, ${accentSoft}, #ffffff, ${accentSoft})` }}
      >
        <div
          className="absolute -top-24 right-0 h-80 w-80 rounded-full blur-3xl opacity-70"
          style={{ backgroundColor: `${accentColor}22` }}
        />
        <div
          className="absolute top-1/3 -left-24 h-72 w-72 rounded-full blur-3xl opacity-60"
          style={{ backgroundColor: `${accentColor}1A` }}
        />
        <div
          className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full blur-3xl opacity-90"
          style={{ backgroundColor: `${accentColor}12` }}
        />

        <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-8">
          <div className="w-full max-w-xl">
            <div
              className="bg-white/90 rounded-3xl shadow-xl overflow-hidden"
              style={{ border: `1px solid ${accentBorder}` }}
            >
              {/* Success Header */}
              <div
                className="text-white px-6 py-5 text-center"
                style={{ backgroundColor: accentColor }}
              >
                <div className="flex justify-center mb-3">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold mb-1">Email Sent!</h2>
                <p className="text-white/85">Your receipt has been sent to {email}</p>
              </div>

              <div className="p-8 lg:p-10">
                {/* Message */}
                <div className="text-center mb-8">
                  <p className="text-gray-600 leading-relaxed">
                    Please check your email inbox for the receipt. If you don't see it, please check
                    your spam folder.
                  </p>
                </div>

                {/* Action Button */}
                <button
                  onClick={onComplete}
                  className="w-full h-14 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all hover:brightness-95"
                  style={{ backgroundColor: accentColor }}
                >
                  <Home className="w-5 h-5" />
                  Back to Campaigns
                </button>

                {/* Footer Message */}
                <div className="mt-8 text-center">
                  <p className="text-sm text-gray-500">Thank you for your donation!</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{ background: `linear-gradient(to bottom, ${accentSoft}, #ffffff, ${accentSoft})` }}
    >
      <div
        className="absolute -top-24 right-0 h-80 w-80 rounded-full blur-3xl opacity-70"
        style={{ backgroundColor: `${accentColor}22` }}
      />
      <div
        className="absolute top-1/3 -left-24 h-72 w-72 rounded-full blur-3xl opacity-60"
        style={{ backgroundColor: `${accentColor}1A` }}
      />
      <div
        className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full blur-3xl opacity-90"
        style={{ backgroundColor: `${accentColor}12` }}
      />

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-xl">
          <div
            className="bg-white/90 rounded-3xl shadow-xl overflow-hidden"
            style={{ border: `1px solid ${accentBorder}` }}
          >
            {/* Header */}
            <div
              className="text-white px-6 py-5 text-center"
              style={{ backgroundColor: accentColor }}
            >
              <div className="flex justify-center mb-3">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center shadow-lg">
                  <Mail className="w-9 h-9" />
                </div>
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold mb-1">Send Receipt</h2>
              <p className="text-white/85">
                Would you like to receive a donation receipt by email?
              </p>
            </div>

            <div className="p-8 lg:p-10">
              <form onSubmit={handleSubmit}>
                {/* Transaction ID */}
                {transactionId && (
                  <div
                    className="mb-6 p-4 rounded-2xl text-center"
                    style={{
                      backgroundColor: `${accentColor}12`,
                      border: `1px solid ${accentColor}33`,
                    }}
                  >
                    <p className="text-sm mb-1" style={{ color: accentColor }}>
                      Transaction Id
                    </p>
                    <p className="font-mono text-sm text-[#0A0A0A] break-all">{transactionId}</p>
                  </div>
                )}
                {campaignName && (
                  <div
                    className="mb-6 p-4 rounded-2xl text-center"
                    style={{
                      backgroundColor: `${accentColor}12`,
                      border: `1px solid ${accentColor}33`,
                    }}
                  >
                    <p className="text-sm mb-1" style={{ color: accentColor }}>
                      Campaign
                    </p>
                    <p className="text-sm text-[#0A0A0A] wrap-break-word">{campaignName}</p>
                  </div>
                )}

                {/* Email Input */}
                <div className="mb-6">
                  <label htmlFor="email" className="block text-sm font-medium text-[#0A0A0A] mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                    required
                    disabled={isSending}
                    className="w-full h-14 px-4 text-lg border-2 rounded-xl focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed bg-white"
                    style={{ borderColor: accentBorder }}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    We'll only use this email to send your receipt
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <p className="text-sm text-red-700 text-center">{error}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-4">
                  <button
                    type="submit"
                    disabled={isSending || !email}
                    className="w-full h-14 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-95"
                    style={{ backgroundColor: accentColor }}
                  >
                    {isSending ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Receipt
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={isSending}
                    className="w-full max-w-md mx-auto h-16 rounded-xl font-semibold text-lg border-2 flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      borderColor: accentBorder,
                      color: accentColor,
                      backgroundColor: `${accentColor}0A`,
                    }}
                  >
                    Skip Email Receipt
                  </button>
                </div>

                {/* Footer Message */}
                <div className="mt-8 text-center">
                  <p className="text-sm text-gray-500">
                    Your donation has been successfully processed. Email receipt is optional.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
