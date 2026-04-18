import { CheckCircle, XCircle, Mail, Home, RefreshCw } from 'lucide-react';
import { PaymentResult } from '../../shared/types';

interface ResultScreenProps {
  result: PaymentResult;
  onEmailConfirmation?: () => void;
  onReturnToStart: () => void;
  onRetry?: () => void;
}

export function ResultScreen({
  result,
  onEmailConfirmation,
  onReturnToStart,
  onRetry,
}: ResultScreenProps) {
  if (result.success) {
    return (
      <div className="min-h-screen flex flex-col bg-linear-to-b from-green-50 via-white to-emerald-50/70 relative overflow-hidden">
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-green-100 blur-3xl opacity-70" />
        <div className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-emerald-100 blur-3xl opacity-60" />
        <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-green-50 blur-3xl opacity-90" />

        <header className="relative z-10 max-w-6xl mx-auto px-6 lg:px-12 xl:px-16 py-4">
          <style>{`
            .result-hero-title {
              display: inline-flex;
              align-items: center;
              gap: 10px;
              font-weight: 700;
              letter-spacing: -0.02em;
              background: linear-gradient(90deg, #064e3b, #0f5132, #0EA5E9);
              background-size: 200% 100%;
              -webkit-background-clip: text;
              background-clip: text;
              color: transparent;
              animation: resultTitleGlow 4.5s ease-in-out infinite;
            }
            .result-hero-subtitle {
              font-size: 0.95rem;
              color: #374151;
              margin-top: 2px;
            }
            @keyframes resultTitleGlow {
              0%, 100% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
            }
            @keyframes resultPulse {
              0%, 100% { transform: scale(0.85); opacity: 0.6; }
              50% { transform: scale(1.1); opacity: 1; }
            }
          `}</style>
          <div className="text-left">
            <h1 className="text-xl sm:text-2xl result-hero-title">Donation Complete</h1>
            <p className="text-sm result-hero-subtitle">Your generosity has been received.</p>
          </div>
        </header>

        <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-8">
          <div className="w-full max-w-xl">
            <div className="bg-white/90 rounded-3xl border border-green-100 shadow-xl overflow-hidden">
              {/* Success Header */}
              <div className="bg-linear-to-r from-green-600 to-emerald-600 text-white px-6 py-5 text-center">
                <div className="flex justify-center mb-3">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-10 h-10" />
                  </div>
                </div>
                <h2 className="text-2xl lg:text-3xl font-bold mb-1">Thank You!</h2>
                <p className="text-white/85">Your donation has been processed successfully.</p>
              </div>

              <div className="p-8 lg:p-10">
                {/* Transaction ID */}
                {result.transactionId && (
                  <div className="mb-6 p-4 bg-green-50/70 border border-green-100 rounded-2xl text-center">
                    <p className="text-sm text-green-700 mb-1">Transaction ID</p>
                    <p className="font-mono text-sm text-[#0A0A0A] break-all">
                      {result.transactionId}
                    </p>
                  </div>
                )}

                {/* Customer ID (for recurring donations only) */}
                {result.customerId && (
                  <div className="mb-6 p-4 bg-blue-50/70 border border-blue-100 rounded-2xl text-center">
                    <p className="text-sm text-blue-700 mb-1">Customer ID</p>
                    <p className="font-mono text-sm text-[#0A0A0A] break-all">
                      {result.customerId}
                    </p>
                  </div>
                )}

                {/* Message */}
                <div className="text-center mb-8">
                  <p className="text-gray-600 leading-relaxed">
                    Your generosity is making a real difference. A receipt has been generated and
                    you can optionally send it to your email.
                  </p>
                </div>

                {/* Magic Link (if available) */}
                {result.magicLinkToken && (
                  <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl">
                    <div className="text-center mb-3">
                      <p className="text-sm font-semibold text-blue-900 mb-1">
                        📱 Complete Gift Aid on Your Phone
                      </p>
                      <p className="text-xs text-blue-700">
                        Click the link below to add Gift Aid and increase your donation by 25%
                      </p>
                    </div>
                    <a
                      href={`/gift-aid?token=${result.magicLinkToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full p-4 bg-white border-2 border-blue-300 rounded-xl text-center hover:bg-blue-50 hover:border-blue-400 transition-all group"
                    >
                      <p className="text-blue-600 font-medium group-hover:text-blue-700 break-all text-sm">
                        {window.location.origin}/gift-aid?token=
                        {result.magicLinkToken.substring(0, 20)}...
                      </p>
                      <p className="text-xs text-blue-500 mt-1">Click to open Gift Aid form</p>
                    </a>
                    <p className="text-xs text-gray-500 text-center mt-2">
                      ⏱️ Link available for 2 minutes • Expires in 30 days after first use
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-4">
                  {onEmailConfirmation && (
                    <button
                      onClick={onEmailConfirmation}
                      className="w-full h-14 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-200/70"
                    >
                      <Mail className="w-5 h-5" />
                      Send Receipt to Email
                    </button>
                  )}

                  <button
                    onClick={onReturnToStart}
                    className="w-full max-w-md mx-auto h-16 rounded-xl font-semibold text-lg border-2 border-green-200 text-green-800 flex items-center justify-center gap-2 hover:bg-green-50 transition-colors"
                  >
                    <Home className="w-5 h-5" />
                    Return to Campaigns
                  </button>
                </div>

                {/* Footer Message */}
                <div className="mt-8 text-center">
                  <p className="text-sm text-gray-500">Thank you for using our donation kiosk.</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Failed state
  return (
    <div className="min-h-screen flex flex-col bg-linear-to-b from-green-50 via-white to-emerald-50/70 relative overflow-hidden">
      <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-green-100 blur-3xl opacity-70" />
      <div className="absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-emerald-100 blur-3xl opacity-60" />
      <div className="absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-green-50 blur-3xl opacity-90" />

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 pb-8">
        <div className="w-full max-w-xl">
          <div className="bg-white/90 rounded-3xl border border-green-100 shadow-xl overflow-hidden">
            {/* Error Header */}
            <div className="bg-linear-to-r from-red-500 to-rose-500 text-white px-6 py-5 text-center">
              <div className="flex justify-center mb-3">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center shadow-lg">
                  <XCircle className="w-10 h-10" />
                </div>
              </div>
              <h2 className="text-2xl lg:text-3xl font-bold mb-1">Payment Failed</h2>
              <p className="text-white/85">We encountered an issue processing your donation.</p>
            </div>

            <div className="p-8 lg:p-10">
              {/* Error Message */}
              {result.error && (
                <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <p className="text-sm text-red-700 text-center">{result.error}</p>
                </div>
              )}

              {/* Common Reasons */}
              <div className="mb-8">
                <p className="text-gray-600 text-center mb-4">
                  Common reasons for payment failure:
                </p>
                <ul className="text-gray-500 text-sm space-y-2">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    Insufficient funds
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    Incorrect card information
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    Card expired or blocked
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                    Network connectivity issues
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="space-y-4">
                <button
                  onClick={onRetry || onReturnToStart}
                  className="w-full max-w-md mx-auto h-14 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-200/70"
                >
                  <RefreshCw className="w-5 h-5" />
                  Try Again
                </button>

                <button
                  onClick={onReturnToStart}
                  className="w-full max-w-md mx-auto h-16 rounded-xl font-semibold text-lg border-2 border-green-200 text-green-800 flex items-center justify-center gap-2 hover:bg-green-50 transition-colors"
                >
                  <Home className="w-5 h-5" />
                  Return to Campaigns
                </button>
              </div>

              {/* Support Info */}
              <div className="mt-8 text-center">
                <p className="text-sm text-gray-500">
                  If you continue to experience issues, please contact support.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
