import { getAuth } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { FUNCTION_URLS } from '@/shared/config/functions';
import { uploadImageAsset, type UploadedImageAsset } from '@/shared/lib/imageUpload';
import { db } from '../../../shared/lib/firebase';
import { type Organization, type OrganizationSettings } from '../model';

export type OrganizationSettingsAssetType = 'logo' | 'idleImage';

export type OrganizationSettingsUploadResult = UploadedImageAsset;

export interface OrganizationSettingsUpdateRequest {
  organizationId: string;
  section?: 'identity' | 'branding';
  settings: OrganizationSettings & {
    logoWidth?: number;
    logoHeight?: number;
  };
}

export interface OrganizationSettingsUpdateResponse {
  success: true;
  organizationId: string;
  settings: OrganizationSettings;
}

export interface SaveOrganizationSettingsParams {
  organizationId: string;
  section?: 'identity' | 'branding';
  displayName: string;
  accentColorHex: string;
  thankYouMessage?: string | null;
  logoUrl?: string | null;
  idleImageUrl?: string | null;
  logo?: OrganizationSettingsUploadResult | null;
  idleImage?: OrganizationSettingsUploadResult | null;
  logoDimensions?: {
    width: number;
    height: number;
  } | null;
}

const getCurrentUserToken = async () => {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error('Authentication token not found. Please log in.');
  }

  return token;
};

const normalizeNullableString = (value: string | null | undefined): string | null => {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const getFileExtension = (fileName: string, fileType: string) => {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex > -1 && dotIndex < fileName.length - 1) {
    return fileName.slice(dotIndex + 1).toLowerCase();
  }

  if (fileType === 'image/png') return 'png';
  if (fileType === 'image/webp') return 'webp';
  if (fileType === 'image/gif') return 'gif';
  return 'jpg';
};

const sanitizeFileName = (fileName: string) => {
  return fileName
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40);
};

const buildOrganizationSettingsAssetPath = (
  organizationId: string,
  assetType: OrganizationSettingsAssetType,
  file: File,
) => {
  const safeOrgId = organizationId.trim();
  const extension = getFileExtension(file.name, file.type);
  const baseName = sanitizeFileName(file.name.split('.').slice(0, -1).join('.') || assetType);
  const timestamp = Date.now();

  return `organizations/${safeOrgId}/settings/${assetType}/${timestamp}-${baseName}.${extension}`;
};

export const organizationApi = {
  // Get all organizations
  async getOrganizations(): Promise<Organization[]> {
    try {
      const q = query(collection(db, 'organizations'), orderBy('name', 'asc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(
        (docSnapshot) =>
          ({
            id: docSnapshot.id,
            ...docSnapshot.data(),
          }) as Organization,
      );
    } catch (error) {
      console.error('Error fetching organizations:', error);
      throw error;
    }
  },

  // Get organization by ID
  async getOrganizationById(id: string): Promise<Organization | null> {
    try {
      const docRef = doc(db, 'organizations', id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
        } as Organization;
      }
      return null;
    } catch (error) {
      console.error('Error fetching organization:', error);
      throw error;
    }
  },

  // Create new organization
  async createOrganization(organization: Omit<Organization, 'id'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'organizations'), {
        ...organization,
        tags: organization.tags || [],
        createdAt: new Date().toISOString(),
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating organization:', error);
      throw error;
    }
  },

  // Update organization
  async updateOrganization(id: string, updates: Partial<Organization>): Promise<void> {
    try {
      const docRef = doc(db, 'organizations', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      console.error('Error updating organization:', error);
      throw error;
    }
  },

  // Upload organization settings image to Firebase Storage
  async uploadOrganizationSettingsImage(
    organizationId: string,
    file: File,
    assetType: OrganizationSettingsAssetType,
  ): Promise<OrganizationSettingsUploadResult> {
    const trimmedOrganizationId = organizationId.trim();
    if (!trimmedOrganizationId) {
      throw new Error('organizationId is required for image upload');
    }

    const storagePath = buildOrganizationSettingsAssetPath(trimmedOrganizationId, assetType, file);
    return uploadImageAsset(file, storagePath, {
      requireSquare: assetType === 'logo',
    });
  },

  // Update organization settings through secure backend function
  async updateOrganizationSettings(
    request: OrganizationSettingsUpdateRequest,
  ): Promise<OrganizationSettingsUpdateResponse> {
    const token = await getCurrentUserToken();

    let response: Response;
    try {
      response = await fetch(FUNCTION_URLS.updateOrganizationSettings, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(request),
      });
    } catch {
      throw new Error(
        `Could not reach organization settings function at ${FUNCTION_URLS.updateOrganizationSettings}.`,
      );
    }

    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(responseData.error || 'Failed to update organization settings.');
    }

    return responseData as OrganizationSettingsUpdateResponse;
  },

  // Save settings using uploaded assets and include logo dimensions for backend validation
  async saveOrganizationSettings(
    params: SaveOrganizationSettingsParams,
  ): Promise<OrganizationSettingsUpdateResponse> {
    const resolvedLogoUrl = params.logo?.url ?? normalizeNullableString(params.logoUrl);
    const resolvedIdleImageUrl =
      params.idleImage?.url ?? normalizeNullableString(params.idleImageUrl);

    const payload: OrganizationSettingsUpdateRequest = {
      organizationId: params.organizationId,
      ...(params.section ? { section: params.section } : {}),
      settings: {
        displayName: params.displayName.trim(),
        logoUrl: resolvedLogoUrl,
        idleImageUrl: resolvedIdleImageUrl,
        accentColorHex: params.accentColorHex.trim(),
        thankYouMessage: normalizeNullableString(params.thankYouMessage),
      },
    };

    if (params.logo) {
      payload.settings.logoWidth = params.logo.width;
      payload.settings.logoHeight = params.logo.height;
    } else if (resolvedLogoUrl && params.logoDimensions) {
      payload.settings.logoWidth = params.logoDimensions.width;
      payload.settings.logoHeight = params.logoDimensions.height;
    }

    return this.updateOrganizationSettings(payload);
  },

  // Delete organization
  async deleteOrganization(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'organizations', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting organization:', error);
      throw error;
    }
  },

  // Get organization tags
  async getOrganizationTags(organizationId: string): Promise<string[]> {
    try {
      const docRef = doc(db, 'organizations', organizationId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        return data.tags || [];
      }
      return [];
    } catch (error) {
      console.error('Error fetching organization tags:', error);
      throw error;
    }
  },

  // Update organization tags
  async updateOrganizationTags(organizationId: string, tags: string[]): Promise<void> {
    try {
      const docRef = doc(db, 'organizations', organizationId);
      await updateDoc(docRef, { tags });
    } catch (error) {
      console.error('Error updating organization tags:', error);
      throw error;
    }
  },
};
