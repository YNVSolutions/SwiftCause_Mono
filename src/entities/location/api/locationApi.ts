import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../../shared/lib/firebase';
import { Location, LocationFormData } from '../model';

function normalizeLocationFormData(formData: LocationFormData): LocationFormData {
  return {
    ...formData,
    name: formData.name.trim(),
    addressLine1: formData.addressLine1.trim(),
    addressLine2: formData.addressLine2?.trim() || '',
    city: formData.city.trim(),
    postcode: formData.postcode.trim(),
    country: formData.country.trim() || 'UK',
  };
}

function validateRequiredLocationFields(formData: LocationFormData): void {
  if (!formData.name) throw new Error('Location name is required');
  if (!formData.addressLine1) throw new Error('Location address line 1 is required');
  if (!formData.city) throw new Error('Location city is required');
  if (!formData.postcode) throw new Error('Location postcode is required');
  if (!formData.country) throw new Error('Location country is required');
}

function validateGeoCoordinates(formData: LocationFormData): void {
  const hasLatitude = typeof formData.latitude === 'number' && Number.isFinite(formData.latitude);
  const hasLongitude =
    typeof formData.longitude === 'number' && Number.isFinite(formData.longitude);

  if (hasLatitude !== hasLongitude) {
    throw new Error('Both latitude and longitude are required when setting geo coordinates');
  }

  if (hasLatitude && hasLongitude) {
    if (formData.latitude! < -90 || formData.latitude! > 90) {
      throw new Error('Latitude must be between -90 and 90');
    }
    if (formData.longitude! < -180 || formData.longitude! > 180) {
      throw new Error('Longitude must be between -180 and 180');
    }
  }
}

/**
 * Get all locations for an organization
 */
export async function getLocationsByOrgId(organizationId: string): Promise<Location[]> {
  try {
    const q = query(
      collection(db, 'locations'),
      where('orgId', '==', organizationId),
      orderBy('name', 'asc'),
    );

    const snapshot = await getDocs(q);
    const locations: Location[] = snapshot.docs.map(
      (doc) =>
        ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate?.() || new Date(),
        }) as Location,
    );

    return locations;
  } catch (error) {
    console.error('Error fetching locations:', error);
    throw error;
  }
}

/**
 * Get a single location by ID
 */
export async function getLocationById(id: string): Promise<Location | null> {
  try {
    const docRef = doc(db, 'locations', id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        createdAt: docSnap.data().createdAt?.toDate?.() || new Date(),
      } as Location;
    }
    return null;
  } catch (error) {
    console.error('Error fetching location:', error);
    throw error;
  }
}

/**
 * Create a new location and return its document ID.
 */
export async function createLocation(
  organizationId: string,
  formData: LocationFormData,
  userId?: string,
): Promise<string> {
  try {
    const normalizedData = normalizeLocationFormData(formData);
    validateRequiredLocationFields(normalizedData);
    validateGeoCoordinates(normalizedData);

    const hasLatitude =
      typeof normalizedData.latitude === 'number' && Number.isFinite(normalizedData.latitude);
    const hasLongitude =
      typeof normalizedData.longitude === 'number' && Number.isFinite(normalizedData.longitude);

    const locationData = {
      orgId: organizationId,
      name: normalizedData.name,
      addressLine1: normalizedData.addressLine1,
      addressLine2: normalizedData.addressLine2 || null,
      city: normalizedData.city,
      postcode: normalizedData.postcode,
      country: normalizedData.country,
      isCommunityBuilding: normalizedData.isCommunityBuilding,
      ...(hasLatitude && hasLongitude
        ? {
            geo: {
              lat: normalizedData.latitude!,
              lng: normalizedData.longitude!,
            },
          }
        : {}),
      createdAt: new Date(),
      createdBy: userId || null,
      kioskCount: 0,
    };

    const docRef = await addDoc(collection(db, 'locations'), locationData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating location:', error);
    throw error;
  }
}

/**
 * Update a location by creating a new document (immutability pattern).
 */
export async function updateLocationImmutable(
  organizationId: string,
  _oldLocationId: string,
  formData: LocationFormData,
  userId?: string,
): Promise<string> {
  try {
    const newLocationId = await createLocation(organizationId, formData, userId);

    return newLocationId;
  } catch (error) {
    console.error('Error updating location (immutable):', error);
    throw error;
  }
}

/**
 * Delete a location.
 */
export async function deleteLocation(id: string): Promise<void> {
  try {
    const docRef = doc(db, 'locations', id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting location:', error);
    throw error;
  }
}

/**
 * Update kiosk count for a location.
 */
export async function updateLocationKioskCount(locationId: string, count: number): Promise<void> {
  try {
    const docRef = doc(db, 'locations', locationId);
    await updateDoc(docRef, { kioskCount: count });
  } catch (error) {
    console.error('Error updating location kiosk count:', error);
    throw error;
  }
}

export const locationApi = {
  getLocationsByOrgId,
  getLocationById,
  createLocation,
  updateLocationImmutable,
  deleteLocation,
  updateLocationKioskCount,
};
