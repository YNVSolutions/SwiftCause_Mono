'use client';

import React, { useState } from 'react';
import { Screen, AdminSession, Permission } from '../../shared/types';
import { Avatar, AvatarFallback, AvatarImage } from '../../shared/ui/avatar';
import { Button } from '../../shared/ui/button';
import { useToast } from '../../shared/ui/ToastProvider';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../../shared/ui/dialog';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  useSidebar,
} from '../../shared/ui/sidebar';
import { AdminPageHeader } from './components/AdminPageHeader';
import {
  LayoutDashboard,
  Settings,
  Monitor,
  Database,
  Users,
  Gift,
  LogOut,
  Wallet,
  CreditCard,
  Loader2,
  AlertCircle,
  KeyRound,
  Eye,
  EyeOff,
} from 'lucide-react';
import { auth, db } from '../../shared/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { PASSWORD_REQUIREMENTS } from '../../shared/config/constants';

const SCREEN_LABELS: Partial<Record<Screen, string>> = {
  admin: 'Dashboard',
  'admin-dashboard': 'Dashboard',
  'admin-campaigns': 'Campaigns',
  'admin-kiosks': 'Kiosks',
  'admin-donations': 'Donations',
  'admin-subscriptions': 'Subscriptions',
  'admin-gift-aid': 'Gift Aid Donations',
  'admin-users': 'Users',
  'admin-bank-details': 'Bank Details',
  'admin-stripe-account': 'Stripe account',
} as Partial<Record<Screen, string>>;

interface AdminLayoutProps {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  userSession: AdminSession;
  hasPermission: (permission: Permission) => boolean;
  children: React.ReactNode;
  activeScreen?: Screen;
  onStartTour?: () => void;
  onOpenStripeSetup?: () => void;
  headerTitle?: React.ReactNode;
  headerSubtitle?: React.ReactNode;
  headerTopRightActions?: React.ReactNode;
  headerInlineActions?: React.ReactNode;
  headerSearchPlaceholder?: string;
  headerSearchValue?: string;
  onHeaderSearchChange?: (value: string) => void;
  hideSidebarTrigger?: boolean;
  hideHeader?: boolean;
}

// Get user initials for avatar
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getRoleDisplayName = (role: AdminSession['user']['role']) =>
  role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const SPECIAL_CHARACTER_REGEX = /[!@#$%^&*(),.?":{}|<>]/;

const validatePasswordChange = (
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
) => {
  if (!currentPassword.trim()) {
    return 'Current password is required.';
  }

  if (!newPassword) {
    return 'New password is required.';
  }

  if (newPassword.length < PASSWORD_REQUIREMENTS.minLength) {
    return `Password must be at least ${PASSWORD_REQUIREMENTS.minLength} characters.`;
  }

  if (PASSWORD_REQUIREMENTS.requireUppercase && !/[A-Z]/.test(newPassword)) {
    return 'Password must contain at least one uppercase letter.';
  }

  if (PASSWORD_REQUIREMENTS.requireLowercase && !/[a-z]/.test(newPassword)) {
    return 'Password must contain at least one lowercase letter.';
  }

  if (PASSWORD_REQUIREMENTS.requireNumbers && !/[0-9]/.test(newPassword)) {
    return 'Password must contain at least one number.';
  }

  if (PASSWORD_REQUIREMENTS.requireSpecialChars && !SPECIAL_CHARACTER_REGEX.test(newPassword)) {
    return 'Password must contain at least one special character.';
  }

  if (currentPassword === newPassword) {
    return 'New password must be different from your current password.';
  }

  if (newPassword !== confirmPassword) {
    return 'New password and confirmation do not match.';
  }

  return null;
};

// AdminSidebar component that uses the SidebarProvider context
function AdminSidebar({
  onNavigate,
  onLogout,
  userSession,
  hasPermission,
  isActive,
  userInitials,
  handleStripeAccountClick,
  isLoadingStripe,
}: {
  onNavigate: (screen: Screen) => void;
  onLogout: () => void;
  userSession: AdminSession;
  hasPermission: (permission: Permission) => boolean;
  isActive: (...screens: Screen[]) => boolean;
  userInitials: string;
  handleStripeAccountClick: () => void;
  isLoadingStripe: boolean;
}) {
  const { state, isMobile } = useSidebar();
  const roleDisplayName = getRoleDisplayName(userSession.user.role);

  // On mobile, always show expanded sidebar (with text)
  // On desktop, respect the collapsed state
  const isCollapsed = !isMobile && state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader
        className={`${isCollapsed ? 'justify-center p-4' : 'px-6 py-6'} border-b border-white/20`}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <img src="/logo.png" alt="SwiftCause Logo" className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-white font-semibold text-base leading-tight">SwiftCause</span>
              <span className="text-white/70 text-xs font-medium">Admin Portal</span>
            </div>
          </div>
        )}

        {isCollapsed && (
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <img src="/logo.png" alt="SwiftCause Logo" className="w-5 h-5" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="flex flex-col px-3">
        <SidebarGroup>
          <SidebarMenu className="space-y-2">
            {/* Dashboard */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onNavigate('admin')}
                className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl text-left transition-all duration-200 group ${
                  isActive('admin', 'admin-dashboard')
                    ? 'bg-[#0f5132] text-white font-medium shadow-lg'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
                title={isCollapsed ? 'Dashboard' : ''}
                aria-current={isActive('admin', 'admin-dashboard') ? 'page' : undefined}
              >
                {/* Subtle left accent indicator for active state */}
                {isActive('admin', 'admin-dashboard') && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                )}
                <LayoutDashboard
                  className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 ${
                    isActive('admin', 'admin-dashboard') ? 'text-white' : ''
                  }`}
                  strokeWidth={1.5}
                />
                {!isCollapsed && <span className="ml-3 text-base font-medium">Dashboard</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Campaigns */}
            {hasPermission('view_campaigns') ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onNavigate('admin-campaigns')}
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl text-left transition-all duration-200 group ${
                    isActive('admin-campaigns')
                      ? 'bg-[#0f5132] text-white font-medium shadow-lg'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                  title={isCollapsed ? 'Campaigns' : ''}
                  aria-current={isActive('admin-campaigns') ? 'page' : undefined}
                >
                  {/* Subtle left accent indicator for active state */}
                  {isActive('admin-campaigns') && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                  )}
                  <Settings
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 ${
                      isActive('admin-campaigns') ? 'text-white' : ''
                    }`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && <span className="ml-3 text-base font-medium">Campaigns</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem>
                <div
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl opacity-50 cursor-not-allowed`}
                >
                  <Settings
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 text-white/40`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && (
                    <span className="ml-3 text-base font-medium text-white/40">Campaigns</span>
                  )}
                </div>
              </SidebarMenuItem>
            )}

            {/* Donations */}
            {hasPermission('view_donations') ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onNavigate('admin-donations')}
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl text-left transition-all duration-200 group ${
                    isActive('admin-donations')
                      ? 'bg-[#0f5132] text-white font-medium shadow-lg'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                  title={isCollapsed ? 'Donations' : ''}
                  aria-current={isActive('admin-donations') ? 'page' : undefined}
                >
                  {/* Subtle left accent indicator for active state */}
                  {isActive('admin-donations') && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                  )}
                  <Database
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 ${
                      isActive('admin-donations') ? 'text-white' : ''
                    }`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && <span className="ml-3 text-base font-medium">Donations</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem>
                <div
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl opacity-50 cursor-not-allowed`}
                >
                  <Database
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 text-white/40`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && (
                    <span className="ml-3 text-base font-medium text-white/40">Donations</span>
                  )}
                </div>
              </SidebarMenuItem>
            )}

            {/* Subscriptions */}
            {hasPermission('view_donations') ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onNavigate('admin-subscriptions')}
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl text-left transition-all duration-200 group ${
                    isActive('admin-subscriptions')
                      ? 'bg-[#0f5132] text-white font-medium shadow-lg'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                  title={isCollapsed ? 'Subscriptions' : ''}
                  aria-current={isActive('admin-subscriptions') ? 'page' : undefined}
                >
                  {isActive('admin-subscriptions') && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                  )}
                  <CreditCard
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 ${
                      isActive('admin-subscriptions') ? 'text-white' : ''
                    }`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && (
                    <span className="ml-3 text-base font-medium">Subscriptions</span>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem>
                <div
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl opacity-50 cursor-not-allowed`}
                >
                  <CreditCard
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 text-white/40`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && (
                    <span className="ml-3 text-base font-medium text-white/40">Subscriptions</span>
                  )}
                </div>
              </SidebarMenuItem>
            )}

            {/* Kiosks */}
            {hasPermission('view_kiosks') ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onNavigate('admin-kiosks')}
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl text-left transition-all duration-200 group ${
                    isActive('admin-kiosks')
                      ? 'bg-[#0f5132] text-white font-medium shadow-lg'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                  title={isCollapsed ? 'Kiosks' : ''}
                  aria-current={isActive('admin-kiosks') ? 'page' : undefined}
                >
                  {/* Subtle left accent indicator for active state */}
                  {isActive('admin-kiosks') && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                  )}
                  <Monitor
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 ${
                      isActive('admin-kiosks') ? 'text-white' : ''
                    }`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && <span className="ml-3 text-base font-medium">Kiosks</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem>
                <div
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl opacity-50 cursor-not-allowed`}
                >
                  <Monitor
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 text-white/40`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && (
                    <span className="ml-3 text-base font-medium text-white/40">Kiosks</span>
                  )}
                </div>
              </SidebarMenuItem>
            )}

            {/* Users */}
            {hasPermission('view_users') ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onNavigate('admin-users')}
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl text-left transition-all duration-200 group ${
                    isActive('admin-users')
                      ? 'bg-[#0f5132] text-white font-medium shadow-lg'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                  title={isCollapsed ? 'Users' : ''}
                  aria-current={isActive('admin-users') ? 'page' : undefined}
                >
                  {/* Subtle left accent indicator for active state */}
                  {isActive('admin-users') && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                  )}
                  <Users
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 ${
                      isActive('admin-users') ? 'text-white' : ''
                    }`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && <span className="ml-3 text-base font-medium">Users</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem>
                <div
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl opacity-50 cursor-not-allowed`}
                >
                  <Users
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 text-white/40`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && (
                    <span className="ml-3 text-base font-medium text-white/40">Users</span>
                  )}
                </div>
              </SidebarMenuItem>
            )}

            {/* Gift Aid */}
            {hasPermission('view_donations') ? (
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onNavigate('admin-gift-aid')}
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl text-left transition-all duration-200 group ${
                    isActive('admin-gift-aid')
                      ? 'bg-[#0f5132] text-white font-medium shadow-lg'
                      : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                  title={isCollapsed ? 'Gift Aid' : ''}
                  aria-current={isActive('admin-gift-aid') ? 'page' : undefined}
                >
                  {/* Subtle left accent indicator for active state */}
                  {isActive('admin-gift-aid') && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                  )}
                  <Gift
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 ${
                      isActive('admin-gift-aid') ? 'text-white' : ''
                    }`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && <span className="ml-3 text-base font-medium">Gift Aid</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ) : (
              <SidebarMenuItem>
                <div
                  className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl opacity-50 cursor-not-allowed`}
                >
                  <Gift
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 text-white/40`}
                    strokeWidth={1.5}
                  />
                  {!isCollapsed && (
                    <span className="ml-3 text-base font-medium text-white/40">Gift Aid</span>
                  )}
                </div>
              </SidebarMenuItem>
            )}

            {/* Bank Details */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => onNavigate('admin-bank-details')}
                className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl text-left transition-all duration-200 group ${
                  isActive('admin-bank-details')
                    ? 'bg-[#0f5132] text-white font-medium shadow-lg'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
                title={isCollapsed ? 'Bank Details' : ''}
                aria-current={isActive('admin-bank-details') ? 'page' : undefined}
              >
                {/* Subtle left accent indicator for active state */}
                {isActive('admin-bank-details') && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                )}
                <Wallet
                  className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 ${
                    isActive('admin-bank-details') ? 'text-white' : ''
                  }`}
                  strokeWidth={1.5}
                />
                {!isCollapsed && <span className="ml-3 text-base font-medium">Bank Details</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>

            {/* Stripe account */}
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleStripeAccountClick}
                disabled={isLoadingStripe}
                className={`relative w-full flex items-center ${isCollapsed ? 'justify-center px-4 py-4' : 'px-4 py-3.5'} rounded-xl text-left transition-all duration-200 group ${
                  isActive('admin-stripe-account')
                    ? 'bg-[#0f5132] text-white font-medium shadow-lg'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                } ${isLoadingStripe ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isCollapsed ? 'Stripe Account' : ''}
                aria-current={isActive('admin-stripe-account') ? 'page' : undefined}
              >
                {/* Subtle left accent indicator for active state */}
                {isActive('admin-stripe-account') && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white/30 rounded-r-full"></div>
                )}
                {isLoadingStripe ? (
                  <Loader2
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 animate-spin`}
                    strokeWidth={1.5}
                  />
                ) : (
                  <CreditCard
                    className={`${isCollapsed ? 'h-6 w-6' : 'h-5 w-5'} shrink-0 ${
                      isActive('admin-stripe-account') ? 'text-white' : ''
                    }`}
                    strokeWidth={1.5}
                  />
                )}
                {!isCollapsed && <span className="ml-3 text-base font-medium">Stripe Account</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!isCollapsed ? (
          <div className="space-y-3">
            {/* User Info */}
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                <Avatar className="w-7 h-7">
                  <AvatarImage src={userSession.user.photoURL || undefined} />
                  <AvatarFallback className="bg-white/30 text-white text-xs font-semibold">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium text-sm truncate">
                  {userSession.user.username || 'Admin User'}
                </p>
                <p className="text-white/70 text-xs">{roleDisplayName}</p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-lg text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-all duration-150 group"
            >
              <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span className="text-sm font-medium">Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <Avatar className="w-7 h-7">
                <AvatarImage src={userSession.user.photoURL || undefined} />
                <AvatarFallback className="bg-white/30 text-white text-xs font-semibold">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-red-300 hover:text-red-200 hover:bg-red-500/20 transition-all duration-150"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export function AdminLayout({
  onNavigate,
  onLogout,
  userSession,
  hasPermission,
  children,
  activeScreen = 'admin-dashboard',
  onStartTour,
  onOpenStripeSetup,
  headerTitle,
  headerSubtitle,
  headerTopRightActions,
  headerInlineActions,
  headerSearchPlaceholder,
  headerSearchValue,
  onHeaderSearchChange,
  hideSidebarTrigger,
  hideHeader,
}: AdminLayoutProps) {
  const { showToast } = useToast();
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [showStripeConfigDialog, setShowStripeConfigDialog] = useState(false);
  const [isLoadingStripe, setIsLoadingStripe] = useState(false);
  const [stripeError, setStripeError] = useState<{ title: string; message: string } | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);

  // Handle ESC key to close profile panel
  React.useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showUserProfile) {
        setShowUserProfile(false);
      }
    };

    if (showUserProfile) {
      document.addEventListener('keydown', handleEscKey);
      return () => document.removeEventListener('keydown', handleEscKey);
    }
  }, [showUserProfile]);

  const isActive = (...screens: Screen[]) => screens.includes(activeScreen);
  const currentLabel = SCREEN_LABELS[activeScreen] ?? 'Admin';
  const resolvedTitle = headerTitle ?? currentLabel;
  const resolvedSubtitle = headerSubtitle ?? undefined;
  const userInitials = getInitials(userSession.user.username || userSession.user.email || 'U');
  const roleDisplayName = getRoleDisplayName(userSession.user.role);
  const memberSinceLabel = userSession.user.createdAt
    ? new Date(userSession.user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'N/A';
  const headerSearch =
    headerSearchValue !== undefined && onHeaderSearchChange
      ? {
          placeholder: headerSearchPlaceholder,
          value: headerSearchValue,
          onChange: onHeaderSearchChange,
        }
      : undefined;

  const resetPasswordChangeForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setChangePasswordError(null);
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
  };

  const handleChangePasswordDialogOpenChange = (open: boolean) => {
    setShowChangePasswordDialog(open);
    if (!open && !isChangingPassword) {
      resetPasswordChangeForm();
    }
  };

  const handleChangePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validationError = validatePasswordChange(
      currentPassword,
      newPassword,
      confirmNewPassword,
    );

    if (validationError) {
      setChangePasswordError(validationError);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.email) {
      setChangePasswordError('Your session has expired. Please sign in again.');
      return;
    }

    try {
      setIsChangingPassword(true);
      setChangePasswordError(null);

      const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);

      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, newPassword);

      resetPasswordChangeForm();
      setShowChangePasswordDialog(false);
      showToast('Password updated successfully.', 'success');
    } catch (error: unknown) {
      const firebaseErrorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as { code?: string }).code === 'string'
          ? (error as { code: string }).code
          : null;

      switch (firebaseErrorCode) {
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setChangePasswordError('Current password is incorrect.');
          break;
        case 'auth/weak-password':
          setChangePasswordError(
            'Your new password does not meet the minimum security requirements.',
          );
          break;
        case 'auth/too-many-requests':
          setChangePasswordError('Too many attempts. Please wait a moment and try again.');
          break;
        case 'auth/requires-recent-login':
          setChangePasswordError(
            'For security, please sign in again before changing your password.',
          );
          break;
        default:
          console.error('Error changing password:', error);
          setChangePasswordError('Failed to update password. Please try again.');
          break;
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleStripeAccountClick = async () => {
    setIsLoadingStripe(true);
    setStripeError(null); // Clear any previous errors

    try {
      if (!userSession.user.organizationId) {
        console.warn('No organization ID found');
        setIsLoadingStripe(false);
        setStripeError({
          title: 'Organization Not Found',
          message: 'Your account is not associated with an organization. Please contact support.',
        });
        return;
      }

      const orgRef = doc(db, 'organizations', userSession.user.organizationId);
      const orgDoc = await getDoc(orgRef);

      if (!orgDoc.exists()) {
        console.warn('Organization document not found');
        setIsLoadingStripe(false);
        setStripeError({
          title: 'Organization Not Found',
          message: "We couldn't find your organization details. Please contact support.",
        });
        return;
      }

      const orgData = orgDoc.data();
      const chargesEnabled = orgData?.stripe?.chargesEnabled;
      const stripeAccountId = orgData?.stripe?.accountId;

      // Check if Stripe is properly onboarded (chargesEnabled must be true)
      if (!chargesEnabled) {
        console.warn('Stripe account not onboarded (chargesEnabled is false or missing)');
        setIsLoadingStripe(false);
        setShowStripeConfigDialog(true);
        return;
      }

      // If onboarded but no accountId (shouldn't happen, but handle it)
      if (!stripeAccountId) {
        console.warn('No Stripe account ID found despite being onboarded');
        setIsLoadingStripe(false);
        setStripeError({
          title: 'Configuration Error',
          message: 'Your Stripe account is incomplete. Please contact support.',
        });
        return;
      }

      console.warn('Stripe Account ID:', stripeAccountId);

      const currentUser = auth.currentUser;
      if (!currentUser) {
        setIsLoadingStripe(false);
        setStripeError({
          title: 'Authentication Required',
          message: 'Your session has expired. Please sign in again.',
        });
        return;
      }

      const idToken = await currentUser.getIdToken();

      // Make POST request to get the dashboard link
      const response = await fetch(
        `https://us-central1-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/createExpressDashboardLink`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            orgId: userSession.user.organizationId,
          }),
        },
      );

      if (!response.ok) {
        setIsLoadingStripe(false);
        const errorText = await response.text();
        console.error('API error:', errorText);
        setStripeError({
          title: 'Failed to Load Stripe Dashboard',
          message: `Unable to connect to Stripe (Error ${response.status}). Please try again later or contact support.`,
        });
        return;
      }

      const data = await response.json();
      console.warn('Dashboard link response:', data);

      // Redirect to the link
      if (data.url || data.link) {
        const dashboardUrl = data.url || data.link;
        window.location.href = dashboardUrl;
        // Keep loading state true during redirect
      } else {
        console.error('No URL found in response:', data);
        setIsLoadingStripe(false);
        setStripeError({
          title: 'Invalid Response',
          message: 'Received an invalid response from Stripe. Please try again or contact support.',
        });
      }
    } catch (error) {
      console.error('Error fetching Stripe dashboard link:', error);
      setIsLoadingStripe(false);
      setStripeError({
        title: 'Connection Error',
        message:
          'Failed to connect to Stripe. Please check your internet connection and try again.',
      });
    }
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <style>{`
        @keyframes wobble {
          0% { transform: rotate(0deg) scale(1); }
          25% { transform: rotate(-5deg) scale(0.9); }
          50% { transform: rotate(5deg) scale(1.1); }
          75% { transform: rotate(-5deg) scale(0.95); }
          100% { transform: rotate(0deg) scale(1); }
        }
        .logo-wobble.animate {
          animation: wobble 0.5s ease-in-out;
        }
        .signout-btn {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }
        .signout-btn::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.5s ease;
        }
        .signout-btn:hover::before {
          left: 100%;
        }
        .signout-btn:hover {
          transform: scale(1.02);
          box-shadow: 0 4px 15px rgba(185, 28, 28, 0.4);
        }
        .signout-btn:active {
          transform: scale(0.98);
        }
        .signout-icon {
          transition: transform 0.3s ease;
        }
        .signout-btn:hover .signout-icon {
          transform: translateX(3px);
        }
        .sidebar-item {
          position: relative;
          overflow: hidden;
        }
        .sidebar-item::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0));
          opacity: 0;
          transform: translateX(-12%);
          transition: opacity 0.3s ease, transform 0.3s ease;
          pointer-events: none;
        }
        .sidebar-item:hover::before {
          opacity: 1;
          transform: translateX(0);
        }
        .sidebar-item-active::after {
          content: "";
          position: absolute;
          left: 0;
          top: 12%;
          bottom: 12%;
          width: 4px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.9);
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.7);
        }
        /* Force sidebar green background - Multiple selectors for maximum specificity */
        [data-sidebar="sidebar"],
        [data-slot="sidebar-inner"],
        .bg-sidebar,
        [data-sidebar="sidebar"] > *,
        [data-slot="sidebar-inner"] > *,
        div[data-sidebar="sidebar"],
        div[data-slot="sidebar-inner"] {
          background-color: #064e3b !important;
          color: white !important;
        }
        
        /* Force all sidebar elements to use white text */
        [data-sidebar="sidebar"] *,
        [data-slot="sidebar-inner"] * {
          color: white !important;
        }
        
        /* Force sidebar header and footer */
        [data-sidebar="header"],
        [data-sidebar="footer"],
        [data-slot="sidebar-header"],
        [data-slot="sidebar-footer"] {
          background-color: #064e3b !important;
          color: white !important;
        }
        
        /* Force sidebar content */
        [data-sidebar="content"],
        [data-slot="sidebar-content"] {
          background-color: #064e3b !important;
          color: white !important;
        }
        
        /* Force sidebar menu buttons hover states */
        [data-sidebar="menu-button"]:hover {
          background-color: rgba(255, 255, 255, 0.1) !important;
          color: white !important;
        }
        
        /* Force active state */
        [data-sidebar="menu-button"][data-active="true"] {
          background-color: #0f5132 !important;
          color: white !important;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
        }
        
        /* Ultimate specificity - target by ID-like specificity */
        html body div[data-sidebar="sidebar"],
        html body div[data-slot="sidebar-inner"],
        html body [data-sidebar="sidebar"],
        html body [data-slot="sidebar-inner"] {
          background-color: #064e3b !important;
          color: white !important;
        }
        
        /* Force sidebar wrapper background */
        [data-slot="sidebar-wrapper"] [data-sidebar="sidebar"],
        [data-slot="sidebar-container"] [data-sidebar="sidebar"],
        .group/sidebar-wrapper [data-sidebar="sidebar"] {
          background-color: #064e3b !important;
          color: white !important;
        }
        
        /* Force sidebar menu spacing */
        [data-sidebar="menu"] {
          gap: 0.5rem !important;
        }
        
        /* Force sidebar menu item styling */
        [data-sidebar="menu-button"] {
          border-radius: 0.75rem !important;
          padding: 0.875rem 1rem !important;
          transition: all 0.2s ease !important;
        }
        
        /* Force collapsed state styling */
        .group-data-[collapsible=icon] [data-sidebar="menu-button"] {
          padding: 1rem !important;
          min-height: 3rem !important;
          width: 3rem !important;
        }
        
        /* Fix: Prevent white text on hover for header elements */
        [data-sidebar="menu-button"]:hover span,
        [data-sidebar="menu-button"]:hover svg {
          color: inherit !important;
        }
        
        /* Fix: Ensure sidebar text stays white on hover */
        [data-sidebar="sidebar"] [data-sidebar="menu-button"]:hover {
          color: white !important;
        }
        
        /* Fix: Ensure active state maintains white text */
        [data-sidebar="menu-button"][data-active="true"],
        [data-sidebar="menu-button"][data-active="true"]:hover {
          color: white !important;
        }
        
        /* Fix: Ensure footer elements maintain white text */
        [data-sidebar="footer"] button:hover,
        [data-sidebar="footer"] button:hover span,
        [data-sidebar="footer"] button:hover svg {
          color: inherit !important;
        }
      `}</style>

      {/* Main Layout Container */}
      <div className="relative h-screen w-full bg-[#F3F1EA]">
        <div className="flex h-full w-full bg-[#F3F1EA]">
          <AdminSidebar
            onNavigate={onNavigate}
            onLogout={onLogout}
            userSession={userSession}
            hasPermission={hasPermission}
            isActive={isActive}
            userInitials={userInitials}
            handleStripeAccountClick={handleStripeAccountClick}
            isLoadingStripe={isLoadingStripe}
          />

          <SidebarInset className="flex-1 flex flex-col overflow-hidden bg-[#F3F1EA]">
            {!hideHeader && (
              <header className="bg-transparent">
                <AdminPageHeader
                  title={resolvedTitle}
                  subtitle={resolvedSubtitle}
                  organizationName={userSession.user.organizationName}
                  topRightActions={headerTopRightActions}
                  inlineActions={headerInlineActions}
                  search={headerSearch}
                  showSidebarTrigger={!hideSidebarTrigger}
                  onStartTour={onStartTour}
                  onProfileClick={() => setShowUserProfile(!showUserProfile)}
                  userPhotoUrl={userSession.user.photoURL || undefined}
                  userInitials={userInitials}
                  profileSlot={
                    <div className="flex items-center gap-3 ml-2 relative">
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowUserProfile(!showUserProfile)}
                          className="group h-10 w-10 p-0 rounded-full border-0 bg-linear-to-br from-blue-500/80 to-purple-600/80 text-white shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105"
                          aria-label="Open profile"
                        >
                          <Avatar className="h-8 w-8 transition-transform duration-200 group-hover:scale-105">
                            <AvatarImage src={userSession.user.photoURL || undefined} />
                            <AvatarFallback className="bg-transparent text-white text-sm font-semibold">
                              {userInitials}
                            </AvatarFallback>
                          </Avatar>
                        </Button>
                        {/* Online indicator */}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-[0_0_6px_rgba(34,197,94,0.8)]"></div>
                      </div>
                    </div>
                  }
                />
              </header>
            )}

            <main
              className="flex-1 w-full bg-[#F3F1EA] overflow-y-auto overflow-x-hidden"
              style={{ scrollbarGutter: 'stable' }}
              data-testid="main-content-area"
            >
              {children}
            </main>
          </SidebarInset>
        </div>

        {/* Loading Overlay for Stripe */}
        {isLoadingStripe && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-100 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
              <Loader2 className="h-12 w-12 text-[#064e3b] animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Loading Stripe Dashboard
                </h3>
                <p className="text-sm text-gray-600">
                  Please wait while we redirect you to your Stripe account...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stripe Configuration Dialog */}
        <Dialog open={showStripeConfigDialog} onOpenChange={setShowStripeConfigDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-orange-600" />
                Stripe Account Not Configured
              </DialogTitle>
              <DialogDescription>
                Your Stripe account is not configured yet. Please complete the Stripe setup to
                access your dashboard and start accepting donations.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setShowStripeConfigDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  setShowStripeConfigDialog(false);
                  if (onOpenStripeSetup) {
                    onOpenStripeSetup();
                  } else {
                    onNavigate('admin-dashboard');
                  }
                }}
                className="bg-[#064e3b] hover:bg-[#0f5132]"
              >
                Go to Stripe Setup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Stripe Error Dialog */}
        <Dialog open={!!stripeError} onOpenChange={(open) => !open && setStripeError(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                {stripeError?.title || 'Error'}
              </DialogTitle>
              <DialogDescription>
                {stripeError?.message || 'An unexpected error occurred.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                onClick={() => setStripeError(null)}
                className="bg-gray-900 hover:bg-gray-800"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showChangePasswordDialog} onOpenChange={handleChangePasswordDialogOpenChange}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-amber-700" />
                Change Password
              </DialogTitle>
              <DialogDescription>
                Re-enter your current password, then choose a new password that meets the platform
                policy.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleChangePassword}>
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700"
                  htmlFor="current-password"
                >
                  Current password
                </label>
                <div className="relative">
                  <input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value);
                      if (changePasswordError) {
                        setChangePasswordError(null);
                      }
                    }}
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-11 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    placeholder="Enter current password"
                    disabled={isChangingPassword}
                  />
                  <button
                    type="button"
                    aria-label={
                      showCurrentPassword ? 'Hide current password' : 'Show current password'
                    }
                    onClick={() => setShowCurrentPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 transition hover:text-gray-700"
                    disabled={isChangingPassword}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700"
                  htmlFor="new-password"
                >
                  New password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => {
                      setNewPassword(event.target.value);
                      if (changePasswordError) {
                        setChangePasswordError(null);
                      }
                    }}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-11 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    placeholder="Enter new password"
                    disabled={isChangingPassword}
                  />
                  <button
                    type="button"
                    aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    onClick={() => setShowNewPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 transition hover:text-gray-700"
                    disabled={isChangingPassword}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-medium text-gray-700"
                  htmlFor="confirm-new-password"
                >
                  Confirm new password
                </label>
                <div className="relative">
                  <input
                    id="confirm-new-password"
                    type={showConfirmNewPassword ? 'text' : 'password'}
                    value={confirmNewPassword}
                    onChange={(event) => {
                      setConfirmNewPassword(event.target.value);
                      if (changePasswordError) {
                        setChangePasswordError(null);
                      }
                    }}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-11 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    placeholder="Confirm new password"
                    disabled={isChangingPassword}
                  />
                  <button
                    type="button"
                    aria-label={
                      showConfirmNewPassword
                        ? 'Hide confirm new password'
                        : 'Show confirm new password'
                    }
                    onClick={() => setShowConfirmNewPassword((value) => !value)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-gray-500 transition hover:text-gray-700"
                    disabled={isChangingPassword}
                  >
                    {showConfirmNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <p className="text-xs leading-5 text-gray-500">
                Minimum 8 characters with uppercase, lowercase, number, and special character.
              </p>

              {changePasswordError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {changePasswordError}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={isChangingPassword}
                  onClick={() => handleChangePasswordDialogOpenChange(false)}
                  className="border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isChangingPassword}
                  className="bg-[#064e3b] hover:bg-[#0f5132]"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* User Profile Popup - Separate Floating Entity */}
      {showUserProfile && (
        <>
          <div
            className="fixed inset-0 bg-transparent z-40 transition-all duration-300"
            onClick={() => setShowUserProfile(false)}
          ></div>

          <div className="fixed left-4 right-4 top-20 sm:left-auto sm:right-6 w-auto sm:w-80 max-w-[calc(100vw-2rem)] bg-white/15 backdrop-blur-xl rounded-xl shadow-sm z-50 transform transition-all duration-300 ease-out border border-gray-200/10">
            <div className="relative px-6 py-5 bg-linear-to-r from-slate-50/10 to-gray-50/10 backdrop-blur-xl rounded-t-xl border-b border-gray-200/10">
              <button
                onClick={() => setShowUserProfile(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>

              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-linear-to-br from-blue-100/60 to-purple-100/60 backdrop-blur-xl flex items-center justify-center border border-blue-200/30 shadow-lg">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={userSession.user.photoURL || undefined} />
                    <AvatarFallback className="bg-linear-to-br from-blue-500/80 to-purple-600/80 text-white text-lg font-bold border border-blue-300/30 shadow-inner">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>

                <div className="text-gray-900">
                  <h3 className="font-semibold text-lg leading-tight text-gray-900">
                    {userSession.user.username || 'Admin User'}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-1 bg-linear-to-r from-green-100/70 to-emerald-100/70 backdrop-blur-xl rounded-full text-xs font-medium border border-green-200/40 text-green-700">
                      {roleDisplayName}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="p-6 max-h-[min(24rem,calc(100vh-8rem))] overflow-y-auto scrollbar-hide"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
              <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                  display: none;
                }
              `}</style>

              <div className="space-y-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                  Account Information
                </h4>

                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-blue-100/60 backdrop-blur-xl rounded-lg flex items-center justify-center shrink-0 border border-blue-200/40">
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                        />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-gray-500 text-xs font-medium">Email Address</p>
                      <p className="text-gray-900 font-medium truncate">
                        {userSession.user.email || 'admin@example.com'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-green-100/60 backdrop-blur-xl rounded-lg flex items-center justify-center shrink-0 border border-green-200/40">
                      <svg
                        className="w-4 h-4 text-green-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs font-medium">Role</p>
                      <p className="text-gray-900 font-medium">{roleDisplayName}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-purple-100/60 backdrop-blur-xl rounded-lg flex items-center justify-center shrink-0 border border-purple-200/40">
                      <svg
                        className="w-4 h-4 text-purple-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3a4 4 0 118 0v4m-4 8a2 2 0 100-4 2 2 0 000 4zm6 0a2 2 0 100-4 2 2 0 000 4z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs font-medium">Member Since</p>
                      <p className="text-gray-900 font-medium">{memberSinceLabel}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Security
                </h4>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetPasswordChangeForm();
                    setShowUserProfile(false);
                    setShowChangePasswordDialog(true);
                  }}
                  className="w-full justify-center gap-2 rounded-xl border-gray-200 bg-white/80 text-gray-800 hover:bg-gray-50"
                >
                  <KeyRound className="h-4 w-4 text-amber-700" />
                  Change Password
                </Button>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
                  Permissions
                </h4>

                <div className="flex flex-wrap gap-2">
                  {hasPermission('view_dashboard') && (
                    <span className="px-2.5 py-1 bg-blue-100/80 backdrop-blur-xl text-blue-700 text-xs font-medium rounded-md border border-blue-200/50">
                      view dashboard
                    </span>
                  )}
                  {hasPermission('view_campaigns') && (
                    <span className="px-2.5 py-1 bg-green-100/80 backdrop-blur-xl text-green-700 text-xs font-medium rounded-md border border-green-200/50">
                      view campaigns
                    </span>
                  )}
                  {hasPermission('create_campaign') && (
                    <span className="px-2.5 py-1 bg-emerald-100/80 backdrop-blur-xl text-emerald-700 text-xs font-medium rounded-md border border-emerald-200/50">
                      create campaign
                    </span>
                  )}
                  {hasPermission('edit_campaign') && (
                    <span className="px-2.5 py-1 bg-yellow-100/80 backdrop-blur-xl text-yellow-700 text-xs font-medium rounded-md border border-yellow-200/50">
                      edit campaign
                    </span>
                  )}
                  {hasPermission('delete_campaign') && (
                    <span className="px-2.5 py-1 bg-red-100/80 backdrop-blur-xl text-red-700 text-xs font-medium rounded-md border border-red-200/50">
                      delete campaign
                    </span>
                  )}
                  {hasPermission('view_kiosks') && (
                    <span className="px-2.5 py-1 bg-purple-100/80 backdrop-blur-xl text-purple-700 text-xs font-medium rounded-md border border-purple-200/50">
                      view kiosks
                    </span>
                  )}
                  {hasPermission('create_kiosk') && (
                    <span className="px-2.5 py-1 bg-violet-100/80 backdrop-blur-xl text-violet-700 text-xs font-medium rounded-md border border-violet-200/50">
                      create kiosk
                    </span>
                  )}
                  {hasPermission('edit_kiosk') && (
                    <span className="px-2.5 py-1 bg-indigo-100/80 backdrop-blur-xl text-indigo-700 text-xs font-medium rounded-md border border-indigo-200/50">
                      edit kiosk
                    </span>
                  )}
                  {hasPermission('delete_kiosk') && (
                    <span className="px-2.5 py-1 bg-pink-100/80 backdrop-blur-xl text-pink-700 text-xs font-medium rounded-md border border-pink-200/50">
                      delete kiosk
                    </span>
                  )}
                  {hasPermission('assign_campaigns') && (
                    <span className="px-2.5 py-1 bg-teal-100/80 backdrop-blur-xl text-teal-700 text-xs font-medium rounded-md border border-teal-200/50">
                      assign campaigns
                    </span>
                  )}
                  {hasPermission('view_donations') && (
                    <span className="px-2.5 py-1 bg-cyan-100/80 backdrop-blur-xl text-cyan-700 text-xs font-medium rounded-md border border-cyan-200/50">
                      view donations
                    </span>
                  )}
                  {hasPermission('export_donations') && (
                    <span className="px-2.5 py-1 bg-sky-100/80 backdrop-blur-xl text-sky-700 text-xs font-medium rounded-md border border-sky-200/50">
                      export donations
                    </span>
                  )}
                  {hasPermission('view_users') && (
                    <span className="px-2.5 py-1 bg-orange-100/80 backdrop-blur-xl text-orange-700 text-xs font-medium rounded-md border border-orange-200/50">
                      view users
                    </span>
                  )}
                  {hasPermission('create_user') && (
                    <span className="px-2.5 py-1 bg-amber-100/80 backdrop-blur-xl text-amber-700 text-xs font-medium rounded-md border border-amber-200/50">
                      create user
                    </span>
                  )}
                  {hasPermission('edit_user') && (
                    <span className="px-2.5 py-1 bg-lime-100/80 backdrop-blur-xl text-lime-700 text-xs font-medium rounded-md border border-lime-200/50">
                      edit user
                    </span>
                  )}
                  {hasPermission('delete_user') && (
                    <span className="px-2.5 py-1 bg-rose-100/80 backdrop-blur-xl text-rose-700 text-xs font-medium rounded-md border border-rose-200/50">
                      delete user
                    </span>
                  )}
                  {hasPermission('manage_permissions') && (
                    <span className="px-2.5 py-1 bg-fuchsia-100/80 backdrop-blur-xl text-fuchsia-700 text-xs font-medium rounded-md border border-fuchsia-200/50">
                      manage permissions
                    </span>
                  )}
                  {hasPermission('system_admin') && (
                    <span className="px-2.5 py-1 bg-linear-to-r from-purple-100/80 to-pink-100/80 backdrop-blur-xl text-purple-800 text-xs font-bold rounded-md border border-purple-300/50 shadow-sm">
                      system admin
                    </span>
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setShowUserProfile(false);
                    onLogout();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-50 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors font-medium text-sm border border-gray-200 shadow-sm"
                >
                  <LogOut className="w-4 h-4" />
                  Log Out
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </SidebarProvider>
  );
}
