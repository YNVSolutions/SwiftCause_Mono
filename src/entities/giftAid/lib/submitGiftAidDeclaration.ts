import { giftAidApi } from '../api';
import { GiftAidDetails, GiftAidDeclaration } from '../model/types';
import { GIFT_AID_DECLARATION_TEXT_VERSION } from '../model';
import { getCampaignById } from '../../../shared/api/firestoreService';

export async function submitGiftAidDeclaration(
  giftAidDetails: GiftAidDetails,
  campaignId: string,
  campaignTitle: string,
): Promise<string> {
  // VALIDATION: Check if Gift Aid is enabled for this campaign
  try {
    const campaign = await getCampaignById(campaignId);
    if (!campaign || !campaign.configuration.giftAidEnabled) {
      throw new Error(
        `Gift Aid is not enabled for campaign ${campaignId}. Cannot create Gift Aid declaration.`,
      );
    }
  } catch (error) {
    console.error('Error validating campaign Gift Aid status:', error);
    throw new Error(
      `Failed to validate Gift Aid eligibility for campaign ${campaignId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }

  const mappedDeclaration: Omit<
    GiftAidDeclaration,
    'id' | 'createdAt' | 'updatedAt' | 'donationId'
  > = {
    donorTitle: giftAidDetails.donorTitle?.trim() || undefined,
    donorFirstName: giftAidDetails.firstName,
    donorSurname: giftAidDetails.surname,
    donorHouseNumber: giftAidDetails.houseNumber || '',
    donorAddressLine1: giftAidDetails.addressLine1,
    donorAddressLine2: giftAidDetails.addressLine2 || '',
    donorTown: giftAidDetails.town,
    donorPostcode: giftAidDetails.postcode,
    donorEmail: giftAidDetails.donorEmail?.trim() || undefined,

    declarationText: giftAidDetails.declarationText,
    declarationTextVersion:
      giftAidDetails.declarationTextVersion || GIFT_AID_DECLARATION_TEXT_VERSION,
    declarationDate: giftAidDetails.declarationDate,
    giftAidConsent: giftAidDetails.giftAidConsent,
    ukTaxpayerConfirmation: giftAidDetails.ukTaxpayerConfirmation,
    dataProcessingConsent: giftAidDetails.dataProcessingConsent ?? false,
    homeAddressConfirmed: giftAidDetails.homeAddressConfirmed ?? false,
    declarationUserAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',

    donationAmount: giftAidDetails.donationAmount,
    giftAidAmount: Math.round(giftAidDetails.donationAmount * 0.25),

    donationDate: giftAidDetails.donationDate,
    taxYear: giftAidDetails.taxYear,

    campaignId: campaignId,
    campaignTitle: campaignTitle,
    organizationId: giftAidDetails.organizationId,

    giftAidStatus: 'pending',
    hmrcClaimStatus: 'pending',
  };

  return await giftAidApi.createPendingGiftAidDeclaration(mappedDeclaration);
}
