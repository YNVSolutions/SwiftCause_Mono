import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Image as ImageIcon,
  Loader2,
  Palette,
  RotateCcw,
  Save,
  Trash2,
  Type,
} from 'lucide-react';
import { AdminLayout } from './AdminLayout';
import { AdminSession, Permission, Screen } from '../../shared/types';
import { Button } from '../../shared/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../shared/ui/card';
import { Input } from '../../shared/ui/input';
import { Label } from '../../shared/ui/label';
import { Textarea } from '../../shared/ui/textarea';
import { SquareImageCropDialog } from '../../shared/ui/SquareImageCropDialog';
import { useOrganization } from '../../shared/lib/hooks/useOrganization';
import {
  organizationApi,
  type OrganizationSettingsUploadResult,
} from '../../entities/organization';
import { useToast } from '../../shared/ui/ToastProvider';
import { VALIDATION_LIMITS } from '../../shared/config/constants';
import { OrganizationSwitcher } from './OrganizationSwitcher';

interface OrganizationSettingsProps {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  userSession: AdminSession;
  hasPermission: (permission: Permission) => boolean;
  onOrganizationSwitch?: (organizationId: string, organizationName?: string) => void;
}

const ACCENT_COLOR_FALLBACK = '#0E8F5A';
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

const loadImageDimensionsFromUrl = (url: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => reject(new Error('Failed to read image dimensions'));
    image.src = url;
  });
};

export function OrganizationSettings({
  onNavigate,
  onLogout,
  userSession,
  hasPermission,
  onOrganizationSwitch,
}: OrganizationSettingsProps) {
  const organizationId = userSession.user.organizationId ?? null;
  const { organization, loading, error } = useOrganization(organizationId);
  const { showToast } = useToast();

  const canEditIdentity =
    userSession.user.role === 'admin' ||
    userSession.user.role === 'super_admin' ||
    hasPermission('change_org_identity');
  const canEditBranding =
    userSession.user.role === 'admin' ||
    userSession.user.role === 'super_admin' ||
    hasPermission('change_org_branding');
  const canManageSettings = canEditIdentity || canEditBranding;
  const canSwitchOrganization =
    userSession.user.role === 'super_admin' && hasPermission('system_admin');
  const resolvedOrganizationName =
    organization?.settings?.displayName ||
    organization?.name ||
    userSession.user.organizationName ||
    null;

  const [displayName, setDisplayName] = useState('');
  const [accentColorHex, setAccentColorHex] = useState(ACCENT_COLOR_FALLBACK);
  const [thankYouMessage, setThankYouMessage] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [idleImageUrl, setIdleImageUrl] = useState<string | null>(null);
  const [logoDimensions, setLogoDimensions] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [pendingLogo, setPendingLogo] = useState<OrganizationSettingsUploadResult | null>(null);
  const [pendingIdleImage, setPendingIdleImage] = useState<OrganizationSettingsUploadResult | null>(
    null,
  );
  const [savingSection, setSavingSection] = useState<'identity' | 'branding' | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingIdleImage, setIsUploadingIdleImage] = useState(false);
  const [logoFileToCrop, setLogoFileToCrop] = useState<File | null>(null);
  const [isLogoCropDialogOpen, setIsLogoCropDialogOpen] = useState(false);
  const [idleImageFileToCrop, setIdleImageFileToCrop] = useState<File | null>(null);
  const [isIdleImageCropDialogOpen, setIsIdleImageCropDialogOpen] = useState(false);
  const headerOrganizationName = resolvedOrganizationName;

  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const idleImageInputRef = useRef<HTMLInputElement | null>(null);
  const pendingOppositeSectionDraftRef = useRef<{
    identity?: {
      displayName: string;
      thankYouMessage: string;
    };
    branding?: {
      accentColorHex: string;
      logoUrl: string | null;
      idleImageUrl: string | null;
      pendingLogo: OrganizationSettingsUploadResult | null;
      pendingIdleImage: OrganizationSettingsUploadResult | null;
      logoDimensions: { width: number; height: number } | null;
    };
  } | null>(null);

  useEffect(() => {
    if (!organization) {
      return;
    }

    const draftToRestore = pendingOppositeSectionDraftRef.current;
    setDisplayName(organization.settings?.displayName || organization.name || '');
    setAccentColorHex(organization.settings?.accentColorHex || ACCENT_COLOR_FALLBACK);
    setThankYouMessage(organization.settings?.thankYouMessage || '');
    setLogoUrl(organization.settings?.logoUrl || null);
    setIdleImageUrl(organization.settings?.idleImageUrl || null);
    setPendingLogo(null);
    setPendingIdleImage(null);
    setLogoDimensions(null);

    if (draftToRestore?.identity) {
      setDisplayName(draftToRestore.identity.displayName);
      setThankYouMessage(draftToRestore.identity.thankYouMessage);
    }

    if (draftToRestore?.branding) {
      setAccentColorHex(draftToRestore.branding.accentColorHex);
      setLogoUrl(draftToRestore.branding.logoUrl);
      setIdleImageUrl(draftToRestore.branding.idleImageUrl);
      setPendingLogo(draftToRestore.branding.pendingLogo);
      setPendingIdleImage(draftToRestore.branding.pendingIdleImage);
      setLogoDimensions(draftToRestore.branding.logoDimensions);
    }

    pendingOppositeSectionDraftRef.current = null;
  }, [organization]);

  useEffect(() => {
    if (!logoUrl) {
      setLogoDimensions(null);
      return;
    }

    if (pendingLogo && pendingLogo.url === logoUrl) {
      setLogoDimensions({
        width: pendingLogo.width,
        height: pendingLogo.height,
      });
      return;
    }

    let isMounted = true;
    loadImageDimensionsFromUrl(logoUrl)
      .then((dimensions) => {
        if (isMounted) {
          setLogoDimensions(dimensions);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLogoDimensions(null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [logoUrl, pendingLogo]);

  const displayNameMax = VALIDATION_LIMITS.organization.displayName.max;
  const thankYouMessageMax = VALIDATION_LIMITS.organization.thankYouMessage.max;
  const displayNameLength = displayName.trim().length;
  const thankYouMessageLength = thankYouMessage.trim().length;

  const hasIdentityChanges = useMemo(() => {
    if (!organization) {
      return false;
    }

    const originalDisplayName = organization.settings?.displayName || organization.name || '';
    const originalThankYouMessage = organization.settings?.thankYouMessage || '';

    return (
      displayName.trim() !== originalDisplayName.trim() ||
      thankYouMessage.trim() !== originalThankYouMessage.trim()
    );
  }, [organization, displayName, thankYouMessage]);

  const hasBrandingChanges = useMemo(() => {
    if (!organization) {
      return false;
    }

    const originalAccentColorHex = organization.settings?.accentColorHex || ACCENT_COLOR_FALLBACK;
    const originalLogoUrl = organization.settings?.logoUrl || null;
    const originalIdleImageUrl = organization.settings?.idleImageUrl || null;

    return (
      accentColorHex.trim() !== originalAccentColorHex.trim() ||
      logoUrl !== originalLogoUrl ||
      idleImageUrl !== originalIdleImageUrl
    );
  }, [organization, accentColorHex, logoUrl, idleImageUrl]);

  const handleUploadImage = async (file: File, assetType: 'logo' | 'idleImage') => {
    if (!organizationId) {
      showToast('Organization ID is missing.', 'error');
      return;
    }

    const setLoading = assetType === 'logo' ? setIsUploadingLogo : setIsUploadingIdleImage;
    setLoading(true);
    try {
      const uploadedAsset = await organizationApi.uploadOrganizationSettingsImage(
        organizationId,
        file,
        assetType,
      );

      if (assetType === 'logo') {
        setPendingLogo(uploadedAsset);
        setLogoUrl(uploadedAsset.url);
        setLogoDimensions({
          width: uploadedAsset.width,
          height: uploadedAsset.height,
        });
      } else {
        setPendingIdleImage(uploadedAsset);
        setIdleImageUrl(uploadedAsset.url);
      }

      showToast(
        `${assetType === 'logo' ? 'Logo' : 'Idle image'} uploaded successfully.`,
        'success',
      );
    } catch (uploadError) {
      const message =
        uploadError instanceof Error
          ? uploadError.message
          : `Failed to upload ${assetType === 'logo' ? 'logo' : 'idle image'}.`;
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';

    if (file.type === 'image/svg+xml') {
      await handleUploadImage(file, 'logo');
      return;
    }

    setLogoFileToCrop(file);
    setIsLogoCropDialogOpen(true);
  };

  const handleIdleImageFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIdleImageFileToCrop(file);
    setIsIdleImageCropDialogOpen(true);
    event.target.value = '';
  };

  const handleResetAccentColor = () => {
    setAccentColorHex(ACCENT_COLOR_FALLBACK);
  };

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setPendingLogo(null);
    setLogoDimensions(null);
    setLogoFileToCrop(null);
    setIsLogoCropDialogOpen(false);
  };

  const handleRemoveIdleImage = () => {
    setIdleImageUrl(null);
    setPendingIdleImage(null);
    setIdleImageFileToCrop(null);
    setIsIdleImageCropDialogOpen(false);
  };

  const handleSaveSection = async (section: 'identity' | 'branding') => {
    const currentOrganization = organization;
    if (!currentOrganization) {
      showToast('Organization record is not available.', 'error');
      return;
    }

    const hasSectionPermission = section === 'identity' ? canEditIdentity : canEditBranding;
    if (!hasSectionPermission) {
      showToast(
        section === 'identity'
          ? 'You do not have permission to change organization identity.'
          : 'You do not have permission to change organization branding.',
        'error',
      );
      return;
    }

    if (section === 'identity' && !hasIdentityChanges) {
      return;
    }
    if (section === 'branding' && !hasBrandingChanges) {
      return;
    }

    if (!organizationId) {
      showToast('Organization ID is missing.', 'error');
      return;
    }

    const trimmedDisplayName = displayName.trim();
    const trimmedAccentColorHex = accentColorHex.trim();
    const trimmedThankYouMessage = thankYouMessage.trim();

    if (!trimmedDisplayName) {
      showToast('Organization display name is required.', 'error');
      return;
    }
    if (trimmedDisplayName.length > displayNameMax) {
      showToast(`Display name must be ${displayNameMax} characters or fewer.`, 'error');
      return;
    }
    if (!HEX_COLOR_REGEX.test(trimmedAccentColorHex)) {
      showToast('Accent color must be in #RRGGBB format.', 'error');
      return;
    }
    if (trimmedThankYouMessage.length > thankYouMessageMax) {
      showToast(`Thank-you message must be ${thankYouMessageMax} characters or fewer.`, 'error');
      return;
    }

    let resolvedLogoDimensions = logoDimensions;
    if (logoUrl && !resolvedLogoDimensions) {
      try {
        resolvedLogoDimensions = await loadImageDimensionsFromUrl(logoUrl);
        setLogoDimensions(resolvedLogoDimensions);
      } catch {
        showToast('Unable to validate logo dimensions. Please re-upload logo.', 'error');
        return;
      }
    }

    setSavingSection(section);
    try {
      const draftToPreserve =
        section === 'identity' && hasBrandingChanges
          ? {
              branding: {
                accentColorHex,
                logoUrl,
                idleImageUrl,
                pendingLogo,
                pendingIdleImage,
                logoDimensions,
              },
            }
          : section === 'branding' && hasIdentityChanges
            ? {
                identity: {
                  displayName,
                  thankYouMessage,
                },
              }
            : null;
      pendingOppositeSectionDraftRef.current = draftToPreserve;

      const persistedDisplayName = (
        currentOrganization.settings?.displayName ||
        currentOrganization.name ||
        ''
      ).trim();
      const persistedThankYouMessage = (currentOrganization.settings?.thankYouMessage || '').trim();
      const persistedAccentColorHex = (
        currentOrganization.settings?.accentColorHex || ACCENT_COLOR_FALLBACK
      ).trim();
      const persistedLogoUrl = currentOrganization.settings?.logoUrl || null;
      const persistedIdleImageUrl = currentOrganization.settings?.idleImageUrl || null;
      const isIdentitySave = section === 'identity';

      await organizationApi.saveOrganizationSettings({
        organizationId,
        section,
        displayName: isIdentitySave ? trimmedDisplayName : persistedDisplayName,
        accentColorHex: isIdentitySave ? persistedAccentColorHex : trimmedAccentColorHex,
        thankYouMessage: isIdentitySave
          ? trimmedThankYouMessage || null
          : persistedThankYouMessage || null,
        logoUrl: isIdentitySave ? persistedLogoUrl : logoUrl,
        idleImageUrl: isIdentitySave ? persistedIdleImageUrl : idleImageUrl,
        logo: isIdentitySave ? null : pendingLogo,
        idleImage: isIdentitySave ? null : pendingIdleImage,
        logoDimensions: resolvedLogoDimensions,
      });

      if (section === 'branding') {
        setPendingLogo(null);
        setPendingIdleImage(null);
      }
      onOrganizationSwitch?.(organizationId, trimmedDisplayName);
      showToast(
        section === 'identity'
          ? 'Identity settings updated successfully.'
          : 'Branding settings updated successfully.',
        'success',
      );
    } catch (saveError) {
      pendingOppositeSectionDraftRef.current = null;
      const message =
        saveError instanceof Error ? saveError.message : 'Failed to update organization settings.';
      showToast(message, 'error');
    } finally {
      setSavingSection(null);
    }
  };

  if (loading) {
    return (
      <AdminLayout
        onNavigate={onNavigate}
        onLogout={onLogout}
        userSession={userSession}
        hasPermission={hasPermission}
        activeScreen="admin-organization-settings"
      >
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !organization) {
    return (
      <AdminLayout
        onNavigate={onNavigate}
        onLogout={onLogout}
        userSession={userSession}
        hasPermission={hasPermission}
        activeScreen="admin-organization-settings"
      >
        <div className="flex h-full items-center justify-center">
          <Card className="w-full max-w-lg border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-700">Unable To Load Settings</CardTitle>
              <CardDescription className="text-red-600">
                {error || 'Organization record is not available.'}
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  if (!canManageSettings) {
    return (
      <AdminLayout
        onNavigate={onNavigate}
        onLogout={onLogout}
        userSession={userSession}
        hasPermission={hasPermission}
        activeScreen="admin-organization-settings"
      >
        <div className="mx-auto w-full max-w-3xl px-6 pt-16">
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle className="text-amber-800">Access Restricted</CardTitle>
              <CardDescription className="text-amber-700">
                Only organization admins can edit organization settings.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  return (
    <>
      <AdminLayout
        onNavigate={onNavigate}
        onLogout={onLogout}
        userSession={userSession}
        hasPermission={hasPermission}
        activeScreen="admin-organization-settings"
        headerTitle={
          <div className="flex flex-col">
            {headerOrganizationName && (
              <div className="mb-1 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-xs font-semibold tracking-wide text-emerald-700">
                  {headerOrganizationName}
                </span>
              </div>
            )}
            <h1 className="text-2xl font-semibold tracking-tight text-slate-800">
              Organization Settings
            </h1>
          </div>
        }
        headerSubtitle="Manage branding and kiosk display preferences for your organization"
        headerTopRightActions={
          canSwitchOrganization && onOrganizationSwitch ? (
            <OrganizationSwitcher
              userSession={userSession}
              onOrganizationChange={onOrganizationSwitch}
              selectedOrganizationName={resolvedOrganizationName || undefined}
            />
          ) : undefined
        }
      >
        <main className="mx-auto max-w-6xl space-y-6 px-6 pb-8 pt-10 lg:px-8">
          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Type className="h-5 w-5 text-emerald-600" />
                  Identity
                </CardTitle>
                <CardDescription>
                  Set how your organization appears on kiosk devices.
                </CardDescription>
              </div>
              <Button
                onClick={() => void handleSaveSection('identity')}
                disabled={savingSection !== null || !hasIdentityChanges || !canEditIdentity}
              >
                {savingSection === 'identity' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Identity
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="display-name">Organization Display Name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={displayNameMax}
                  placeholder="Enter display name"
                  disabled={!canEditIdentity}
                />
                <p className="text-xs text-gray-500">
                  {displayNameLength}/{displayNameMax} characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thank-you-message">Custom Thank-You Message (Optional)</Label>
                <Textarea
                  id="thank-you-message"
                  value={thankYouMessage}
                  onChange={(event) => setThankYouMessage(event.target.value)}
                  maxLength={thankYouMessageMax}
                  placeholder="Thank you for supporting our mission..."
                  rows={4}
                  disabled={!canEditIdentity}
                />
                <p className="text-xs text-gray-500">
                  {thankYouMessageLength}/{thankYouMessageMax} characters
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Palette className="h-5 w-5 text-emerald-600" />
                  Branding
                </CardTitle>
                <CardDescription>
                  Upload images and choose the accent color used on kiosks.
                </CardDescription>
              </div>
              <Button
                onClick={() => void handleSaveSection('branding')}
                disabled={savingSection !== null || !hasBrandingChanges || !canEditBranding}
              >
                {savingSection === 'branding' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Branding
              </Button>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-3">
                <Label>Accent Color</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-3">
                    <Input
                      type="color"
                      value={
                        HEX_COLOR_REGEX.test(accentColorHex)
                          ? accentColorHex
                          : ACCENT_COLOR_FALLBACK
                      }
                      onChange={(event) => setAccentColorHex(event.target.value.toUpperCase())}
                      className="h-11 w-14 p-1"
                      disabled={!canEditBranding}
                    />
                    <Input
                      value={accentColorHex}
                      onChange={(event) => setAccentColorHex(event.target.value)}
                      placeholder="#0E8F5A"
                      className="w-40 font-mono uppercase"
                      maxLength={7}
                      disabled={!canEditBranding}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleResetAccentColor}
                    disabled={
                      !canEditBranding ||
                      isUploadingLogo ||
                      isUploadingIdleImage ||
                      accentColorHex.trim().toUpperCase() === ACCENT_COLOR_FALLBACK
                    }
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reset Accent
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Format: #RRGGBB. Reset accent returns to default theme color.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Organization Logo (1:1)</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={!canEditBranding || isUploadingLogo}
                      >
                        {isUploadingLogo ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ImageIcon className="mr-2 h-4 w-4" />
                        )}
                        Upload Logo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemoveLogo}
                        disabled={!canEditBranding || isUploadingLogo || !logoUrl}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />
                  <div className="flex h-52 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50">
                    {logoUrl ? (
                      <img
                        src={logoUrl}
                        alt="Organization logo preview"
                        className="h-full w-full rounded-md object-contain"
                      />
                    ) : (
                      <p className="text-sm text-gray-500">No logo uploaded</p>
                    )}
                  </div>
                  {logoDimensions && (
                    <p className="text-xs text-gray-500">
                      Dimensions: {logoDimensions.width} x {logoDimensions.height}px
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Raster logos can be adjusted in a square crop before upload. SVG logos are
                    uploaded directly to preserve the vector asset.
                  </p>
                </div>

                <div className="space-y-3 rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label>Idle Screensaver Image</Label>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => idleImageInputRef.current?.click()}
                        disabled={!canEditBranding || isUploadingIdleImage}
                      >
                        {isUploadingIdleImage ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <ImageIcon className="mr-2 h-4 w-4" />
                        )}
                        Upload Image
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleRemoveIdleImage}
                        disabled={!canEditBranding || isUploadingIdleImage || !idleImageUrl}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                  <input
                    ref={idleImageInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={handleIdleImageFileChange}
                  />
                  <div className="flex h-52 items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50">
                    {idleImageUrl ? (
                      <img
                        src={idleImageUrl}
                        alt="Idle image preview"
                        className="h-full w-full rounded-md object-cover"
                      />
                    ) : (
                      <p className="text-sm text-gray-500">No idle image uploaded</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    You can drag left or right and fine-tune crop position before uploading.
                    Removing this restores default idle-screen behavior.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </main>
      </AdminLayout>

      <SquareImageCropDialog
        open={isLogoCropDialogOpen}
        onOpenChange={(open) => {
          setIsLogoCropDialogOpen(open);
          if (!open) {
            setLogoFileToCrop(null);
          }
        }}
        file={logoFileToCrop}
        title="Adjust organization logo"
        description="Use the grid to position your logo inside a square frame."
        aspectRatio={1}
        onConfirm={async (croppedFile) => {
          await handleUploadImage(croppedFile, 'logo');
          setLogoFileToCrop(null);
        }}
      />

      <SquareImageCropDialog
        open={isIdleImageCropDialogOpen}
        onOpenChange={(open) => {
          setIsIdleImageCropDialogOpen(open);
          if (!open) {
            setIdleImageFileToCrop(null);
          }
        }}
        file={idleImageFileToCrop}
        title="Adjust idle screensaver image"
        description="Position the portrait cover image exactly as you want for kiosk screens."
        aspectRatio={9 / 16}
        onConfirm={async (croppedFile) => {
          await handleUploadImage(croppedFile, 'idleImage');
          setIdleImageFileToCrop(null);
        }}
      />
    </>
  );
}
