import React, { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { Button } from '../../shared/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../shared/ui/alert';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

interface PaymentFormProps {
  loading: boolean;
  error: string | null;
  onSubmit: () => Promise<void>;
  accentColorHex?: string;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ loading, error, onSubmit, accentColorHex }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const accentColor =
    typeof accentColorHex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(accentColorHex.trim())
      ? accentColorHex.trim().toUpperCase()
      : '#0E8F5A';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) {
      return;
    }
    if (submitting || loading) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit();
      // On success, keep submitting=true until navigation/unmount.
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className="border p-3 rounded-xl bg-white shadow-sm"
        style={{ borderColor: `${accentColor}55` }}
      >
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#333',
                iconColor: accentColor,
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
              invalid: {
                color: '#fa755a',
                iconColor: '#fa755a',
              },
            },
          }}
        />
      </div>
      <Button
        type="submit"
        disabled={!stripe || loading || submitting}
        className="w-full min-w-full h-14 text-white text-[17px] font-semibold hover:brightness-95"
        style={{ backgroundColor: accentColor }}
      >
        {loading || submitting ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Processing...
          </span>
        ) : (
          'Pay Now'
        )}
      </Button>
      {error && (
        <Alert variant="destructive">
          <ExclamationTriangleIcon className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
};

export default PaymentForm;
