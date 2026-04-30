'use client';

import React from 'react';
import { Button } from '../../../shared/ui/button';
import { Input } from '../../../shared/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '../../../shared/ui/avatar';
import { SidebarTrigger } from '../../../shared/ui/sidebar';
import { Compass, Search } from 'lucide-react';

interface AdminPageHeaderProps {
  title: React.ReactNode | null;
  subtitle?: React.ReactNode;
  topRightActions?: React.ReactNode;
  inlineActions?: React.ReactNode;
  search?: {
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
  };
  showSidebarTrigger?: boolean;
  onStartTour?: () => void;
  onProfileClick: () => void;
  profileSlot?: React.ReactNode;
  userPhotoUrl?: string;
  userInitials: string;
  organizationName?: string;
}

export function AdminPageHeader({
  title,
  subtitle,
  topRightActions,
  inlineActions,
  search,
  showSidebarTrigger = true,
  onStartTour,
  onProfileClick,
  profileSlot,
  userPhotoUrl,
  userInitials,
  organizationName,
}: AdminPageHeaderProps) {
  const renderTitle = () => {
    if (title === null) return null;
    if (typeof title === 'string') {
      return (
        <div>
          {organizationName && (
            <p className="text-xs text-slate-500 mb-0.5 font-medium uppercase tracking-wide">
              {organizationName}
            </p>
          )}
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight font-['Helvetica',sans-serif]">
            {title}
          </h1>
        </div>
      );
    }
    return title;
  };

  const renderSubtitle = () => {
    if (!subtitle) return null;
    if (typeof subtitle === 'string') {
      return <p className="text-sm text-slate-600 mt-1 font-light">{subtitle}</p>;
    }
    return subtitle;
  };

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-4 glass-card border-b border-[#F3F1EA]/60 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
      <style jsx>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.65);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
      `}</style>
      <div className="flex w-full flex-col gap-4">
        <div className="flex w-full items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4 lg:items-center">
            {showSidebarTrigger && (
              <SidebarTrigger className="h-9 w-9 shrink-0 rounded-2xl border border-[#F3F1EA]/60 bg-[#F7F6F2] text-slate-600 hover:bg-emerald-50 hover:text-[#064e3b] hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-900/10 hover:scale-105 transition-all duration-300 shadow-sm sm:h-10 sm:w-10" />
            )}
            <div className="flex flex-col min-w-0">
              {renderTitle()}
              {renderSubtitle()}
            </div>
            {search && (
              <div className="relative hidden lg:block w-full max-w-[520px] ml-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 shrink-0" />
                <Input
                  placeholder={search.placeholder ?? 'Search...'}
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  className="pl-10 w-full h-11 border border-black rounded-full text-sm bg-white/70 focus:bg-white transition-all duration-300"
                />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:ml-auto lg:justify-end">
            {inlineActions && (
              <div className="hidden lg:flex items-center gap-2">{inlineActions}</div>
            )}
            {topRightActions && <div className="min-w-0">{topRightActions}</div>}
            {onStartTour && (
              <Button
                variant="outline"
                size="sm"
                onClick={onStartTour}
                className="hidden md:flex items-center gap-2 border-[#064e3b] bg-transparent text-[#064e3b] hover:bg-emerald-50 hover:border-emerald-600 hover:shadow-md hover:shadow-emerald-900/10 hover:scale-105 transition-all duration-300 rounded-2xl px-6 py-3 font-semibold"
              >
                <Compass className="h-4 w-4" />
                <span className="font-medium">Get a Tour</span>
              </Button>
            )}
            {profileSlot ? (
              profileSlot
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={onProfileClick}
                className="h-10 w-10 rounded-full hover:bg-emerald-50 hover:shadow-md hover:shadow-emerald-900/10 hover:scale-110 transition-all duration-300 group"
                title="View Profile"
              >
                <Avatar className="h-8 w-8 ring-2 ring-[#F3F1EA]/60 group-hover:ring-emerald-200 transition-all duration-300">
                  <AvatarImage src={userPhotoUrl || undefined} />
                  <AvatarFallback className="bg-[#064e3b] text-white text-sm font-semibold group-hover:bg-emerald-600 transition-all duration-300">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            )}
          </div>
        </div>

        {(search || inlineActions) && (
          <div className="flex w-full items-center gap-3 lg:hidden">
            {search && (
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 shrink-0" />
                <Input
                  placeholder={search.placeholder ?? 'Search...'}
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  className="pl-10 w-full h-10 sm:h-11 border border-black rounded-full text-sm sm:text-base bg-white/70 focus:bg-white transition-all duration-300"
                />
              </div>
            )}
            {inlineActions && (
              <div className="flex items-center gap-2 shrink-0">{inlineActions}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
