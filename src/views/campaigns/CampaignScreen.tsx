import React, { useState } from 'react';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../shared/ui/card';
import { Badge } from '../../shared/ui/badge';
import { Switch } from '../../shared/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../shared/ui/select';
import { Progress } from '../../shared/ui/progress';
import { ImageWithFallback } from '../../shared/ui/figma/ImageWithFallback';
import { NavigationHeader } from '../../shared/ui/NavigationHeader';
import { 
  Heart, 
  ArrowRight, 
  Users, 
  Clock, 
  Gift,
  Percent,
  ChevronDown,
  ChevronUp,
  Target
} from 'lucide-react';
import { Campaign, Donation } from '../../shared/types';
import { formatCurrency, formatCurrencyFromMajor } from '../../shared/lib/currencyFormatter';
import { getOrganizationById } from '../../shared/api';

type CampaignView = 'overview' | 'donate';

interface CampaignScreenProps {
  campaign: Campaign;
  view?: CampaignView;
  onSubmit?: (donation: Donation) => void;
  onBack: () => void;
  onViewChange?: (view: CampaignView) => void;
  initialShowDetails?: boolean; // New prop for controlling initial expanded state
}

interface DonorInfo {
  isAnonymous: boolean;
}

export function CampaignScreen({
  campaign,
  view = 'donate', // Default to 'donate' view
  onSubmit,
  onBack,
  onViewChange,
  initialShowDetails = false // Default to collapsed
}: CampaignScreenProps) {
  const [currentView, setCurrentView] = useState<CampaignView>(view);
  const [showDetails, setShowDetails] = useState(initialShowDetails); // Use new prop for initial state
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<'monthly' | 'quarterly' | 'yearly'>(
    campaign.configuration.defaultRecurringInterval
  );
  const [donorInfo, setDonorInfo] = useState<DonorInfo>({
    isAnonymous: false
  });
  const [organizationCurrency, setOrganizationCurrency] = useState<string | undefined>(undefined);

  React.useEffect(() => {
    const fetchOrganizationCurrency = async () => {
      if (campaign.organizationId) {
        const organization = await getOrganizationById(campaign.organizationId);
        if (organization && organization.currency) {
          setOrganizationCurrency(organization.currency);
        }
      }
    };
    fetchOrganizationCurrency();
  }, [campaign.organizationId]);

  const config = campaign.configuration;

  const getProgressPercentage = (raised: number, goal: number) => {
    return ((raised / 100) / goal) * 100;
  };

  const getCurrentAmount = () => {
    if (selectedAmount !== null) return selectedAmount;
    const custom = parseFloat(customAmount);
    return isNaN(custom) ? 0 : custom;
  };

  const isValidAmount = () => {
    const amount = getCurrentAmount();
    if (!config.allowCustomAmount && selectedAmount === null) return false;
    return amount >= (config.minCustomAmount || 1) && 
           amount <= (config.maxCustomAmount || 10000);
  };

  const getDiscountedAmount = () => {
    const amount = getCurrentAmount();
    if (isRecurring && config.recurringDiscount) {
      return amount * (1 - (config.recurringDiscount / 100));
    }
    return amount;
  };

  const handleViewChange = (newView: CampaignView) => {
    setCurrentView(newView);
    onViewChange?.(newView);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount() || !onSubmit) return;

    const donation: Donation = {
      campaignId: campaign.id,
      amount: getCurrentAmount(),
      isRecurring,
      recurringInterval: isRecurring ? recurringInterval : undefined,
      isAnonymous: donorInfo.isAnonymous,
      donorName: "" // No gift aid in this flow, so no donor name
    };

    onSubmit(donation);
  };

  const handlePresetSelect = (amount: number) => {
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    setSelectedAmount(null);
  };

  const estimatedDonors = Math.floor(campaign.raised / 25);

  const getYouTubeVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return match[2];
    }
    return null;
  };


  return (
    <>
      <style>{`
        .rich-text-content strong {
          font-weight: bold;
        }
        .rich-text-content em {
          font-style: italic;
        }
        .rich-text-content hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 16px 0;
        }
        .rich-text-content p {
          margin: 0 0 8px 0;
        }
        .rich-text-content p:last-child {
          margin-bottom: 0;
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <NavigationHeader
        title={currentView === 'overview' ? 'Campaign Details' : 'Make a Donation'}
        onBack={onBack} // Always go back to campaign list
        backLabel={'Back to Campaigns'}
      />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Campaign Info Sidebar / Combined View */}
          <Card className="lg:col-span-1">
            <div className="aspect-[16/10] relative overflow-hidden rounded-t-lg">
              <ImageWithFallback 
                src={campaign.coverImageUrl}
                alt={campaign.title}
                className="w-full h-full object-cover"
              />
              <Badge className="absolute top-4 left-4 bg-white/90 text-gray-800">
                {campaign.category}
              </Badge>
            </div>
            
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-2">{campaign.title}</h2>
              <p className="text-gray-600 mb-4 line-clamp-2">{campaign.description}</p>
              
              {config.showProgressBar && campaign.goal > 0 && (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span>Raised: {formatCurrency(campaign.raised, organizationCurrency || 'GBP')}</span>
                    <span>Goal: {formatCurrencyFromMajor(campaign.goal, organizationCurrency || 'GBP')}</span>
                  </div>
                  <Progress value={Math.min(getProgressPercentage(campaign.raised || 0, campaign.goal || 0), 100)} className="h-2" />
                  <p className="text-sm text-gray-600">{getProgressPercentage(campaign.raised || 0, campaign.goal || 0).toFixed(1)}% funded</p>
                </div>
              )}

              {config.showDonorCount && campaign.raised > 0 && (
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <div className="flex items-center space-x-1">
                    <Users className="w-4 h-4" />
                    <span>{estimatedDonors.toLocaleString()} donors</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Heart className="w-4 h-4" />
                    <span>{formatCurrencyFromMajor(151, organizationCurrency || 'GBP')} avg</span>
                  </div>
                </div>
              )}

              {campaign.organizationInfo && (
                <div className="space-y-3 mt-4 p-4 border rounded-lg bg-gray-50">
                  <h5 className="font-bold text-gray-800">About {campaign.organizationInfo.name}</h5>
                  {campaign.organizationInfo.logo && (
                    <ImageWithFallback
                      src={campaign.organizationInfo.logo}
                      alt={`${campaign.organizationInfo.name} logo`}
                      className="w-16 h-16 object-contain rounded-full mb-2"
                    />
                  )}
                  <p className="text-sm text-gray-600">{campaign.organizationInfo.description}</p>
                  {campaign.organizationInfo.website && (
                    <a href={campaign.organizationInfo.website} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline text-sm">
                      Visit Website
                    </a>
                  )}
                </div>
              )}

            </CardContent>
          </Card>

          {/* Donation Form and Expanded Details */}
          <Card className="lg:col-span-2 shadow-lg">
            <CardHeader className="px-6 py-4 border-b">
              <CardTitle className="flex items-center text-2xl font-bold text-gray-800">
                <Heart className="mr-3 h-6 w-6 text-indigo-600" />
                {config.primaryCTAText}
              </CardTitle>
              <p className="text-muted-foreground">
                Choose your donation amount and support this important cause
              </p>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Toggle for More Details */}
                <div className="flex justify-end mb-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDetails(!showDetails)}
                    className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800"
                  >
                    <span>{showDetails ? 'Hide Details' : 'Show More Details'}</span>
                    {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>

                {showDetails && (
                  <div className="grid grid-cols-1 gap-6 mb-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>About This Campaign</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3 text-sm text-muted-foreground">
                          <div 
                            className="rich-text-content"
                            dangerouslySetInnerHTML={{ 
                              __html: campaign.longDescription || 'This campaign is dedicated to making a significant impact. Your support will provide essential resources and foster lasting positive change within the community.' 
                            }}
                          />
                          {campaign.videoUrl && (
                            <div className="aspect-video w-full rounded-md overflow-hidden">
                              <iframe
                                src={`https://www.youtube.com/embed/${getYouTubeVideoId(campaign.videoUrl)}?modestbranding=1&rel=0`}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                                className="w-full h-full"
                                title="Campaign Video"
                              ></iframe>
                            </div>
                          )}
                          {campaign.galleryImages && campaign.galleryImages.length > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              {campaign.galleryImages.map((img: string, idx: number) => (
                                <ImageWithFallback key={idx} src={img} alt={`${campaign.title} gallery image ${idx + 1}`} className="w-full h-auto rounded-md object-cover" />
                              ))}
                            </div>
                          )}
                          {campaign.impactMetrics && (
                            <div className="space-y-2">
                              <h5 className="font-semibold text-gray-800 mt-3">Impact Metrics</h5>
                              {campaign.impactMetrics.peopleHelped && (
                                <p className="flex items-center"><Users className="h-4 w-4 mr-2 text-indigo-600"/> {campaign.impactMetrics.peopleHelped.toLocaleString()} people helped</p>
                              )}
                              {campaign.impactMetrics.itemsProvided && (
                                <p className="flex items-center"><Gift className="h-4 w-4 mr-2 text-indigo-600"/> {campaign.impactMetrics.itemsProvided.toLocaleString()} items provided</p>
                              )}
                              {campaign.impactMetrics.customMetric && (
                                <p className="flex items-center"><Target className="h-4 w-4 mr-2 text-indigo-600"/> {campaign.impactMetrics.customMetric.value.toLocaleString()} {campaign.impactMetrics.customMetric.unit} {campaign.impactMetrics.customMetric.label}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Donation Amounts */}
                <div className="space-y-4">
                  <Label className="text-base font-medium">Select Amount</Label>
                  
                  {/* Preset Amounts */}
                  <div className={`grid ${
                    config.predefinedAmounts.length <= 3 ? 'grid-cols-3' :
                    config.predefinedAmounts.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' :
                    'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                  } gap-3`}>
                    {config.predefinedAmounts.map((amount: number) => (
                      <Button
                        key={amount}
                        type="button"
                        variant={selectedAmount === amount ? "default" : "outline"}
                        onClick={() => handlePresetSelect(amount)}
                        className={`h-14 flex flex-col ${
                          selectedAmount === amount ? 'bg-indigo-600 hover:bg-indigo-700' : ''
                        }`}
                      >
                        <span className="text-lg font-semibold">{formatCurrencyFromMajor(amount, organizationCurrency || 'GBP')}</span>
                        {config.enableRecurring && isRecurring && config.recurringDiscount && (
                          <span className="text-xs opacity-75">
                            {formatCurrencyFromMajor(amount * (1 - config.recurringDiscount / 100), organizationCurrency || 'GBP')} after discount
                          </span>
                        )}
                      </Button>
                    ))}
                  </div>

                  {/* Custom Amount */}
                  {config.allowCustomAmount && (
                    <div className="space-y-2">
                      <Label htmlFor="customAmount">Custom Amount</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"></span>
                        <Input
                          id="customAmount"
                          type="number"
                          min={config.minCustomAmount}
                          max={config.maxCustomAmount}
                          step="0.01"
                          placeholder={`${formatCurrencyFromMajor(config.minCustomAmount, organizationCurrency || 'GBP')} - ${formatCurrencyFromMajor(config.maxCustomAmount, organizationCurrency || 'GBP')}`}
                          value={customAmount}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCustomAmountChange(e.target.value)}
                          className="pl-8 h-12"
                          inputMode="decimal"
                        />
                      </div>
                      <p className="text-sm text-gray-500">
                        Enter between {formatCurrencyFromMajor(config.minCustomAmount, organizationCurrency || 'GBP')} and {formatCurrencyFromMajor(config.maxCustomAmount, organizationCurrency || 'GBP')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Recurring Donation */}
                {config.enableRecurring && (
                  <div className="space-y-4 p-4 border rounded-lg bg-blue-50/50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <Label htmlFor="recurring" className="text-base font-medium flex items-center">
                          <Clock className="w-4 h-4 mr-2" />
                          Make this a recurring donation
                        </Label>
                        <p className="text-sm text-gray-600 mt-1">
                          Create lasting impact with ongoing support
                          {config.recurringDiscount && (
                            <span className="text-green-600 font-medium ml-1">
                              (Save {config.recurringDiscount}%!)
                            </span>
                          )}
                        </p>
                      </div>
                      <Switch
                        id="recurring"
                        checked={isRecurring}
                        onCheckedChange={setIsRecurring}
                      />
                    </div>

                    {isRecurring && config.recurringIntervals.length > 1 && (
                      <div>
                        <Label>Recurring Frequency</Label>
                        <Select value={recurringInterval} onValueChange={(value: any) => setRecurringInterval(value)}>
                          <SelectTrigger className="mt-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {config.recurringIntervals.map((interval: string) => (
                              <SelectItem key={interval} value={interval} className="capitalize">
                                {interval}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary */}
                {isValidAmount() && (
                  <div className="p-4 rounded-lg border-2 bg-blue-50 border-blue-200">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">Your donation:</span>
                      <div className="text-right">
                        <div className="text-xl font-semibold">
                          {formatCurrencyFromMajor(getDiscountedAmount(), organizationCurrency || 'GBP')}
                        </div>
                        {isRecurring && config.recurringDiscount && getCurrentAmount() !== getDiscountedAmount() && (
                          <div className="text-sm text-gray-500 line-through">
                            {formatCurrencyFromMajor(getCurrentAmount(), organizationCurrency || 'GBP')}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 text-sm">
                      {isRecurring && (
                        <Badge variant="secondary" className="flex items-center space-x-1">
                          <Clock className="w-3 h-3" />
                          <span className="capitalize">{recurringInterval}</span>
                        </Badge>
                      )}
                      {isRecurring && config.recurringDiscount && (
                        <Badge variant="secondary" className="flex items-center space-x-1 bg-green-100 text-green-800">
                          <Percent className="w-3 h-3" />
                          <span>{config.recurringDiscount}% saved</span>
                        </Badge>
                      )}
                      {donorInfo.isAnonymous && (
                        <Badge variant="secondary">Anonymous</Badge>
                      )}
                    </div>
                  </div>
                )}

                <Button 
                  type="submit" 
                  disabled={!isValidAmount()}
                  size="lg" 
                  className="w-full h-14 text-base bg-indigo-600 hover:bg-indigo-700"
                >
                  <Gift className="mr-2 h-5 w-5" />
                  Continue to Payment
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
    </>
  );
}
