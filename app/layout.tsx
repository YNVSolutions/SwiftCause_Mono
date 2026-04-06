import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/shared/lib/auth-provider';
import { ToastProvider } from '@/shared/ui/ToastProvider';
import { StripeProvider } from '@/shared/lib/stripe-provider';
import { ReactQueryProvider } from '@/shared/lib/query-provider';

export const metadata: Metadata = {
  title: 'SwiftCause',
  description: 'SwiftCause - Donation Platform',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-lexend">
      <body className="font-sans">
        <AuthProvider>
          <ToastProvider>
            <StripeProvider>
              <ReactQueryProvider>{children}</ReactQueryProvider>
            </StripeProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
