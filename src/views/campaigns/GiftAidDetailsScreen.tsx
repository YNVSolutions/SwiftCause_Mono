import React, { useState, useEffect } from 'react';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { Checkbox } from '../../shared/ui/checkbox';
import { Card, CardContent, CardHeader } from '../../shared/ui/card';
import { NavigationHeader } from '../../shared/ui/NavigationHeader';
import { User, MapPin, ArrowRight } from 'lucide-react';
import { Campaign } from '../../shared/types';
import { GiftAidDetails } from '../../entities/giftAid/model/types';
import { formatCurrencyFromMajor } from '../../shared/lib/currencyFormatter';
import {
  HMRC_DECLARATION_TEXT_VERSION,
  getHmrcDeclarationText,
} from '../../shared/config/constants';

interface GiftAidDetailsScreenProps {
  campaign: Campaign;
  amount: number;
  onSubmit: (details: GiftAidDetails) => void;
  onBack: () => void;
  organizationCurrency?: string;
}

export function GiftAidDetailsScreen({
  campaign,
  amount,
  onSubmit,
  onBack,
  organizationCurrency = 'USD',
}: GiftAidDetailsScreenProps) {
  // Loading state for initial screen load
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Donor Information
  const [donorTitle, setDonorTitle] = useState('');
  const [fullName, setFullName] = useState('');
  const [houseNumber, setHouseNumber] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [town, setTown] = useState('');
  const [postcode, setPostcode] = useState('');

  // Declaration Requirements
  const [giftAidConsent, setGiftAidConsent] = useState(true);
  const [ukTaxpayerConfirmation, setUkTaxpayerConfirmation] = useState(true);
  const [dataProcessingConsent, setDataProcessingConsent] = useState(true);
  const [homeAddressConfirmed, setHomeAddressConfirmed] = useState(false);

  const [errors, setErrors] = useState<{
    fullName?: string;
    addressLine1?: string;
    town?: string;
    postcode?: string;
    consent?: string;
    taxpayer?: string;
    dataProcessing?: string;
    homeAddress?: string;
  }>({});

  // Show loading screen briefly when component mounts
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const giftAidAmount = amount * 0.25;
  const totalWithGiftAid = amount + giftAidAmount;
  const declarationText = getHmrcDeclarationText(campaign.title);

  // Show loading screen when initially loading
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-white">
        <NavigationHeader title="Gift Aid Details" onBack={onBack} backLabel="Back" />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0E8F5A] mx-auto mb-4"></div>
            <p className="text-gray-600">Loading Gift Aid form...</p>
          </div>
        </main>
      </div>
    );
  }

  // Show loading screen when submitting
  if (isSubmitting) {
    return (
      <div className="min-h-screen bg-white">
        <NavigationHeader title="Gift Aid Details" onBack={onBack} backLabel="Back" />
        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0E8F5A] mx-auto mb-4"></div>
            <p className="text-gray-600">Processing your details...</p>
          </div>
        </main>
      </div>
    );
  }

  const validateForm = () => {
    const newErrors: {
      fullName?: string;
      addressLine1?: string;
      town?: string;
      postcode?: string;
      consent?: string;
      taxpayer?: string;
      dataProcessing?: string;
      homeAddress?: string;
    } = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 3) {
      newErrors.fullName = 'Full name must be at least 3 characters';
    } else {
      const nameParts = fullName
        .trim()
        .split(' ')
        .filter((part) => part.length > 0);
      if (nameParts.length < 2) {
        newErrors.fullName = 'Please enter both first name and surname';
      }
    }

    if (!addressLine1.trim()) {
      newErrors.addressLine1 = 'Address line 1 is required';
    }

    if (!town.trim()) {
      newErrors.town = 'Town/City is required';
    }

    if (!postcode.trim()) {
      newErrors.postcode = 'Postcode is required';
    } else if (!/^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$/i.test(postcode.trim())) {
      newErrors.postcode = 'Please enter a valid UK postcode';
    }

    if (!giftAidConsent) {
      newErrors.consent = 'You must agree to the Gift Aid declaration to proceed';
    }

    if (!ukTaxpayerConfirmation) {
      newErrors.taxpayer = 'You must confirm UK taxpayer status to proceed';
    }

    if (!dataProcessingConsent) {
      newErrors.dataProcessing = 'You must agree to Gift Aid data processing';
    }

    if (!homeAddressConfirmed) {
      newErrors.homeAddress = 'Please confirm this is your home address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setIsSubmitting(true);

      // Add a small delay to show the loading state
      setTimeout(() => {
        const currentDate = new Date().toISOString();
        const currentYear = new Date().getFullYear();
        const taxYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
        const normalizedDonorTitle = donorTitle.trim().slice(0, 4);

        // Split full name into first name and surname
        const nameParts = fullName
          .trim()
          .split(' ')
          .filter((part) => part.length > 0);
        const firstName = nameParts[0] || '';
        const surname = nameParts.slice(1).join(' ') || '';

        const donationAmountPence = Math.round(amount * 100);
        const giftAidDetails: GiftAidDetails = {
          // Donor Information
          donorTitle: normalizedDonorTitle || undefined,
          firstName: firstName,
          surname: surname,
          houseNumber: houseNumber.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          town: town.trim(),
          postcode: postcode.trim().toUpperCase(),

          // Declaration Requirements
          giftAidConsent,
          ukTaxpayerConfirmation,
          dataProcessingConsent,
          homeAddressConfirmed,
          declarationText,
          declarationTextVersion: HMRC_DECLARATION_TEXT_VERSION,
          declarationDate: currentDate,

          // Donation Details
          donationAmount: donationAmountPence,
          donationDate: currentDate,
          organizationId: campaign.organizationId || '',
          donationId: '', // Default empty string

          // Audit Trail
          timestamp: currentDate,
          taxYear: taxYear,
        };

        onSubmit(giftAidDetails);
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <NavigationHeader title="Gift Aid Details" onBack={onBack} backLabel="Back" />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center">
          <Card className="w-full max-w-2xl !bg-[#FCFCFA] shadow-[0_10px_30px_rgba(0,0,0,0.06),0_2px_8px_rgba(0,0,0,0.04)] rounded-2xl overflow-hidden border border-gray-200/50">
            <CardHeader className="bg-gradient-to-r from-green-600 to-green-700 text-white p-5">
              <div className="text-center">
                <div role="heading" aria-level={2} className="text-lg sm:text-xl font-bold">
                  Boosting {formatCurrencyFromMajor(amount, organizationCurrency)} to{' '}
                  {formatCurrencyFromMajor(totalWithGiftAid, organizationCurrency)}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-8 !bg-[#FCFCFA]">
              {/* Campaign Info */}
              <div className="mb-8 p-4 bg-gray-100/50 rounded-lg text-center border border-gray-200/30">
                <p className="text-sm text-gray-600 mb-1">Donating to:</p>
                <p className="font-semibold text-gray-900 text-lg">{campaign.title}</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <User className="w-5 h-5 mr-2 text-gray-500" />
                    Personal Information
                  </h3>

                  <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 sm:grid-cols-[128px_minmax(0,1fr)] sm:gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="donorTitle" className="text-base font-medium text-gray-700">
                        Title
                      </Label>
                      <Input
                        id="donorTitle"
                        type="text"
                        value={donorTitle}
                        onChange={(e) => setDonorTitle(e.target.value.slice(0, 4))}
                        className="h-14 text-lg bg-[#FCFCFA] border-gray-300 focus:border-[#0E8F5A]"
                        placeholder="Mr"
                        maxLength={4}
                      />
                      <p className="text-xs text-gray-500">Max 4 chars</p>
                    </div>

                    {/* Full Name */}
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-base font-medium text-gray-700">
                        Full Name (First Name and Surname) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (errors.fullName)
                            setErrors((prev) => ({ ...prev, fullName: undefined }));
                        }}
                        className={`h-14 text-lg bg-[#FCFCFA] ${errors.fullName ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#0E8F5A]'}`}
                        placeholder="e.g. John Smith"
                      />
                      {errors.fullName && (
                        <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>
                      )}
                      <p className="text-gray-500 text-sm">
                        Initials alone are NOT sufficient - please enter your full first name and
                        surname
                      </p>
                    </div>
                  </div>
                </div>

                {/* UK Postcode Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <MapPin className="w-5 h-5 mr-2 text-gray-500" />
                    UK Address Verification
                  </h3>

                  <div className="space-y-2">
                    <Label htmlFor="houseNumber" className="text-base font-medium text-gray-700">
                      House Number / Name
                    </Label>
                    <Input
                      id="houseNumber"
                      type="text"
                      value={houseNumber}
                      onChange={(e) => setHouseNumber(e.target.value)}
                      className="h-14 text-lg bg-[#FCFCFA] border-gray-300 focus:border-[#0E8F5A]"
                      placeholder="e.g. 42"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine1" className="text-base font-medium text-gray-700">
                      Address Line 1 <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="addressLine1"
                      type="text"
                      value={addressLine1}
                      onChange={(e) => {
                        setAddressLine1(e.target.value);
                        if (errors.addressLine1)
                          setErrors((prev) => ({ ...prev, addressLine1: undefined }));
                      }}
                      className={`h-14 text-lg bg-[#FCFCFA] ${errors.addressLine1 ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#0E8F5A]'}`}
                      placeholder="e.g. High Street"
                    />
                    {errors.addressLine1 && (
                      <p className="text-red-500 text-sm mt-1">{errors.addressLine1}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="addressLine2" className="text-base font-medium text-gray-700">
                      Address Line 2
                    </Label>
                    <Input
                      id="addressLine2"
                      type="text"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      className="h-14 text-lg bg-[#FCFCFA] border-gray-300 focus:border-[#0E8F5A]"
                      placeholder="e.g. Apartment, suite, unit"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="town" className="text-base font-medium text-gray-700">
                      Town / City <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="town"
                      type="text"
                      value={town}
                      onChange={(e) => {
                        setTown(e.target.value);
                        if (errors.town) setErrors((prev) => ({ ...prev, town: undefined }));
                      }}
                      className={`h-14 text-lg bg-[#FCFCFA] ${errors.town ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#0E8F5A]'}`}
                      placeholder="e.g. London"
                    />
                    {errors.town && <p className="text-red-500 text-sm mt-1">{errors.town}</p>}
                  </div>

                  {/* UK Postcode */}
                  <div className="space-y-2">
                    <Label htmlFor="postcode" className="text-base font-medium text-gray-700">
                      UK Postcode <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="postcode"
                      type="text"
                      value={postcode}
                      onChange={(e) => {
                        setPostcode(e.target.value);
                        if (errors.postcode)
                          setErrors((prev) => ({ ...prev, postcode: undefined }));
                      }}
                      className={`h-14 text-lg uppercase bg-[#FCFCFA] ${errors.postcode ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#0E8F5A]'}`}
                      placeholder="e.g. SW1A 1AA"
                      maxLength={8}
                    />
                    {errors.postcode && (
                      <p className="text-red-500 text-sm mt-1">{errors.postcode}</p>
                    )}
                    <p className="text-gray-500 text-sm">
                      We need your UK postcode to verify your taxpayer status for Gift Aid
                    </p>
                  </div>

                  <div
                    className={`bg-gray-50 border rounded-lg p-4 ${errors.homeAddress ? 'border-red-500' : 'border-gray-200'}`}
                  >
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="homeAddressConfirmed"
                        checked={homeAddressConfirmed}
                        onCheckedChange={(checked) => {
                          setHomeAddressConfirmed(!!checked);
                          if (errors.homeAddress)
                            setErrors((prev) => ({ ...prev, homeAddress: undefined }));
                        }}
                        className="mt-1"
                      />
                      <Label
                        htmlFor="homeAddressConfirmed"
                        className="text-sm text-gray-700 leading-relaxed cursor-pointer"
                      >
                        I confirm this is my home address (not work or delivery address).
                      </Label>
                    </div>
                    {errors.homeAddress && (
                      <p className="text-red-500 text-sm mt-2 ml-8">{errors.homeAddress}</p>
                    )}
                  </div>
                </div>

                {/* Declaration Requirements */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900">Declaration Requirements</h3>

                  {/* UK Taxpayer Confirmation */}
                  <div
                    className={`bg-yellow-50 border rounded-lg p-4 ${errors.taxpayer ? 'border-red-500' : 'border-yellow-200'}`}
                  >
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="ukTaxpayerConfirmation"
                        checked={ukTaxpayerConfirmation}
                        onCheckedChange={(checked) => {
                          setUkTaxpayerConfirmation(!!checked);
                          if (errors.taxpayer)
                            setErrors((prev) => ({ ...prev, taxpayer: undefined }));
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="ukTaxpayerConfirmation"
                          className="text-sm text-gray-700 leading-relaxed cursor-pointer"
                        >
                          <span className="font-semibold text-gray-900 block mb-1">
                            UK Taxpayer Confirmation
                          </span>
                          I confirm that I have paid enough UK Income Tax and/or Capital Gains Tax
                          in the current tax year to cover the amount of Gift Aid claimed on all my
                          donations.
                        </Label>
                      </div>
                    </div>
                    {errors.taxpayer && (
                      <p className="text-red-500 text-sm mt-2 ml-8">{errors.taxpayer}</p>
                    )}
                  </div>

                  {/* Gift Aid Declaration */}
                  <div
                    className={`bg-blue-50 border rounded-lg p-4 ${errors.consent ? 'border-red-500' : 'border-blue-200'}`}
                  >
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="giftAidConsent"
                        checked={giftAidConsent}
                        onCheckedChange={(checked) => {
                          setGiftAidConsent(!!checked);
                          if (errors.consent)
                            setErrors((prev) => ({ ...prev, consent: undefined }));
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="giftAidConsent"
                          className="text-sm text-gray-700 leading-relaxed cursor-pointer"
                        >
                          <span className="font-semibold text-gray-900 block mb-1">
                            Gift Aid Declaration
                          </span>
                          I confirm that I am a UK taxpayer and understand that if I pay less Income
                          Tax and/or Capital Gains Tax in the current tax year than the amount of
                          Gift Aid claimed on all my donations, it is my responsibility to pay any
                          difference.
                        </Label>
                      </div>
                    </div>
                    {errors.consent && (
                      <p className="text-red-500 text-sm mt-2 ml-8">{errors.consent}</p>
                    )}
                  </div>

                  <div
                    className={`bg-purple-50 border rounded-lg p-4 ${errors.dataProcessing ? 'border-red-500' : 'border-purple-200'}`}
                  >
                    <div className="flex items-start space-x-3">
                      <Checkbox
                        id="dataProcessingConsent"
                        checked={dataProcessingConsent}
                        onCheckedChange={(checked) => {
                          setDataProcessingConsent(!!checked);
                          if (errors.dataProcessing)
                            setErrors((prev) => ({ ...prev, dataProcessing: undefined }));
                        }}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <Label
                          htmlFor="dataProcessingConsent"
                          className="text-sm text-gray-700 leading-relaxed cursor-pointer"
                        >
                          <span className="font-semibold text-gray-900 block mb-1">
                            Data Processing Consent
                          </span>
                          I agree to my data being used to process this Gift Aid claim.
                        </Label>
                      </div>
                    </div>
                    {errors.dataProcessing && (
                      <p className="text-red-500 text-sm mt-2 ml-8">{errors.dataProcessing}</p>
                    )}
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={
                    !giftAidConsent ||
                    !ukTaxpayerConfirmation ||
                    !dataProcessingConsent ||
                    !homeAddressConfirmed ||
                    isSubmitting
                  }
                  className="w-full h-16 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-xl transition-all duration-200 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      Processing...
                      <div className="w-6 h-6 ml-3"></div>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-6 h-6 mr-3" />
                      Continue to Payment
                      <ArrowRight className="w-6 h-6 ml-3" />
                    </>
                  )}
                </Button>

                {/* Additional Info */}
                <div className="text-center">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    Your details are secure and will only be used for Gift Aid purposes. You can
                    cancel Gift Aid at any time by contacting the charity.
                  </p>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
