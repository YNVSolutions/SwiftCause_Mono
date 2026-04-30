'use client';

import React, { useState, useMemo } from 'react';
import { Location, LocationFormData } from '../../../entities/location';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Label } from '../../../shared/ui/label';
import { Badge } from '../../../shared/ui/badge';
import { AlertCircle, Plus, MapPin, Building2, Edit2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';

export interface LocationFormProps {
  locations: Location[];
  selectedLocationId?: string;
  onLocationSelect: (locationId: string) => void;
  onCreateNew: () => void;
  onEditLocationStart?: (locationId: string) => void;
  isCreatingNew: boolean;
  formData?: LocationFormData;
  onFormDataChange?: (data: LocationFormData) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  isEditing?: boolean;
}

export function LocationForm({
  locations,
  selectedLocationId,
  onLocationSelect,
  onCreateNew,
  onEditLocationStart,
  isCreatingNew,
  formData,
  onFormDataChange,
  onSubmit,
  onCancel,
  isLoading = false,
  isEditing = false,
}: LocationFormProps) {
  const [showEditConfirm, setShowEditConfirm] = useState(false);

  const selectedLocation = useMemo(
    () => locations.find((loc) => loc.id === selectedLocationId),
    [locations, selectedLocationId],
  );

  const handleFormChange = (
    field: keyof LocationFormData,
    value: string | boolean | number | undefined,
  ) => {
    if (onFormDataChange && formData) {
      onFormDataChange({
        ...formData,
        [field]: value,
      });
    }
  };

  const handleEditClick = () => {
    if (isEditing) {
      setShowEditConfirm(true);
    }
  };

  const startEditingSelectedLocation = () => {
    if (!selectedLocation) return;

    onEditLocationStart?.(selectedLocation.id);
    onFormDataChange?.({
      name: selectedLocation.name || '',
      addressLine1: selectedLocation.addressLine1 || '',
      addressLine2: selectedLocation.addressLine2 || '',
      city: selectedLocation.city || '',
      postcode: selectedLocation.postcode || '',
      country: selectedLocation.country || 'UK',
      isCommunityBuilding: !!selectedLocation.isCommunityBuilding,
      latitude: selectedLocation.geo?.lat,
      longitude: selectedLocation.geo?.lng,
    });
    onCreateNew?.();
  };

  const isFormValid =
    !!formData?.name.trim() &&
    !!formData?.addressLine1.trim() &&
    !!formData?.city.trim() &&
    !!formData?.postcode.trim() &&
    !!formData?.country.trim();

  return (
    <div className="space-y-6">
      {/* Mode Selection Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => isCreatingNew && onCancel?.()}
          disabled={isLoading}
          className={`px-4 py-2 font-medium transition-colors relative ${
            !isCreatingNew ? 'text-gray-700 hover:text-gray-900' : 'text-green-600'
          }`}
        >
          Select Existing
          {!isCreatingNew && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-600 rounded-t" />
          )}
        </button>
        <button
          onClick={() => !isCreatingNew && onCreateNew?.()}
          disabled={isLoading}
          className={`px-4 py-2 font-medium transition-colors relative ${
            isCreatingNew ? 'text-gray-700 hover:text-gray-900' : 'text-green-600'
          }`}
        >
          Create New
          {isCreatingNew && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-600 rounded-t" />
          )}
        </button>
      </div>

      {/* Option A: Select Existing Location */}
      {!isCreatingNew && (
        <div className="space-y-4">
          <div>
            <Label
              htmlFor="location-select"
              className="text-sm font-medium text-gray-700 mb-2 block"
            >
              SELECT LOCATION
            </Label>
            <Select value={selectedLocationId || ''} onValueChange={onLocationSelect}>
              <SelectTrigger id="location-select" className="w-full">
                <SelectValue placeholder="Choose a location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.length === 0 ? (
                  <div className="p-4 text-center text-gray-500 text-sm">
                    No locations available. Create one first.
                  </div>
                ) : (
                  locations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4" />
                        <span>{location.name}</span>
                        <span className="text-gray-500">({location.postcode})</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Location Details */}
          {selectedLocation && (
            <div className="bg-linear-to-br from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedLocation.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedLocation.addressLine1}
                      {selectedLocation.addressLine2 && <>, {selectedLocation.addressLine2}</>}
                    </p>
                    <p className="text-sm text-gray-600">
                      {selectedLocation.city}, {selectedLocation.postcode},{' '}
                      {selectedLocation.country}
                    </p>
                  </div>
                </div>
                {selectedLocation.isCommunityBuilding && (
                  <Badge className="bg-blue-100 text-blue-800 border-0">Community Building</Badge>
                )}
              </div>

              {/* Edit Location Button */}
              {isEditing && (
                <div className="pt-2 border-t border-gray-200">
                  <button
                    onClick={handleEditClick}
                    className="flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit Location Details
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Edit Location Dialog/Confirmation */}
          {showEditConfirm && selectedLocation && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-semibold text-amber-900">
                    Editing this location will create a new location record.
                  </p>
                  <p className="text-sm text-amber-800">
                    This will be treated as a new building for compliance purposes. Past donations
                    will remain linked to the original location. Any new donations will be
                    associated with the updated location.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowEditConfirm(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setShowEditConfirm(false);
                    startEditingSelectedLocation();
                  }}
                  disabled={isLoading}
                >
                  Create Updated Location
                </Button>
              </div>
            </div>
          )}

          {/* Create New Location Link */}
          <div className="pt-2">
            <button
              onClick={onCreateNew}
              disabled={isLoading}
              className="flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Location
            </button>
          </div>
        </div>
      )}

      {/* Option B: Create New Location Form */}
      {isCreatingNew && formData && (
        <div className="space-y-4">
          {/* Required Fields */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="lg:col-span-2">
              <Label htmlFor="loc-name" className="text-sm font-medium text-gray-700 mb-2 block">
                LOCATION NAME <span className="text-red-500">*</span>
              </Label>
              <Input
                id="loc-name"
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                placeholder="e.g., Main Office, Community Center"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label
                htmlFor="loc-address1"
                className="text-sm font-medium text-gray-700 mb-2 block"
              >
                ADDRESS LINE 1 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="loc-address1"
                value={formData.addressLine1}
                onChange={(e) => handleFormChange('addressLine1', e.target.value)}
                placeholder="Street address"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label
                htmlFor="loc-address2"
                className="text-sm font-medium text-gray-700 mb-2 block"
              >
                ADDRESS LINE 2
              </Label>
              <Input
                id="loc-address2"
                value={formData.addressLine2 || ''}
                onChange={(e) => handleFormChange('addressLine2', e.target.value)}
                placeholder="Apartment, suite, etc."
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="loc-city" className="text-sm font-medium text-gray-700 mb-2 block">
                CITY <span className="text-red-500">*</span>
              </Label>
              <Input
                id="loc-city"
                value={formData.city}
                onChange={(e) => handleFormChange('city', e.target.value)}
                placeholder="City"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label
                htmlFor="loc-postcode"
                className="text-sm font-medium text-gray-700 mb-2 block"
              >
                POSTCODE <span className="text-red-500">*</span>
              </Label>
              <Input
                id="loc-postcode"
                value={formData.postcode}
                onChange={(e) => handleFormChange('postcode', e.target.value)}
                placeholder="Postcode (required for HMRC)"
                disabled={isLoading}
              />
            </div>

            <div>
              <Label htmlFor="loc-country" className="text-sm font-medium text-gray-700 mb-2 block">
                COUNTRY <span className="text-red-500">*</span>
              </Label>
              <Input
                id="loc-country"
                value={formData.country}
                onChange={(e) => handleFormChange('country', e.target.value)}
                placeholder="Country (default: UK)"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Optional Fields */}
          <div className="border-t border-gray-200 pt-4 space-y-4">
            <h3 className="font-semibold text-gray-900">Optional Information</h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="loc-lat" className="text-sm font-medium text-gray-700 mb-2 block">
                  LATITUDE
                </Label>
                <Input
                  id="loc-lat"
                  type="number"
                  step="0.0001"
                  value={formData.latitude ?? ''}
                  onChange={(e) =>
                    handleFormChange(
                      'latitude',
                      e.target.value ? parseFloat(e.target.value) : undefined,
                    )
                  }
                  placeholder="e.g., 51.5074"
                  disabled={isLoading}
                />
              </div>

              <div>
                <Label htmlFor="loc-lng" className="text-sm font-medium text-gray-700 mb-2 block">
                  LONGITUDE
                </Label>
                <Input
                  id="loc-lng"
                  type="number"
                  step="0.0001"
                  value={formData.longitude ?? ''}
                  onChange={(e) =>
                    handleFormChange(
                      'longitude',
                      e.target.value ? parseFloat(e.target.value) : undefined,
                    )
                  }
                  placeholder="e.g., -0.1278"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <input
                type="checkbox"
                id="loc-community"
                checked={formData.isCommunityBuilding}
                onChange={(e) => handleFormChange('isCommunityBuilding', e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4 rounded"
              />
              <Label
                htmlFor="loc-community"
                className="text-sm font-medium text-gray-700 cursor-pointer"
              >
                This is a community building
              </Label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={onSubmit} disabled={isLoading || !isFormValid}>
              {isLoading ? 'Saving...' : isEditing ? 'Create Updated Location' : 'Create Location'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
