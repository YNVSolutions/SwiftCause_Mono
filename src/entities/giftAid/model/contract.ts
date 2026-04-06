export const GIFT_AID_CANONICAL_FLOW = 'declaration-first' as const;

export const GIFT_AID_DECLARATION_TEXT_VERSION = 'hmrc-ch3-2026-03' as const;

export const GIFT_AID_RETENTION_YEARS = 6 as const;

export const GIFT_AID_DECLARATION_STATUS = [
  'pending',
  'active',
  'invalid',
  'claimed',
  'rejected',
] as const;

export type GiftAidDeclarationStatus = (typeof GIFT_AID_DECLARATION_STATUS)[number];

export const GIFT_AID_HMRC_CLAIM_STATUS = ['pending', 'included', 'submitted', 'paid'] as const;

export type GiftAidHmrcClaimStatus = (typeof GIFT_AID_HMRC_CLAIM_STATUS)[number];

export const GIFT_AID_OPERATIONAL_STATUS = ['captured', 'exported'] as const;

export type GiftAidOperationalStatus = (typeof GIFT_AID_OPERATIONAL_STATUS)[number];

export interface GiftAidDetailsContractV2 {
  donorTitle?: string;
  firstName: string;
  surname: string;
  houseNumber: string;
  addressLine1: string;
  town: string;
  postcode: string;
  giftAidConsent: boolean;
  ukTaxpayerConfirmation: boolean;
  dataProcessingConsent: boolean;
  homeAddressConfirmed: boolean;
  declarationText: string;
  declarationTextVersion: string;
  declarationDate: string;
  donationAmount: number;
  donationDate: string;
  organizationId: string;
  timestamp: string;
  taxYear: string;
}

export interface GiftAidDeclarationContractV2 {
  id: string;
  donationId: string | null;
  donorTitle?: string;
  donorFirstName: string;
  donorSurname: string;
  donorHouseNumber: string;
  donorAddressLine1: string;
  donorTown: string;
  donorPostcode: string;
  donorEmail?: string;
  donorEmailNormalized?: string;
  giftAidConsent: boolean;
  ukTaxpayerConfirmation: boolean;
  dataProcessingConsent: boolean;
  homeAddressConfirmed: boolean;
  declarationText: string;
  declarationTextVersion: string;
  declarationDate: string;
  declarationIpAddress: string;
  declarationUserAgent: string;
  donationAmount: number | null;
  giftAidAmount: number | null;
  organizationId: string;
  donationDate: string;
  taxYear: string;
  giftAidStatus: GiftAidDeclarationStatus;
  hmrcClaimStatus: GiftAidHmrcClaimStatus;
  operationalStatus: GiftAidOperationalStatus;
  exportedAt: string | null;
  exportBatchId: string | null;
  exportActorId: string | null;
  charitySubmittedReference: string | null;
  paidConfirmed: boolean;
  paidConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
