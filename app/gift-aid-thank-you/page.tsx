'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Heart } from 'lucide-react';

interface ThankYouData {
  campaignTitle: string;
  donationAmount: number;
  giftAidBonus: number;
  totalImpact: number;
  donorName: string;
  declarationId: string;
}

export default function GiftAidThankYouPage() {
  const router = useRouter();
  const [data, setData] = useState<ThankYouData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedData = sessionStorage.getItem('giftAidThankYou');
    if (storedData) {
      setData(JSON.parse(storedData));
      // Clear the data after reading
      sessionStorage.removeItem('giftAidThankYou');
    }
    setLoading(false);
  }, []);

  const handleDone = () => {
    router.push('/campaigns');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Fallback for missing data (refresh or direct navigation)
  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-600 to-green-700 p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-white rounded-full p-4">
                <CheckCircle className="w-16 h-16 text-green-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Thank You!</h1>
            <p className="text-green-100 text-lg">Your Gift Aid declaration has been submitted</p>
          </div>
          <div className="p-8 text-center">
            <p className="text-gray-600 mb-6">
              Your Gift Aid declaration has been successfully processed. The charity will be able to
              claim an extra 25% on your donation.
            </p>
            <button
              onClick={handleDone}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg shadow-lg"
            >
              Browse Campaigns
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-white rounded-full p-4">
              <CheckCircle className="w-16 h-16 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Thank You!</h1>
          <p className="text-green-100 text-lg">Your Gift Aid declaration has been submitted</p>
        </div>

        {/* Content */}
        <div className="p-8">
          {/* Campaign Info */}
          <div className="mb-8 text-center">
            <p className="text-gray-600 text-sm uppercase tracking-wide mb-2">Donating to</p>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">{data.campaignTitle}</h2>
            <div className="flex items-center justify-center text-green-600">
              <Heart className="w-5 h-5 mr-2 fill-current" />
              <span className="text-sm">Thank you, {data.donorName}</span>
            </div>
          </div>

          {/* Impact Breakdown */}
          <div className="bg-gray-50 rounded-2xl p-6 mb-6">
            <div className="space-y-4">
              {/* Donation Amount */}
              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <span className="text-gray-700 font-medium">Donation Amount</span>
                <span className="text-2xl font-bold text-gray-900">
                  £{data.donationAmount.toFixed(2)}
                </span>
              </div>

              {/* Gift Aid Bonus */}
              <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                  <span className="text-gray-700 font-medium">Gift Aid (25%)</span>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  +£{data.giftAidBonus.toFixed(2)}
                </span>
              </div>

              {/* Total Impact */}
              <div className="flex justify-between items-center pt-2">
                <span className="text-xl font-bold text-gray-900">Total Impact</span>
                <span className="text-3xl font-bold text-green-600">
                  £{data.totalImpact.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Declaration Info */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-700 text-center">
              <span className="font-semibold">Declaration:</span> I confirm I have paid enough UK
              Income/Capital Gains Tax to cover all my Gift Aid donations.
            </p>
            <p className="text-xs text-gray-600 text-center mt-2">Details: {data.donorName}</p>
          </div>

          {/* Info Box */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-700 text-center">
              Your Gift Aid declaration means the charity can claim an extra 25p for every £1 you
              donate at no extra cost to you. Thank you for maximizing your impact!
            </p>
          </div>

          {/* Action Button */}
          <button
            onClick={handleDone}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl transition-colors text-lg shadow-lg"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
