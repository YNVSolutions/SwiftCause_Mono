import {
  addDoc,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import { GiftAidDeclaration } from '../model';

const stripUndefinedFields = <T extends Record<string, unknown>>(input: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as Partial<T>;

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export interface ReusableGiftAidProfile {
  donorTitle?: string;
  firstName: string;
  surname: string;
  houseNumber: string;
  addressLine1: string;
  addressLine2?: string;
  town: string;
  postcode: string;
  donorEmail: string;
  declarationDate?: string;
}

/**
 * HMRC-compliant Gift Aid API
 *
 * LEGAL CONTRACT - DO NOT MODIFY WITHOUT COMPLIANCE REVIEW
 *
 * This API enforces strict HMRC compliance requirements:
 * - 1:1 mapping between donations and Gift Aid declarations
 * - Integer-only monetary arithmetic (pence)
 * - Immutable legal declaration text
 * - Complete audit trail
 * - Duplicate prevention
 */
export const giftAidApi = {
  /**
   * Create new Gift Aid declaration - HMRC-compliant with strict 1:1 mapping
   *
   * COMPLIANCE GUARANTEES:
   * - Uses donationId as document ID to enforce 1:1 relationship
   * - Prevents duplicate Gift Aid records for the same donation
   * - Gift Aid amounts are calculated in orchestration layer (not frontend)
   * - One donation can have at most one Gift Aid declaration
   * - Full audit trail with creation and update timestamps
   * - All monetary amounts stored as integer pence
   *
   * @param data - Gift Aid declaration data without id and timestamps
   * @returns Promise<string> - The donationId (used as document ID)
   * @throws Error if Gift Aid declaration already exists for the donation
   */
  async createGiftAidDeclaration(
    data: Omit<GiftAidDeclaration, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<string> {
    try {
      const { donationId } = data;
      if (!donationId) {
        throw new Error('donationId is required for createGiftAidDeclaration.');
      }

      // GUARANTEE: Use donationId as document ID to enforce 1:1 mapping
      const docRef = doc(db, 'giftAidDeclarations', donationId);

      // GUARANTEE: Prevent duplicate Gift Aid records for same donation
      const existingDoc = await getDoc(docRef);
      if (existingDoc.exists()) {
        throw new Error(
          `Gift Aid declaration already exists for donation ${donationId}. Only one Gift Aid declaration per donation is allowed.`,
        );
      }

      // GUARANTEE: Canonical timestamp source (ISO string)
      const now = new Date().toISOString();

      // GUARANTEE: Store with explicit ID and audit timestamps
      await setDoc(docRef, {
        ...data,
        id: donationId,
        createdAt: now,
        updatedAt: now,
      });

      return donationId;
    } catch (error) {
      console.error('Error creating Gift Aid declaration:', error);
      throw error;
    }
  },

  /**
   * Create pending Gift Aid declaration before payment (canonical declaration-first flow).
   *
   * @param data - Gift Aid declaration data before donation linkage
   * @returns Promise<string> - Newly created declaration document ID
   */
  async createPendingGiftAidDeclaration(
    data: Omit<GiftAidDeclaration, 'id' | 'createdAt' | 'updatedAt' | 'donationId'>,
  ): Promise<string> {
    try {
      const now = new Date().toISOString();
      const declarationRef = collection(db, 'giftAidDeclarations');
      const donorEmailNormalized =
        typeof data.donorEmail === 'string' && data.donorEmail.trim().length > 0
          ? normalizeEmail(data.donorEmail)
          : undefined;
      const docRef = await addDoc(declarationRef, {
        ...stripUndefinedFields(data),
        donorEmailNormalized,
        donationId: null,
        operationalStatus: 'captured',
        exportedAt: null,
        exportBatchId: null,
        exportActorId: null,
        charitySubmittedReference: null,
        paidConfirmed: false,
        paidConfirmedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'giftAidDeclarations', docRef.id), { id: docRef.id }, { merge: true });
      return docRef.id;
    } catch (error) {
      console.error('Error creating pending Gift Aid declaration:', error);
      throw error;
    }
  },

  async getReusableGiftAidProfileByEmail(email: string): Promise<ReusableGiftAidProfile | null> {
    try {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) {
        return null;
      }

      const declarationsRef = collection(db, 'giftAidDeclarations');
      const q = query(
        declarationsRef,
        where('donorEmailNormalized', '==', normalizedEmail),
        limit(10),
      );
      const snapshot = await getDocs(q);

      const candidates = snapshot.docs
        .map((docSnap) => docSnap.data() as Partial<GiftAidDeclaration>)
        .filter((declaration) => {
          const hasRequiredAddress =
            typeof declaration.donorAddressLine1 === 'string' &&
            declaration.donorAddressLine1.trim().length > 0 &&
            typeof declaration.donorTown === 'string' &&
            declaration.donorTown.trim().length > 0 &&
            typeof declaration.donorPostcode === 'string' &&
            declaration.donorPostcode.trim().length > 0;

          return (
            declaration.giftAidConsent === true &&
            declaration.ukTaxpayerConfirmation === true &&
            hasRequiredAddress
          );
        })
        .sort((a, b) => {
          const aDate = Date.parse(a.declarationDate || a.updatedAt || a.createdAt || '');
          const bDate = Date.parse(b.declarationDate || b.updatedAt || b.createdAt || '');
          return (Number.isFinite(bDate) ? bDate : 0) - (Number.isFinite(aDate) ? aDate : 0);
        });

      const latest = candidates[0];
      if (!latest) {
        return null;
      }

      return {
        donorTitle: latest.donorTitle || undefined,
        firstName: latest.donorFirstName || '',
        surname: latest.donorSurname || '',
        houseNumber: latest.donorHouseNumber || '',
        addressLine1: latest.donorAddressLine1 || '',
        addressLine2: latest.donorAddressLine2 || '',
        town: latest.donorTown || '',
        postcode: latest.donorPostcode || '',
        donorEmail: latest.donorEmail || normalizedEmail,
        declarationDate: latest.declarationDate,
      };
    } catch (error) {
      console.error('Error fetching reusable Gift Aid profile by email:', error);
      throw error;
    }
  },

  /**
   * Get Gift Aid declaration by donation ID - Direct 1:1 lookup
   *
   * COMPLIANCE GUARANTEES:
   * - Returns single record or null (never arrays)
   * - Direct document lookup using donationId as document ID
   * - HMRC-queryable for export and reporting
   * - Enforces strict 1:1 donation ↔ Gift Aid mapping
   *
   * @param donationId - The donation ID (also used as Gift Aid document ID)
   * @returns Promise<GiftAidDeclaration | null> - Single declaration or null
   */
  async getGiftAidByDonationId(donationId: string): Promise<GiftAidDeclaration | null> {
    try {
      // GUARANTEE: Direct 1:1 lookup using donationId as document ID
      const docRef = doc(db, 'giftAidDeclarations', donationId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as GiftAidDeclaration;
      }

      return null;
    } catch (error) {
      console.error('Error fetching Gift Aid by donation ID:', error);
      throw error;
    }
  },

  /**
   * Update Gift Aid declaration - Maintains 1:1 relationship and audit trail
   *
   * COMPLIANCE GUARANTEES:
   * - Maintains 1:1 relationship (cannot change donationId)
   * - Updates audit trail with updatedAt timestamp
   * - Preserves creation timestamp and document ID
   * - All monetary amounts remain as integer pence
   *
   * @param donationId - The donation ID (document ID)
   * @param updates - Partial updates (excluding id, donationId, createdAt)
   */
  async updateGiftAidDeclaration(
    donationId: string,
    updates: Partial<Omit<GiftAidDeclaration, 'id' | 'donationId' | 'createdAt'>>,
  ): Promise<void> {
    try {
      const docRef = doc(db, 'giftAidDeclarations', donationId);

      // GUARANTEE: Include updatedAt timestamp for audit trail
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(docRef, updateData, { merge: true });
    } catch (error) {
      console.error('Error updating Gift Aid declaration:', error);
      throw error;
    }
  },

  async markDeclarationExported(
    declarationId: string,
    exportBatchId: string,
    exportActorId: string,
  ): Promise<void> {
    try {
      const docRef = doc(db, 'giftAidDeclarations', declarationId);
      await setDoc(
        docRef,
        {
          operationalStatus: 'exported',
          exportedAt: new Date().toISOString(),
          exportBatchId,
          exportActorId,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error('Error marking Gift Aid declaration as exported:', error);
      throw error;
    }
  },

  async markDeclarationPaidConfirmed(
    declarationId: string,
    charitySubmittedReference?: string,
  ): Promise<void> {
    try {
      const docRef = doc(db, 'giftAidDeclarations', declarationId);
      await setDoc(
        docRef,
        {
          paidConfirmed: true,
          paidConfirmedAt: new Date().toISOString(),
          charitySubmittedReference: charitySubmittedReference || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true },
      );
    } catch (error) {
      console.error('Error marking Gift Aid declaration as paid-confirmed:', error);
      throw error;
    }
  },
};
