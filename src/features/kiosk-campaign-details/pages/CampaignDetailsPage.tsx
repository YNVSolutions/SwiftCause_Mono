import React, { useState, useEffect, useRef } from 'react';
import { formatCurrency, formatCurrencyFromMajor } from '@/shared/lib/currencyFormatter';
import { ArrowLeft } from 'lucide-react';
import { CampaignDetailsPageProps } from '../types';
import {
  ImageCarousel,
  AmountSelector,
  DonateButton,
  VideoPlayer,
  LoadingState,
  ErrorState,
} from '../components';

/**
 * Pure presentational component for the Campaign Details page.
 * Two-column layout (3:2): Left (images + long description), Right (title + description + progress + amounts + video)
 */
export const CampaignDetailsPage: React.FC<CampaignDetailsPageProps> = ({
  state,
  currency,
  donorEmail = '',
  donorName = '',
  onBack,
  onSelectAmount,
  onCustomAmountChange,
  onRecurringToggle,
  onRecurringIntervalChange,
  onDonate,
  onImageChange,
  onDonorEmailChange,
  onDonorNameChange,
}) => {
  const {
    campaign,
    loading,
    error,
    selectedAmount,
    customAmount,
    currentImageIndex,
    isRecurring,
    recurringInterval,
  } = state;

  // Ref for the donation panel to measure its height
  const donationPanelRef = useRef<HTMLDivElement>(null);
  const [donationPanelHeight, setDonationPanelHeight] = useState(350); // Default height

  // Measure donation panel height and update bottom spacing
  useEffect(() => {
    const measurePanelHeight = () => {
      if (donationPanelRef.current) {
        const height = donationPanelRef.current.offsetHeight;
        // Add some extra padding (20px) for better spacing
        setDonationPanelHeight(height + 20);
      }
    };

    // Measure initially
    measurePanelHeight();

    // Measure when content changes (recurring state, selected amounts, etc.)
    const observer = new ResizeObserver(measurePanelHeight);
    if (donationPanelRef.current) {
      observer.observe(donationPanelRef.current);
    }

    // Also measure on state changes that might affect height
    const timeoutId = setTimeout(measurePanelHeight, 100);

    return () => {
      observer.disconnect();
      clearTimeout(timeoutId);
    };
  }, [isRecurring, selectedAmount, customAmount, recurringInterval]); // Re-measure when these change

  // Loading state
  if (loading) {
    return <LoadingState />;
  }

  // Error state
  if (error) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  // No campaign
  if (!campaign) {
    return <ErrorState message="Campaign not found" onRetry={onBack} />;
  }

  // Get gallery images - use galleryImages first, then coverImageUrl as fallback
  const galleryImages =
    campaign.galleryImages && campaign.galleryImages.length > 0
      ? campaign.galleryImages
      : campaign.coverImageUrl
        ? [campaign.coverImageUrl]
        : [];

  // Get predefined amounts
  const predefinedAmounts = campaign.configuration?.predefinedAmounts || [10, 25, 100];
  const enableRecurring = campaign.configuration?.enableRecurring ?? true; // Default to true
  const recurringIntervals = (campaign.configuration?.recurringIntervals?.length
    ? campaign.configuration.recurringIntervals
    : ['monthly', 'quarterly', 'yearly']) as ('monthly' | 'quarterly' | 'yearly')[];
  const fallbackImage = campaign.coverImageUrl || '/campaign-fallback.svg';

  // Calculate progress — raised is in pence (minor units), goal is in pounds (major units)
  const progress =
    campaign.goal > 0 ? Math.min((((campaign.raised || 0) / 100) / campaign.goal) * 100, 100) : 0;

  // Format amount without decimals
  const formatAmount = (amount: number) => formatCurrency(amount, currency);
  const formatGoal = (amount: number) => formatCurrencyFromMajor(amount, currency);

  // Description to show below images (long description if available, else short)
  const belowImageDescription = campaign.longDescription || campaign.description;

  // Parse and render description safely (supports HTML from SimpleRichEditor: <strong>, <em>, <hr>)
  const renderDescription = (text: string) => {
    if (!text) return null;

    // Clean and sanitize the HTML content
    const cleanHtml = text
      .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframes
      .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
      .trim();

    if (!cleanHtml) return null;

    // If it contains HTML tags, render as HTML
    if (/<[^>]+>/.test(cleanHtml)) {
      return (
        <div
          className="rich-text-content"
          dangerouslySetInnerHTML={{ __html: cleanHtml }}
        />
      );
    }

    // Fallback: Handle legacy format (**bold**, <br>, <hr>)
    const hrParts = text.split(/<hr\s*\/?>/gi);

    return hrParts.map((hrPart, hrIndex) => {
      const brParts = hrPart.split(/<br\s*\/?>/gi);

      const content = brParts.map((brPart, brIndex) => {
        const boldParts = brPart.split(/(\*\*.+?\*\*)/g);
        const rendered = boldParts.map((part, partIndex) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={partIndex}>{part.slice(2, -2)}</strong>;
          }
          return part;
        });

        return (
          <React.Fragment key={brIndex}>
            {brIndex > 0 && <br />}
            {rendered}
          </React.Fragment>
        );
      });

      return (
        <React.Fragment key={hrIndex}>
          {hrIndex > 0 && <hr className="my-4 border-gray-200" />}
          {content}
        </React.Fragment>
      );
    });
  };

  // Check if donate is enabled (has selected amount or custom amount)
  const hasValidAmount =
    (selectedAmount !== null && selectedAmount > 0) ||
    (customAmount && parseFloat(customAmount) > 0);

  return (
    <div className="min-h-screen flex flex-col bg-white relative font-lexend">
      <style>{`
        .kiosk-progress-bar {
          background-size: 200% 100%;
          animation: kioskProgressFlow 3.5s ease-in-out infinite;
        }
        .rich-text-content strong {
          font-weight: 600;
        }
        .rich-text-content em {
          font-style: italic;
        }
        .rich-text-content hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 12px 0;
        }
        .rich-text-content p {
          margin: 0 0 8px 0;
        }
        .rich-text-content p:last-child {
          margin-bottom: 0;
        }
        /* Hide scrollbar for webkit browsers */
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* Hide scrollbar for Firefox */
        .hide-scrollbar {
          scrollbar-width: none;
        }
        /* Soft fade for scrollable left column */
        .left-scroll-fade {
          position: relative;
        }
        .left-scroll-fade::after {
          content: "";
          position: sticky;
          left: 0;
          right: 0;
          height: 64px;
          z-index: 5;
          pointer-events: none;
          display: block;
        }
        .left-scroll-fade::after {
          bottom: 0;
          margin-bottom: -64px;
          background: linear-gradient(to top, #FFFBF7, rgba(255,251,247,0));
        }
        .desc-scroll-fade {
          position: relative;
          overflow-y: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .desc-scroll-fade::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <button
        onClick={onBack}
        className="absolute left-5 top-4 z-30 inline-flex items-center gap-2 text-[#0E8F5A] hover:text-[#0C8050] text-sm font-medium hover:underline underline-offset-4"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        Back
      </button>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Fixed header at top - only visible on mobile */}
        <header className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm">
          <div className="w-full px-4 h-11" />
        </header>

        {/* Desktop header - normal flow */}
        <header className="hidden lg:block w-full">
          <div className="w-5/6 mx-auto px-4 lg:px-0">
            <div className="h-12" />
          </div>
        </header>

      {/* Large screens: Two-column layout */}
      <main className="hidden lg:flex w-5/6 mx-auto py-4 flex-1 overflow-hidden">
        {/* 3:2 grid layout - full height */}
        <div className="grid grid-cols-5 gap-4 h-full w-full items-start">
          {/* Left Column (3/5): Scrollable - Image Carousel + Long Description */}
          <div className="col-span-3 space-y-3 overflow-y-auto pr-2 hide-scrollbar max-h-[calc(100vh-80px)] left-scroll-fade rounded-[22px] bg-[#FFFBF7]">
            {/* Image Carousel */}
            <div className="aspect-video max-h-[400px] w-full shrink-0 rounded-[22px] border border-gray-200/50 bg-[#FFFBF7] shadow-sm overflow-hidden">
              <ImageCarousel
                images={galleryImages}
                currentIndex={currentImageIndex}
                onIndexChange={onImageChange}
                fallbackImage={fallbackImage}
              />
            </div>

            {/* Description below images */}
            <div className="prose prose-gray max-w-none">
              <div className="rounded-[22px] border border-gray-200/50 bg-[#FFFBF7] shadow-sm px-4 py-3.5 text-slate-700 text-[15px] leading-[1.55] font-normal">
                {renderDescription(belowImageDescription)}
              </div>
            </div>
          </div>

          {/* Right Column (2/5): Fixed - Title + Description + Progress + Amounts + Video */}
          <div className="col-span-2 rounded-[18px] border border-gray-200/50 bg-[#FFFBF7] shadow-[0_10px_28px_rgba(15,23,42,0.08)] px-4 py-3.5 lg:sticky lg:top-0 h-fit pt-8">
            <div className="flex flex-col gap-3 max-h-[calc(100vh-120px)] overflow-y-auto pr-1 hide-scrollbar">
              {/* Title - Strongest text element */}
              <h1 className="text-[24px] font-semibold text-slate-900 leading-[1.3] tracking-[-0.01em]">
                {campaign.title}
              </h1>
              {campaign.description && (
                campaign.videoUrl ? (
                  <div className="desc-scroll-fade shrink-0 max-h-[170px] pr-1">
                    <p className="text-[15px] text-slate-700 leading-[1.55] max-w-[65ch] font-normal">
                      {campaign.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-[15px] text-slate-700 leading-[1.55] max-w-[65ch] font-normal">
                    {campaign.description}
                  </p>
                )
              )}

              {/* Progress Section */}
              <div className="space-y-1.5 rounded-xl border border-gray-200/50 bg-gray-100/50 px-3 py-2">
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Community support</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-[#0A0A0A] font-medium">
                    {formatAmount(campaign.raised || 0)} / {formatGoal(campaign.goal)}
                  </span>
                  <span className="text-[15px] text-[#0E8F5A] font-semibold">{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#0E8F5A] h-2 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {/* Amount Selector Label */}
              <div>
                <p className="text-[13px] font-medium text-slate-500 uppercase tracking-wider mb-1.5">Choose an amount</p>
                <AmountSelector
                  amounts={predefinedAmounts}
                  selectedAmount={selectedAmount}
                  customAmount={customAmount}
                  currency={currency}
                  enableRecurring={enableRecurring}
                  recurringIntervals={recurringIntervals}
                  isRecurring={isRecurring}
                  recurringInterval={recurringInterval}
                  donorEmail={donorEmail}
                  donorName={donorName}
                  onSelectAmount={onSelectAmount}
                  onCustomAmountChange={onCustomAmountChange}
                  onRecurringToggle={onRecurringToggle}
                  onRecurringIntervalChange={onRecurringIntervalChange}
                  onDonorEmailChange={onDonorEmailChange}
                  onDonorNameChange={onDonorNameChange}
                />
              </div>

              {/* Donate Button */}
              <div className="space-y-1">
                <DonateButton
                  disabled={!hasValidAmount}
                  onClick={onDonate}
                  label="Donate"
                />
                <p className="text-[12px] text-center text-slate-400 font-normal">Secure payment • Encrypted</p>
              </div>

              {/* Video Player */}
              {campaign.videoUrl && (
                <div className="pt-0.5">
                  <VideoPlayer videoUrl={campaign.videoUrl} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Small screens: Natural page scroll with fixed donate controls */}
      <div className="lg:hidden">
        {/* Main content - scrolls naturally with the page */}
        <div
          className="px-4 pt-14"
          style={{ paddingBottom: `${donationPanelHeight}px` }}
        >
          {/* Image Carousel */}
          <div className="aspect-video max-h-[260px] sm:max-h-[300px] md:max-h-[340px] mb-4 rounded-[18px] border border-gray-200/50 bg-[#FFFBF7] shadow-[0_10px_28px_rgba(15,23,42,0.08)] overflow-hidden">
            <ImageCarousel
              images={galleryImages}
              currentIndex={currentImageIndex}
              onIndexChange={onImageChange}
              fallbackImage={fallbackImage}
            />
          </div>

          {/* Title */}
          <h1 className="text-[24px] sm:text-[24px] font-semibold text-slate-900 leading-[1.3] mb-2 tracking-[-0.01em]">
            {campaign.title}
          </h1>
          {campaign.description && (
            <p className="text-[15px] text-slate-700 leading-[1.55] mb-3.5 font-normal">
              {campaign.description}
            </p>
          )}

          {/* Progress Section */}
          <div className="space-y-1.5 mb-4 rounded-xl border border-gray-200/50 bg-gray-100/50 px-3.5 py-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-[#0A0A0A] font-medium">
                {formatAmount(campaign.raised || 0)} / {formatGoal(campaign.goal)}
              </span>
              <span className="text-[15px] text-[#0E8F5A] font-medium">{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="kiosk-progress-bar bg-[#0E8F5A] h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Long Description */}
          <div className="prose prose-gray max-w-none mb-2">
            <div className="rounded-[18px] border border-gray-200/50 bg-[#FFFBF7] shadow-[0_10px_28px_rgba(15,23,42,0.08)] px-3.5 py-3 text-slate-700 text-[15px] leading-[1.55] font-normal">
              {renderDescription(belowImageDescription)}
            </div>
          </div>

          {/* Video Player */}
          {campaign.videoUrl && (
            <div className="mb-4">
              <VideoPlayer videoUrl={campaign.videoUrl} />
            </div>
          )}
        </div>
      </div>

      {/* Fixed donate controls - only visible on mobile, positioned relative to viewport */}
      <div
        ref={donationPanelRef}
        className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#FFFBF7] backdrop-blur-md border-t border-gray-200 px-4 py-3 space-y-3 shadow-[0_-12px_32px_rgba(15,23,42,0.08)]"
      >
        {/* Amount Selector */}
        <AmountSelector
          amounts={predefinedAmounts}
          selectedAmount={selectedAmount}
          customAmount={customAmount}
          currency={currency}
          enableRecurring={enableRecurring}
          recurringIntervals={recurringIntervals}
          isRecurring={isRecurring}
          recurringInterval={recurringInterval}
          donorEmail={donorEmail}
          donorName={donorName}
          onSelectAmount={onSelectAmount}
          onCustomAmountChange={onCustomAmountChange}
          onRecurringToggle={onRecurringToggle}
          onRecurringIntervalChange={onRecurringIntervalChange}
          onDonorEmailChange={onDonorEmailChange}
          onDonorNameChange={onDonorNameChange}
        />

        {/* Donate Button */}
        <DonateButton
          disabled={!hasValidAmount}
          onClick={onDonate}
          label="Donate"
        />
      </div>
      </div>
    </div>
  );
};
