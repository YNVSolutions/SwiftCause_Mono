import { useState } from 'react';
import { Button } from '../../shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/card';
import {
  CreditCard,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Building2,
  Mail,
  Calendar,
  DollarSign,
} from 'lucide-react';
import { useOrganization } from '../../shared/lib/hooks/useOrganization';
import { AdminSession, Screen, Permission } from '../../shared/types';
import { AdminLayout } from './AdminLayout';
import { StripeOnboardingDialog } from '../../features/stripe-onboarding';
import { auth } from '../../shared/lib/firebase';
import { useToast } from '../../shared/ui/ToastProvider';
import { AdminPageError, AdminPageLoader } from './components/AdminPageStatus';

interface BankDetailsProps {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  userSession: AdminSession;
  hasPermission: (permission: Permission) => boolean;
}

export function BankDetails({
  onNavigate,
  onLogout,
  userSession,
  hasPermission,
}: BankDetailsProps) {
  const {
    organization,
    loading: orgLoading,
    error: orgError,
  } = useOrganization(userSession.user.organizationId ?? null);
  const [showOnboardingDialog, setShowOnboardingDialog] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const { showToast } = useToast();

  const handleDirectStripeOnboarding = async () => {
    if (!organization?.id) {
      showToast('Organization ID not available for Stripe onboarding.', 'error');
      return;
    }

    if (!auth.currentUser) {
      showToast('No authenticated user found. Please log in again.', 'error');
      return;
    }

    try {
      setIsOnboarding(true);
      const idToken = await auth.currentUser.getIdToken();

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(
        `https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/createOnboardingLink`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({ orgId: organization.id }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || response.statusText || 'Failed to create onboarding link.',
        );
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No onboarding URL received from server.');
      }
    } catch (error: unknown) {
      console.error('Error creating Stripe onboarding link:', error);

      const isAbortError = error instanceof Error && error.name === 'AbortError';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (isAbortError) {
        showToast('Request timed out. Please check your connection and try again.', 'error', 4000);
      } else {
        showToast(`Failed to start Stripe onboarding: ${errorMessage}`, 'error', 4000);
      }
      setIsOnboarding(false);
    }
  };

  if (orgLoading) {
    return (
      <AdminLayout
        onNavigate={onNavigate}
        onLogout={onLogout}
        userSession={userSession}
        hasPermission={hasPermission}
        activeScreen="admin-bank-details"
      >
        <AdminPageLoader message="Loading bank details..." />
      </AdminLayout>
    );
  }

  if (orgError) {
    return (
      <AdminLayout
        onNavigate={onNavigate}
        onLogout={onLogout}
        userSession={userSession}
        hasPermission={hasPermission}
        activeScreen="admin-bank-details"
      >
        <AdminPageError
          title="Unable To Load Bank Details"
          message={`Error loading organization data: ${orgError}`}
        />
      </AdminLayout>
    );
  }

  const chargesEnabled = organization?.stripe?.chargesEnabled;
  const payoutsEnabled = organization?.stripe?.payoutsEnabled;

  const isStripeSetup = chargesEnabled === true || payoutsEnabled === true;

  return (
    <AdminLayout
      onNavigate={onNavigate}
      onLogout={onLogout}
      userSession={userSession}
      hasPermission={hasPermission}
      activeScreen="admin-bank-details"
      headerTitle={
        <div className="flex flex-col">
          {userSession.user.organizationName && (
            <div className="flex items-center gap-1.5 mb-1">
              <Building2 className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 tracking-wide">
                {userSession.user.organizationName}
              </span>
            </div>
          )}
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Bank Details</h1>
        </div>
      }
      headerSubtitle="Manage your payment settings and Stripe integration"
    >
      <div className="px-6 lg:px-8 pt-12 pb-8 max-w-6xl mx-auto space-y-8">
        {/* Stripe Account Status Card */}
        <Card className="border-2">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-2xl">Stripe Account Status</CardTitle>
                <CardDescription className="text-base">
                  Review the current status of your Stripe integration.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {!chargesEnabled && !payoutsEnabled ? (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-2">Account Not Set Up</h3>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        Your Stripe account is not set up yet. Complete the setup to accept
                        donations and receive payouts.
                      </p>
                    </div>
                  </div>
                </div>
                <Button
                  onClick={handleDirectStripeOnboarding}
                  disabled={isOnboarding}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 h-12 text-base font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isOnboarding ? (
                    <>
                      <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                      Redirecting to Stripe...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 mr-2" />
                      Setup Stripe Account
                    </>
                  )}
                </Button>
              </>
            ) : chargesEnabled && !payoutsEnabled ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <RefreshCw className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Under Review</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Your Stripe account is being reviewed. Payouts will be enabled shortly. You
                      can already accept donations.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Account Setup Successfully</h3>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Your Stripe account is fully configured and ready to accept donations and
                      process payouts.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stripe Account Details */}
            {isStripeSetup && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <CheckCircle
                    className={`w-5 h-5 ${chargesEnabled ? 'text-green-600' : 'text-gray-400'}`}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Charges</p>
                    <p className="text-xs text-gray-500">
                      {chargesEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <CheckCircle
                    className={`w-5 h-5 ${payoutsEnabled ? 'text-green-600' : 'text-gray-400'}`}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Payouts</p>
                    <p className="text-xs text-gray-500">
                      {payoutsEnabled ? 'Enabled' : 'Disabled'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Organization Details Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Organization Details</CardTitle>
                <CardDescription>Your organization information</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Building2 className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Organization Name</p>
                  <p className="text-sm text-gray-900">{organization?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Mail className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Admin Email</p>
                  <p className="text-sm text-gray-900">{userSession.user.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <DollarSign className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Currency</p>
                  <p className="text-sm text-gray-900">{organization?.currency || 'USD'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <Calendar className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Member Since</p>
                  <p className="text-sm text-gray-900">
                    {userSession.user.createdAt
                      ? new Date(userSession.user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stripe Onboarding Dialog */}
      <StripeOnboardingDialog
        open={showOnboardingDialog}
        onOpenChange={setShowOnboardingDialog}
        organization={organization}
        loading={orgLoading}
      />
    </AdminLayout>
  );
}
