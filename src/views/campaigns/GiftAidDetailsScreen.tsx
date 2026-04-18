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

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const giftAidAmount = amount * 0.25;
  // const totalWithGiftAid = amount + giftAidAmount; // Calculated but not used in this component
  const declarationText = getHmrcDeclarationText(campaign.title);

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationHeader title="Gift Aid Declaration" onBack={onBack} backLabel="Back" />
        <main className="max-w-3xl mx-auto px-4 py-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-3"></div>
            <p className="text-sm text-gray-600">Loading form...</p>
          </div>
        </main>
      </div>
    );
  }

  if (isSubmitting) {
    return (
      <div className="min-h-screen bg-gray-50">
        <NavigationHeader title="Gift Aid Declaration" onBack={onBack} backLabel="Back" />
        <main className="max-w-3xl mx-auto px-4 py-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-3"></div>
            <p className="text-sm text-gray-600">Processing declaration...</p>
          </div>
        </main>
      </div>
    );
  }

  const validateForm = () => {
    const newErrors: typeof errors = {};

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
      newErrors.consent = 'You must agree to the Gift Aid declaration';
    }

    if (!ukTaxpayerConfirmation) {
      newErrors.taxpayer = 'You must confirm UK taxpayer status';
    }

    if (!dataProcessingConsent) {
      newErrors.dataProcessing = 'You must agree to data processing';
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

      setTimeout(() => {
        const currentDate = new Date().toISOString();
        const currentYear = new Date().getFullYear();
        const taxYear = `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
        const normalizedDonorTitle = donorTitle.trim().slice(0, 4);

        const nameParts = fullName
          .trim()
          .split(' ')
          .filter((part) => part.length > 0);
        const firstName = nameParts[0] || '';
        const surname = nameParts.slice(1).join(' ') || '';

        const donationAmountPence = Math.round(amount * 100);
        const giftAidDetails: GiftAidDetails = {
          donorTitle: normalizedDonorTitle || undefined,
          firstName: firstName,
          surname: surname,
          houseNumber: houseNumber.trim(),
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          town: town.trim(),
          postcode: postcode.trim().toUpperCase(),
          giftAidConsent,
          ukTaxpayerConfirmation,
          dataProcessingConsent,
          homeAddressConfirmed,
          declarationText,
          declarationTextVersion: HMRC_DECLARATION_TEXT_VERSION,
          declarationDate: currentDate,
          donationAmount: donationAmountPence,
          donationDate: currentDate,
          organizationId: campaign.organizationId || '',
          donationId: '',
          timestamp: currentDate,
          taxYear: taxYear,
        };

        onSubmit(giftAidDetails);
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavigationHeader title="Gift Aid Declaration" onBack={onBack} backLabel="Back" />

      <main className="max-w-3xl mx-auto px-4 py-6">
        <Card className="bg-white shadow-sm border border-gray-200">
          <CardHeader className="border-b border-gray-200 bg-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Gift Aid Declaration</h2>
                <p className="text-sm text-gray-600 mt-0.5">{campaign.title}</p>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">Donation Amount</div>
                <div className="text-xl font-bold text-gray-900">
                  {formatCurrencyFromMajor(amount, organizationCurrency)}
                </div>
                <div className="text-xs text-green-600 font-medium">
                  +{formatCurrencyFromMajor(giftAidAmount, organizationCurrency)} Gift Aid
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center">
                  <User className="w-4 h-4 mr-2 text-gray-400" />
                  Personal Details
                </h3>

                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-1 space-y-1.5">
                    <Label htmlFor="donorTitle" className="text-sm font-medium text-gray-700">
                      Title
                    </Label>
                    <Input
                      id="donorTitle"
                      type="text"
                      value={donorTitle}
                      onChange={(e) => setDonorTitle(e.target.value.slice(0, 4))}
                      className="h-10 text-sm"
                      placeholder="Mr"
                      maxLength={4}
                    />
                  </div>

                  <div className="col-span-3 space-y-1.5">
                    <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                      Full Name <span className="text-red-500">*</span>
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
                      className={`h-10 text-sm ${errors.fullName ? 'border-red-500' : ''}`}
                      placeholder="First Name and Surname"
                    />
                    {errors.fullName && (
                      <p className="text-xs text-red-600 mt-1">{errors.fullName}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-gray-400" />
                  UK Home Address
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="houseNumber" className="text-sm font-medium text-gray-700">
                      House Number/Name
                    </Label>
                    <Input
                      id="houseNumber"
                      type="text"
                      value={houseNumber}
                      onChange={(e) => setHouseNumber(e.target.value)}
                      className="h-10 text-sm"
                      placeholder="42"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="postcode" className="text-sm font-medium text-gray-700">
                      Postcode <span className="text-red-500">*</span>
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
                      className={`h-10 text-sm uppercase ${errors.postcode ? 'border-red-500' : ''}`}
                      placeholder="SW1A 1AA"
                      maxLength={8}
                    />
                    {errors.postcode && (
                      <p className="text-xs text-red-600 mt-1">{errors.postcode}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="addressLine1" className="text-sm font-medium text-gray-700">
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
                    className={`h-10 text-sm ${errors.addressLine1 ? 'border-red-500' : ''}`}
                    placeholder="Street Address"
                  />
                  {errors.addressLine1 && (
                    <p className="text-xs text-red-600 mt-1">{errors.addressLine1}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="addressLine2" className="text-sm font-medium text-gray-700">
                    Address Line 2
                  </Label>
                  <Input
                    id="addressLine2"
                    type="text"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className="h-10 text-sm"
                    placeholder="Apartment, suite, etc. (optional)"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="town" className="text-sm font-medium text-gray-700">
                    Town/City <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="town"
                    type="text"
                    value={town}
                    onChange={(e) => {
                      setTown(e.target.value);
                      if (errors.town) setErrors((prev) => ({ ...prev, town: undefined }));
                    }}
                    className={`h-10 text-sm ${errors.town ? 'border-red-500' : ''}`}
                    placeholder="London"
                  />
                  {errors.town && <p className="text-xs text-red-600 mt-1">{errors.town}</p>}
                </div>

                <div
                  className={`bg-gray-50 border rounded-md p-3 ${errors.homeAddress ? 'border-red-500' : 'border-gray-200'}`}
                >
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="homeAddressConfirmed"
                      checked={homeAddressConfirmed}
                      onCheckedChange={(checked) => {
                        setHomeAddressConfirmed(!!checked);
                        if (errors.homeAddress)
                          setErrors((prev) => ({ ...prev, homeAddress: undefined }));
                      }}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="homeAddressConfirmed"
                      className="text-xs text-gray-700 leading-relaxed cursor-pointer"
                    >
                      I confirm this is my home address (not work or delivery address)
                    </Label>
                  </div>
                  {errors.homeAddress && (
                    <p className="text-xs text-red-600 mt-2 ml-6">{errors.homeAddress}</p>
                  )}
                </div>
              </div>

              {/* Declaration Requirements */}
              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                  Required Declarations
                </h3>

                <div
                  className={`bg-amber-50 border rounded-md p-3 ${errors.taxpayer ? 'border-red-500' : 'border-amber-200'}`}
                >
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="ukTaxpayerConfirmation"
                      checked={ukTaxpayerConfirmation}
                      onCheckedChange={(checked) => {
                        setUkTaxpayerConfirmation(!!checked);
                        if (errors.taxpayer)
                          setErrors((prev) => ({ ...prev, taxpayer: undefined }));
                      }}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="ukTaxpayerConfirmation"
                      className="text-xs text-gray-700 leading-relaxed cursor-pointer"
                    >
                      <span className="font-semibold text-gray-900">UK Taxpayer:</span> I confirm I
                      have paid enough UK Income Tax and/or Capital Gains Tax this year to cover the
                      Gift Aid claimed on all my donations.
                    </Label>
                  </div>
                  {errors.taxpayer && (
                    <p className="text-xs text-red-600 mt-2 ml-6">{errors.taxpayer}</p>
                  )}
                </div>

                <div
                  className={`bg-blue-50 border rounded-md p-3 ${errors.consent ? 'border-red-500' : 'border-blue-200'}`}
                >
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="giftAidConsent"
                      checked={giftAidConsent}
                      onCheckedChange={(checked) => {
                        setGiftAidConsent(!!checked);
                        if (errors.consent) setErrors((prev) => ({ ...prev, consent: undefined }));
                      }}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="giftAidConsent"
                      className="text-xs text-gray-700 leading-relaxed cursor-pointer"
                    >
                      <span className="font-semibold text-gray-900">Gift Aid Declaration:</span> I
                      want to Gift Aid this donation and understand my responsibility to pay any
                      difference if I pay less tax than the amount claimed.
                    </Label>
                  </div>
                  {errors.consent && (
                    <p className="text-xs text-red-600 mt-2 ml-6">{errors.consent}</p>
                  )}
                </div>

                <div
                  className={`bg-purple-50 border rounded-md p-3 ${errors.dataProcessing ? 'border-red-500' : 'border-purple-200'}`}
                >
                  <div className="flex items-start space-x-2">
                    <Checkbox
                      id="dataProcessingConsent"
                      checked={dataProcessingConsent}
                      onCheckedChange={(checked) => {
                        setDataProcessingConsent(!!checked);
                        if (errors.dataProcessing)
                          setErrors((prev) => ({ ...prev, dataProcessing: undefined }));
                      }}
                      className="mt-0.5"
                    />
                    <Label
                      htmlFor="dataProcessingConsent"
                      className="text-xs text-gray-700 leading-relaxed cursor-pointer"
                    >
                      <span className="font-semibold text-gray-900">Data Processing:</span> I
                      consent to my data being used to process this Gift Aid claim.
                    </Label>
                  </div>
                  {errors.dataProcessing && (
                    <p className="text-xs text-red-600 mt-2 ml-6">{errors.dataProcessing}</p>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-gray-200">
                <Button
                  type="submit"
                  disabled={
                    !giftAidConsent ||
                    !ukTaxpayerConfirmation ||
                    !dataProcessingConsent ||
                    !homeAddressConfirmed ||
                    isSubmitting
                  }
                  className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold text-sm rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Submit Declaration
                    </>
                  )}
                </Button>
                <p className="text-xs text-gray-500 text-center mt-3">
                  Your information is secure and will only be used for Gift Aid purposes
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
