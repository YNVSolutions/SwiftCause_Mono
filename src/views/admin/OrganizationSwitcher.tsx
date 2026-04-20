import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Check, ChevronDown, Search } from 'lucide-react';
import { getOrganizations } from '../../shared/api';
import { AdminSession } from '../../shared/types';
import { Button } from '../../shared/ui/button';
import { Input } from '../../shared/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../../shared/ui/popover';
import { Skeleton } from '../../shared/ui/skeleton';

interface Organization {
  id: string;
  name: string;
}

interface OrganizationSwitcherProps {
  userSession: AdminSession;
  onOrganizationChange: (organizationId: string, organizationName?: string) => void;
  selectedOrganizationName?: string;
}

const mapOrganizations = (orgs: Array<Record<string, unknown>>): Organization[] =>
  orgs
    .map((org) => {
      const settings = org?.settings as Record<string, unknown> | undefined;
      const displayName =
        typeof settings?.displayName === 'string'
          ? settings.displayName
          : typeof org?.name === 'string'
            ? org.name
            : typeof org?.organizationName === 'string'
              ? org.organizationName
              : '';

      return {
        id: typeof org?.id === 'string' ? org.id : '',
        name: displayName,
      };
    })
    .filter((org) => org.id && org.name);

export const OrganizationSwitcher: React.FC<OrganizationSwitcherProps> = ({
  userSession,
  onOrganizationChange,
  selectedOrganizationName,
}) => {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await getOrganizations();
      setOrganizations(mapOrganizations(orgs as Array<Record<string, unknown>>));
    } catch (error) {
      console.error('Failed to fetch organizations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      return;
    }

    void fetchOrganizations();
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [isOpen, fetchOrganizations]);

  const selectedOrgId = userSession.user.organizationId ?? '';
  const selectedNameOverride = selectedOrganizationName?.trim() ?? '';

  const organizationsWithSelectedName = useMemo(() => {
    const next = organizations.map((org) =>
      org.id === selectedOrgId && selectedNameOverride
        ? { ...org, name: selectedNameOverride }
        : org,
    );

    if (selectedOrgId && selectedNameOverride && !next.some((org) => org.id === selectedOrgId)) {
      next.unshift({ id: selectedOrgId, name: selectedNameOverride });
    }

    return next;
  }, [organizations, selectedNameOverride, selectedOrgId]);

  const currentOrg = organizationsWithSelectedName.find((org) => org.id === selectedOrgId);
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredOrganizations = organizationsWithSelectedName.filter((org) =>
    org.name.toLowerCase().includes(normalizedSearch),
  );

  if (loading) {
    return <Skeleton className="h-10 w-full sm:w-[280px]" />;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="h-10 w-full min-w-0 justify-between bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50 sm:w-[280px]"
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-linear-to-br from-blue-500 to-blue-600">
              <Building2 className="h-4 w-4 text-white" />
            </span>
            <span className="truncate text-sm font-medium text-gray-900">
              {currentOrg?.name || 'Select Organization'}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-[320px] p-0 sm:w-[320px]">
        <div className="border-b bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
          Available Organizations
        </div>

        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Search organizations..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-9 border-gray-200 pl-9 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-1">
          {filteredOrganizations.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-500">
              {searchQuery ? 'No organizations found' : 'No organizations available'}
            </div>
          ) : (
            filteredOrganizations.map((org) => {
              const isSelected = org.id === selectedOrgId;
              return (
                <button
                  key={org.id}
                  type="button"
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    onOrganizationChange(org.id, org.name);
                    setIsOpen(false);
                  }}
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${
                        isSelected ? 'bg-linear-to-br from-blue-500 to-blue-600' : 'bg-gray-100'
                      }`}
                    >
                      <Building2
                        className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-gray-500'}`}
                      />
                    </span>
                    <span className="truncate text-sm font-medium text-gray-900">{org.name}</span>
                  </span>
                  {isSelected ? <Check className="h-4 w-4 shrink-0 text-blue-600" /> : null}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
