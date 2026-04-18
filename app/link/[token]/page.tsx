'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';

interface ValidationResult {
  valid: boolean;
  tokenId?: string;
  donationId?: string;
  campaignId?: string;
  amount?: number;
  currency?: string;
  purpose?: string;
  expiresAt?: string;
  error?: string;
}

export default function MagicLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter();
  const { token } = use(params);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    validateToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryCount]); // Re-run when retry count changes

  const validateToken = async () => {
    setValidating(true);
    setError(null);

    // Timeout configuration
    const TIMEOUT_MS = 10000; // 10 seconds
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), TIMEOUT_MS);

    try {
      // Call validation endpoint
      const response = await fetch(
        'https://us-central1-swiftcause-app.cloudfunctions.net/validateMagicLinkToken',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
          signal: abortController.signal,
        },
      );

      clearTimeout(timeoutId);

      // Parse JSON safely
      let data: ValidationResult;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        throw new Error('Invalid server response. Please try again.');
      }

      if (!response.ok || !data.valid) {
        // Handle validation errors
        const errorMessage = getErrorMessage(data.error || 'UNKNOWN_ERROR');
        setError(errorMessage);
        setValidating(false);
        return;
      }

      // Small delay for UX polish (show success state briefly)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Redirect to Gift Aid form with the plain token
      router.push(`/gift-aid?token=${token}`);
    } catch (err) {
      clearTimeout(timeoutId);

      // Handle specific error types
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.error('Request timed out');
          setError('The request took too long. Please check your connection and try again.');
        } else {
          console.error('Validation error:', err);
          setError(err.message);
        }
      } else {
        console.error('Unknown error:', err);
        setError('Unable to validate link. Please try again.');
      }

      setValidating(false);
    }
  };

  // Map error codes to user-friendly messages
  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'TOKEN_NOT_FOUND':
        return 'This link is invalid or has been removed.';
      case 'TOKEN_EXPIRED':
        return 'This link has expired. Please contact the charity for assistance.';
      case 'TOKEN_CONSUMED':
        return 'This link has already been used.';
      case 'TOKEN_BLOCKED':
        return 'This link has been blocked due to too many attempts.';
      case 'INVALID_REQUEST':
        return 'Invalid request. Please check the link and try again.';
      case 'INTERNAL_ERROR':
        return 'Server error. Please try again in a moment.';
      default:
        return 'This link is no longer valid.';
    }
  };

  // Retry handler
  const handleRetry = () => {
    setRetryCount((prev) => prev + 1);
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Validating your link...</h1>
          <p className="text-gray-600">Please wait a moment</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Invalid Link</h1>
          <p className="text-gray-600 mb-6">{error}</p>

          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-xl transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/campaigns')}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-6 rounded-xl transition-colors"
            >
              Browse Campaigns
            </button>
          </div>

          {retryCount > 0 && (
            <p className="text-sm text-gray-500 mt-4">Retry attempt: {retryCount}</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
