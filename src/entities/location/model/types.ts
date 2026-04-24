// Location entity types for Firestore
export interface Location {
  id: string;
  orgId: string;

  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  country: string;

  isCommunityBuilding: boolean;

  geo?: {
    lat: number;
    lng: number;
  };

  createdAt: Date;
  createdBy?: string;

  kioskCount?: number;
}

export interface LocationFormData {
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postcode: string;
  country: string;
  isCommunityBuilding: boolean;
  latitude?: number;
  longitude?: number;
}

export interface LocationValidationError {
  field: keyof LocationFormData;
  message: string;
}
