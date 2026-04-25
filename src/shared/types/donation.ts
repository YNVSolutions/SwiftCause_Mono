// Gift Aid details interface - HMRC compliant
export interface GiftAidDetails {
  // 1. Donor Information
  donorTitle?: string;
  firstName: string;
  surname: string;
  houseNumber: string;
  addressLine1: string;
  addressLine2?: string;
  town: string;
  postcode: string;
  donorEmail?: string;

  // 2. Declaration Requirements
  giftAidConsent: boolean; // Explicit agreement to Gift Aid treatment
  ukTaxpayerConfirmation: boolean; // Confirmation of UK taxpayer status
  dataProcessingConsent?: boolean; // GDPR consent for Gift Aid processing
  homeAddressConfirmed?: boolean; // Donor confirms this is home address
  declarationText: string; // HMRC-compliant declaration wording
  declarationTextVersion?: string; // Legal text revision donor accepted
  declarationDate: string; // ISO date when declaration was made

  // 3. Donation Details
  donationAmount: number;
  donationDate: string; // ISO date of donation
  organizationId: string;
  donationId: string; // Default empty string
  declarationId?: string; // Canonical declaration-first linkage key

  // 4. Audit Trail (for compliance)
  timestamp: string; // ISO timestamp when record was created
  taxYear: string; // e.g., "2025-26"
}

// Donation-related types
export interface LocationSnapshot {
  name: string;
  postcode: string;
  city: string;
}

export interface Donation {
  campaignId: string;
  amount: number;
  isRecurring: boolean;
  recurringInterval?: 'monthly' | 'quarterly' | 'yearly'; // Keep existing for backward compatibility
  subscriptionId?: string; // NEW - links to subscription for recurring donations
  invoiceId?: string; // NEW - Stripe invoice ID for recurring payments
  id?: string;
  donorEmail?: string;
  donorName?: string;
  donorPhone?: string;
  donorMessage?: string;
  isAnonymous?: boolean;
  timestamp?: string;
  kioskId?: string;
  transactionId?: string;
  paymentStatus?: 'success' | 'pending' | 'failed' | string;
  isGiftAid?: boolean;
  giftAidEnabled?: boolean; // Campaign supports Gift Aid (for magic link generation)
  giftAidAccepted?: boolean; // Explicit tracking of Gift Aid acceptance/decline
  giftAidDetails?: GiftAidDetails;
  giftAidDeclarationId?: string;
  organizationId?: string;
  // Location fields — required for GASDS compliance
  location_id?: string; // Reference to locations/{id} for aggregation
  location_snapshot?: LocationSnapshot; // Immutable copy at time of donation for audit trail
}

export interface GiftAidDeclaration {
  id?: string;
  donationId: string;
  donorName: string;
  donorAddress: string;
  donorPostcode: string;
  amount: number;
  giftAidAmount: number;
  campaignId: string;
  campaignTitle: string;
  donationDate: string;
  giftAidStatus: 'pending' | 'claimed' | 'rejected';
  transactionId: string;
  taxYear: string;
  organizationId: string;
  createdAt?: string;
  updatedAt?: string;
}
