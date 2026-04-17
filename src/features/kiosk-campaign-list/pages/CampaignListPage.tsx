import React from 'react';
import { LogOut } from 'lucide-react';
import { CampaignListPageProps } from '../types';
import {
  LoadingState,
  ErrorState,
  EmptyState,
  CampaignGrid,
  CampaignListLayout,
  CampaignCarousel,
} from '../components';
import { resolveAccentColor } from '../lib/brandUtils';

/**
 * Pure presentational component for the Campaign List page.
 * Receives all state and callbacks as props - no business logic here.
 *
 * Layout behavior:
 * - Large screens (lg+): Always shows grid layout
 * - Small screens: Shows layout based on kiosk settings (grid/list/carousel)
 */
export const CampaignListPage: React.FC<CampaignListPageProps> = ({
  state,
  kioskSession,
  organizationBranding,
  onSelectCampaign,
  onViewDetails,
  onLogout,
}) => {
  const { campaigns, loading, error, layoutMode } = state;
  const currency = kioskSession?.organizationCurrency || 'GBP';
  const accentColor = resolveAccentColor(organizationBranding?.accentColorHex);
  const brandDisplayName = organizationBranding?.displayName || 'SwiftCause';
  const brandLogo = organizationBranding?.logoUrl || '/logo.png';
  const idleImageUrl = organizationBranding?.idleImageUrl || null;
  const [isIdleScreenVisible, setIsIdleScreenVisible] = React.useState(false);

  React.useEffect(() => {
    if (!idleImageUrl) {
      setIsIdleScreenVisible(false);
      return;
    }

    const idleTimeoutMs = 60_000;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleIdle = () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(() => {
        setIsIdleScreenVisible(true);
      }, idleTimeoutMs);
    };

    const handleInteraction = () => {
      if (isIdleScreenVisible) {
        setIsIdleScreenVisible(false);
      }
      scheduleIdle();
    };

    const interactionEvents: Array<keyof WindowEventMap> = [
      'pointerdown',
      'mousemove',
      'touchstart',
      'keydown',
      'scroll',
    ];

    scheduleIdle();
    interactionEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleInteraction);
    });

    return () => {
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      interactionEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleInteraction);
      });
    };
  }, [idleImageUrl, isIdleScreenVisible]);

  // Loading state
  if (loading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  // Main content
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f8faf9] via-[#f0f5f3] to-[#e8f0ed] flex flex-col">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -top-24 right-0 h-80 w-80 rounded-full bg-green-100 blur-3xl opacity-70" />
      <div className="pointer-events-none absolute top-1/3 -left-24 h-72 w-72 rounded-full bg-emerald-100 blur-3xl opacity-60" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-green-50 blur-3xl opacity-90" />

      {/* Invisible Header: Left / Center / Right */}
      <header className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-6 sm:pt-8 pb-6">
        <div className="md:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img
                src={brandLogo}
                alt={brandDisplayName}
                className="h-10 w-10 rounded-lg object-cover"
              />
              <div className="text-xl font-semibold text-slate-900">{brandDisplayName}</div>
            </div>
            {onLogout && (
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-full border bg-transparent px-3 py-2 text-sm font-medium transition-colors"
                style={{ borderColor: accentColor, color: accentColor }}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            )}
          </div>
          <div className="mt-5 text-center">
            <h1 className="text-4xl font-bold text-slate-900 mb-3 tracking-tight">
              Choose a cause
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-md mx-auto">
              Support meaningful causes and help create lasting impact.
            </p>
          </div>
        </div>

        <div className="hidden md:grid grid-cols-[1fr_auto_1fr] items-start">
          <div className="justify-self-start flex items-center gap-3">
            <img
              src={brandLogo}
              alt={brandDisplayName}
              className="h-11 w-11 rounded-lg object-cover"
            />
            <div className="text-2xl font-semibold text-slate-900">{brandDisplayName}</div>
          </div>

          <div className="justify-self-center text-center">
            <h1 className="text-4xl font-bold text-slate-900 mb-3 tracking-tight">
              Choose a cause
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-2xl text-center">
              Support meaningful causes and help create lasting impact.
            </p>
          </div>

          <div className="justify-self-end">
            {onLogout && (
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-2 rounded-full border bg-transparent px-4 py-2 text-sm font-medium transition-colors"
                style={{ borderColor: accentColor, color: accentColor }}
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Campaign Grid */}
      <main className="relative z-10 flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 md:px-8 lg:px-12 pb-16">
        {campaigns.length === 0 ? (
          <EmptyState kioskName={kioskSession?.kioskName} />
        ) : (
          <>
            {/* Large screens: Always grid */}
            <div className="hidden lg:block">
              <CampaignGrid
                campaigns={campaigns}
                currency={currency}
                accentColorHex={accentColor}
                onSelectCampaign={onSelectCampaign}
                onViewDetails={onViewDetails}
              />
            </div>

            {/* Small screens: Layout based on kiosk settings */}
            <div className="lg:hidden">
              {layoutMode === 'carousel' && (
                <CampaignCarousel
                  campaigns={campaigns}
                  currency={currency}
                  accentColorHex={accentColor}
                  onSelectCampaign={onSelectCampaign}
                  onViewDetails={onViewDetails}
                />
              )}

              {layoutMode === 'list' && (
                <CampaignListLayout
                  campaigns={campaigns}
                  currency={currency}
                  accentColorHex={accentColor}
                  onSelectCampaign={onSelectCampaign}
                  onViewDetails={onViewDetails}
                />
              )}

              {layoutMode === 'grid' && (
                <CampaignGrid
                  campaigns={campaigns}
                  currency={currency}
                  accentColorHex={accentColor}
                  onSelectCampaign={onSelectCampaign}
                  onViewDetails={onViewDetails}
                />
              )}
            </div>
          </>
        )}
      </main>

      {isIdleScreenVisible && idleImageUrl ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsIdleScreenVisible(false)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              setIsIdleScreenVisible(false);
            }
          }}
          className="fixed inset-0 z-50 flex cursor-pointer items-end justify-center bg-black/60"
        >
          <img
            src={idleImageUrl}
            alt="Kiosk screensaver"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="relative mb-14 rounded-full bg-white/85 px-6 py-3 text-base font-medium text-slate-800 shadow-lg">
            Tap anywhere to continue
          </div>
        </div>
      ) : null}
    </div>
  );
};
