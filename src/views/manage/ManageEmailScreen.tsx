'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/ui/button';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card';
import { Mail, HandHeart, ArrowRight, Lock } from 'lucide-react';

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
      // TODO: Call API to send magic link

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Redirect to confirmation page
      router.push(`/manage/check-email?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError('Failed to send access link. Please try again.');
      console.error('Error sending magic link:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#EEEFF3] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <Card className="shadow-lg border-0 bg-white rounded-2xl">
          <CardHeader className="text-center space-y-4 pb-6 px-6 pt-12">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#7FDBCA] mx-auto">
              <HandHeart className="w-10 h-10 text-gray-800" strokeWidth={1.5} />
            </div>

            {/* Title and Description */}
            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-gray-900">
                Manage Your Donations
              </CardTitle>
              <CardDescription className="text-base text-gray-600 leading-relaxed">
                We'll email you a one-time secure link to access your donations.
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="px-6 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-xs font-semibold text-gray-700 uppercase tracking-wide"
                >
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="pl-12 h-14 bg-[#E8EAF6] border-0 text-base placeholder:text-gray-400 rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-500"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
              )}

              <Button
                type="submit"
                className="w-full h-14 bg-[#047857] hover:bg-[#065f46] text-white font-semibold text-base rounded-full shadow-md"
                disabled={loading}
              >
                {loading ? (
                  'Sending...'
                ) : (
                  <>
                    Send secure access link
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            {/* Security Notice */}
            <div className="mt-6 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <Lock className="w-4 h-4" />
                <span>No password required. Powered by secure authentication.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
