'use client';

import React, { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Mail, ArrowLeft, Info } from 'lucide-react';

export function ManageCheckEmailScreen() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email') || '';
  const [resending, setResending] = useState(false);

  // Mask email for privacy (show first 4 chars and domain)
  const maskEmail = (email: string) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const maskedLocal = local.length > 4 ? local.substring(0, 4) + '***' : local;
    return `${maskedLocal}@${domain}`;
  };

  const handleResend = async () => {
    setResending(true);
    try {
      // TODO: Call API to resend magic link
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Error resending magic link:', err);
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] flex items-center justify-center px-4 py-6 sm:p-4">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <Card className="shadow-sm bg-white">
          <CardHeader className="text-center space-y-3 sm:space-y-4 pb-5 sm:pb-6 px-4 sm:px-6 pt-5 sm:pt-6">
            <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-blue-100 mx-auto">
              <Mail className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-xl sm:text-2xl font-bold mb-1.5 sm:mb-2 text-gray-900">
                Check your email
              </CardTitle>
              <CardDescription className="text-sm sm:text-base text-gray-600">
                We've sent a secure link to
                <br />
                <span className="font-medium text-gray-900">{maskEmail(email)}</span>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6 pb-4 sm:pb-6">
            {/* Info Notice */}
            <div className="flex items-start gap-2.5 sm:gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Info className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-gray-600">
                The link expires in 15 minutes and can be used once.
              </p>
            </div>

            {/* Resend Button */}
            <Button
              variant="outline"
              className="w-full h-11 sm:h-12 text-base"
              onClick={handleResend}
              disabled={resending}
            >
              {resending ? 'Sending...' : 'Resend link'}
            </Button>

            {/* Back to Login */}
            <button
              onClick={() => router.push('/manage')}
              className="w-full flex items-center justify-center gap-2 text-sm text-emerald-600 hover:underline font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
