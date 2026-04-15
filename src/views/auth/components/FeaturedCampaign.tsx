import { useState, useEffect } from 'react';
import { Heart, Users, TrendingUp, Sparkles } from 'lucide-react';
import { formatCurrency, formatCurrencyFromMajor } from '../../../shared/lib/currencyFormatter';

// Campaign interface - matches your backend data structure
export interface Campaign {
  id: string | number;
  title: string;
  description?: string;
  raised: number;
  goal: number;
  supporters: number;
  category: string;
  isActive?: boolean;
  createdAt?: string;
  // Optional styling (can be removed when using real data)
  gradient?: string;
  accentColor?: string;
}

interface FeaturedCampaignProps {
  // Accept campaigns from parent component (future: from API)
  campaigns?: Campaign[];
  // Auto-rotate interval in milliseconds
  autoRotateInterval?: number;
  // Show navigation arrows
  showNavigation?: boolean;
}

// Mock data - REPLACE THIS with real API data in the future
const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 1,
    title: 'Medical Research Fund',
    description: 'Help us reach our goal and make a difference',
    raised: 8450,
    goal: 10000,
    supporters: 234,
    category: 'Healthcare',
    isActive: true,
    gradient: 'from-green-400/20 via-emerald-400/20 to-teal-400/20',
    accentColor: 'bg-green-500',
  },
  {
    id: 2,
    title: 'Education for All',
    description: 'Help us reach our goal and make a difference',
    raised: 6200,
    goal: 8000,
    supporters: 189,
    category: 'Education',
    isActive: true,
    gradient: 'from-emerald-400/20 via-teal-400/20 to-cyan-400/20',
    accentColor: 'bg-emerald-500',
  },
  {
    id: 3,
    title: 'Community Support',
    description: 'Help us reach our goal and make a difference',
    raised: 4800,
    goal: 6000,
    supporters: 156,
    category: 'Community',
    isActive: true,
    gradient: 'from-teal-400/20 via-cyan-400/20 to-green-400/20',
    accentColor: 'bg-teal-500',
  },
];

export function FeaturedCampaign({
  campaigns = MOCK_CAMPAIGNS,
  autoRotateInterval = 6000,
  showNavigation = true,
}: FeaturedCampaignProps) {
  const [activeCampaign, setActiveCampaign] = useState(0);

  // Auto-rotate campaigns
  useEffect(() => {
    if (campaigns.length <= 1) return;

    const interval = setInterval(() => {
      setActiveCampaign((prev) => (prev + 1) % campaigns.length);
    }, autoRotateInterval);

    return () => clearInterval(interval);
  }, [campaigns.length, autoRotateInterval]);

  // Handle empty campaigns
  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="w-full max-w-lg mx-auto mb-8 p-8 text-center text-gray-500">
        No active campaigns available
      </div>
    );
  }

  const campaign = campaigns[activeCampaign];
  const progress = (campaign.raised / campaign.goal) * 100;

  // Default gradient if not provided
  const gradient = campaign.gradient || 'from-green-400/20 via-emerald-400/20 to-teal-400/20';
  const accentColor = campaign.accentColor || 'bg-green-500';

  return (
    <div className="w-full max-w-lg mx-auto mb-8 animate-fade-in-delay-2">
      {/* Layered background effects */}
      <div className="relative">
        <div className="absolute -inset-4 bg-gradient-to-br from-green-100/40 to-emerald-100/40 rounded-3xl blur-2xl" />
        <div className="absolute -inset-2 bg-gradient-to-tr from-teal-100/30 to-green-100/30 rounded-2xl blur-xl" />

        {/* Main Card */}
        <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-green-100/50 overflow-hidden">
          {/* Animated gradient background */}
          <div
            className={`absolute inset-0 bg-gradient-to-br ${gradient} transition-all duration-1000`}
          />

          {/* Organic decorative shapes */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-green-300/20 to-emerald-300/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-32 h-32 bg-gradient-to-tr from-teal-300/20 to-green-300/20 rounded-full blur-2xl" />

          {/* Content */}
          <div className="relative p-8">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center space-x-2">
                <div className={`${accentColor} text-white p-3 rounded-xl shadow-lg`}>
                  <Heart className="w-6 h-6" fill="currentColor" />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Featured Campaign
                  </p>
                  <p className="text-xs text-gray-600">{campaign.category}</p>
                </div>
              </div>

              {campaign.isActive && (
                <div className="flex items-center space-x-1 bg-green-50 px-2 py-1 rounded-full">
                  <Sparkles className="w-3 h-3 text-green-600 animate-pulse" />
                  <span className="text-xs font-medium text-green-700">Live</span>
                </div>
              )}
            </div>

            {/* Campaign Title */}
            <div
              key={campaign.id}
              className="mb-6 animate-fade-in"
            >
              <h3 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">
                {campaign.title}
              </h3>
              {campaign.description && (
                <p className="text-sm text-gray-600">
                  {campaign.description}
                </p>
              )}
            </div>

            {/* Progress Section */}
            <div className="space-y-4 mb-6">
              {/* Amount raised */}
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-bold text-gray-900">
                    {formatCurrency(campaign.raised)}
                  </span>
                  <span className="text-lg text-gray-500 ml-2">
                    of {formatCurrencyFromMajor(campaign.goal)}
                  </span>
                </div>
                <div className="flex items-center space-x-1 text-green-600">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm font-semibold">{progress.toFixed(0)}%</span>
                </div>
              </div>

              {/* Progress bar with layered effect */}
              <div className="relative">
                {/* Background track */}
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  {/* Progress fill with gradient */}
                  <div
                    className={`h-full ${accentColor} rounded-full transition-all duration-1000 ease-out relative overflow-hidden`}
                    style={{ width: `${Math.min(100, progress)}%` }}
                  >
                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  </div>
                </div>

                {/* Milestone markers */}
                <div className="absolute top-0 left-1/2 w-0.5 h-3 bg-white/50" />
                <div className="absolute top-0 left-3/4 w-0.5 h-3 bg-white/50" />
              </div>

              {/* Supporters */}
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2 text-gray-700">
                  <Users className="w-4 h-4 text-gray-500" />
                  <span>
                    <span className="font-semibold text-gray-900">{campaign.supporters}</span> supporters
                  </span>
                </div>
                <span className="text-gray-500">
                  {formatCurrencyFromMajor(campaign.goal - campaign.raised)} to go
                </span>
              </div>
            </div>

            {/* Call to action hint */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200/50">
              <p className="text-xs text-gray-600">
                Join our community of givers
              </p>
              <div className={`h-1 w-16 ${accentColor} rounded-full`} />
            </div>
          </div>

          {/* Bottom navigation */}
          {campaigns.length > 1 && (
            <div className="relative bg-gradient-to-r from-green-50/80 to-emerald-50/80 backdrop-blur-sm px-8 py-3 border-t border-green-100/50">
              <div className="flex items-center justify-center space-x-2">
                {campaigns.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveCampaign(index)}
                    className={`transition-all duration-500 rounded-full ${
                      index === activeCampaign
                        ? `w-8 h-2 ${accentColor}`
                        : 'w-2 h-2 bg-gray-300 hover:bg-green-400'
                    }`}
                    aria-label={`View campaign ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Floating navigation */}
        {showNavigation && campaigns.length > 1 && (
          <>
            <button
              onClick={() =>
                setActiveCampaign((prev) => (prev - 1 + campaigns.length) % campaigns.length)
              }
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 bg-white rounded-full shadow-lg border border-green-200 hover:border-green-400 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
              aria-label="Previous campaign"
            >
              <svg
                className="w-5 h-5 text-green-600 group-hover:scale-110 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <button
              onClick={() => setActiveCampaign((prev) => (prev + 1) % campaigns.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 bg-white rounded-full shadow-lg border border-green-200 hover:border-green-400 hover:scale-110 transition-all duration-300 flex items-center justify-center group"
              aria-label="Next campaign"
            >
              <svg
                className="w-5 h-5 text-green-600 group-hover:scale-110 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Example usage with real data (for future implementation):
/*
import { FeaturedCampaign } from './components/FeaturedCampaign';

// Fetch from API
const campaigns = await fetchActiveCampaigns();

// Use in component
<FeaturedCampaign 
  campaigns={campaigns}
  autoRotateInterval={5000}
  showNavigation={true}
/>
*/
