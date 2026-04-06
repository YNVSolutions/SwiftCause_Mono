import {
  GiftAidDeclarationStatus,
  GiftAidHmrcClaimStatus,
  GiftAidOperationalStatus,
} from './contract';

/**
 * HMRC-compliant Gift Aid Declaration interface
 *
 * COMPLIANCE NOTES:
 * - All monetary amounts are stored in pence (minor currency units)
 * - donationId enforces strict 1:1 mapping with donations
 * - Fields must not be modified without legal review
 */
export interface GiftAidDeclaration {
  // MANDATORY: Document identifier (equals donationId for 1:1 mapping)
  id: string;

  // MANDATORY: Linking field - enforces 1:1 relationship with donation
  donationId: string | null;

  // MANDATORY: Full donor identity (HMRC requirement)
  donorTitle?: string;
  donorFirstName: string;
  donorSurname: string;

  // MANDATORY: Complete address (HMRC requirement)
  donorHouseNumber: string;
  donorAddressLine1: string;
  donorAddressLine2?: string; // Optional additional address line
  donorTown: string;
  donorPostcode: string;
  donorEmail?: string;
  donorEmailNormalized?: string;

  // MANDATORY: Declaration details (HMRC requirement)
  declarationText: string; // Verbatim HMRC-compliant declaration
  declarationTextVersion?: string; // Tracks wording revision donor agreed to
  declarationDate: string; // ISO date when declaration was made
  giftAidConsent?: boolean; // Explicit donor opt-in to Gift Aid
  ukTaxpayerConfirmation: boolean; // Explicit UK taxpayer confirmation
  dataProcessingConsent?: boolean; // Explicit consent for data processing
  homeAddressConfirmed?: boolean; // Donor confirmed this is home address
  declarationIpAddress?: string; // Audit requirement
  declarationUserAgent?: string; // Audit requirement

  // MANDATORY: Financial details (HMRC requirement - amounts in pence)
  donationAmount: number; // Original donation amount in pence (minor currency units)
  giftAidAmount: number; // Calculated Gift Aid amount in pence (minor currency units)

  // MANDATORY: Context and traceability
  campaignId: string;
  campaignTitle: string;
  organizationId: string;

  // MANDATORY: Dates (HMRC requirement)
  donationDate: string; // ISO date of original donation
  taxYear: string; // Format: "2025-26"

  // MANDATORY: Status tracking
  giftAidStatus: GiftAidDeclarationStatus;
  hmrcClaimStatus?: GiftAidHmrcClaimStatus;
  operationalStatus?: GiftAidOperationalStatus;
  exportedAt?: string | null;
  exportBatchId?: string | null;
  exportActorId?: string | null;
  charitySubmittedReference?: string | null;
  paidConfirmed?: boolean;
  paidConfirmedAt?: string | null;

  // MANDATORY: Audit trail (compliance requirement)
  createdAt: string; // ISO timestamp when record was created
  updatedAt: string; // ISO timestamp when record was last modified
}

/**
 * Gift Aid details for frontend form collection
 * Maps to GiftAidDeclaration for backend storage
 *
 * COMPLIANCE NOTES:
 * - All monetary amounts must be in pence (integer values)
 * - donationId intentionally empty at form stage (populated by orchestration)
 * - declarationText must use HMRC_DECLARATION_TEXT constant
 */
export interface GiftAidDetails {
  // Donor Information
  donorTitle?: string;
  firstName: string;
  surname: string;
  houseNumber: string;
  addressLine1: string;
  addressLine2?: string;
  town: string;
  postcode: string;
  donorEmail?: string;

  // Declaration Requirements
  giftAidConsent: boolean;
  ukTaxpayerConfirmation: boolean;
  dataProcessingConsent?: boolean;
  homeAddressConfirmed?: boolean;
  declarationText: string;
  declarationTextVersion?: string;
  declarationDate: string;

  // Donation Context
  donationAmount: number;
  donationDate: string;
  organizationId: string;
  donationId: string;

  // Audit Trail
  timestamp: string;
  taxYear: string;
}
