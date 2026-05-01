import React from 'react';
import { Button } from '../../../shared/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../shared/ui/select';
import { Calendar } from '../../../shared/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../../../shared/ui/popover';
import { Calendar as CalendarIcon, ChevronDownIcon } from 'lucide-react';

export interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'date' | 'dateRange';
  options?: { label: string; value: string }[];
  includeAllOption?: boolean;
  allOptionLabel?: string;
  clearLabel?: string;
}

export interface AdminSearchFilterConfig {
  filters: FilterConfig[];
}

interface AdminPageHeaderProps {
  config: AdminSearchFilterConfig;
  filterValues: Record<string, unknown>;
  onFilterChange: (key: string, value: unknown) => void;
  actions?: React.ReactNode;
  mobileActions?: React.ReactNode;
  showFiltersLabel?: boolean;
  wrapperClassName?: string;
  filterGridClassName?: string;
  summaryText?: React.ReactNode;
  dateLocale?: string;
  showMobileActions?: boolean;
}

const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(' ');

export function AdminPageHeader({
  config,
  filterValues,
  onFilterChange,
  actions,
  mobileActions,
  showFiltersLabel = false,
  wrapperClassName,
  filterGridClassName = 'grid grid-cols-1 gap-3 md:grid-cols-3',
  summaryText,
  dateLocale = 'en-GB',
  showMobileActions = true,
}: AdminPageHeaderProps) {
  const resolvedMobileActions = mobileActions === undefined ? actions : mobileActions;

  const renderFilter = (filter: FilterConfig) => {
    const value = filterValues[filter.key];

    switch (filter.type) {
      case 'select':
      case 'dateRange':
        return (
          <Select
            key={filter.key}
            value={(typeof value === 'string' && value) || 'all'}
            onValueChange={(newValue) => onFilterChange(filter.key, newValue)}
          >
            <SelectTrigger>
              <SelectValue placeholder={filter.label} />
            </SelectTrigger>
            <SelectContent>
              {filter.includeAllOption !== false && (
                <SelectItem value="all">
                  {filter.allOptionLabel ?? `All ${filter.label}`}
                </SelectItem>
              )}
              {filter.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'date':
        return (
          <Popover key={filter.key}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start border-input bg-input-background px-3 font-normal text-foreground hover:bg-input-background hover:text-foreground"
              >
                <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">
                  {value instanceof Date ? value.toLocaleDateString(dateLocale) : filter.label}
                </span>
                <ChevronDownIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value instanceof Date ? value : undefined}
                onSelect={(date) => {
                  onFilterChange(filter.key, date);
                }}
              />
              <div className="p-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onFilterChange(filter.key, undefined);
                  }}
                  className="w-full"
                >
                  {filter.clearLabel ?? `Clear ${filter.label}`}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        );

      default:
        return null;
    }
  };

  return (
    <div className={wrapperClassName}>
      {config.filters.length > 0 && (
        <div
          className={cx(
            'flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between',
            summaryText ? 'mb-4' : undefined,
          )}
        >
          <div className="flex-1">
            {showFiltersLabel ? (
              <span className="mb-2 block text-sm font-medium text-slate-700">Filters:</span>
            ) : null}
            <div className={filterGridClassName}>{config.filters.map(renderFilter)}</div>
          </div>
          {actions ? <div className="hidden sm:flex items-center gap-2">{actions}</div> : null}
        </div>
      )}
      {summaryText ? <div className="text-sm text-gray-600">{summaryText}</div> : null}
      {resolvedMobileActions && showMobileActions ? (
        <div className="mt-3 flex items-center gap-2 sm:hidden">{resolvedMobileActions}</div>
      ) : null}
    </div>
  );
}

// Keep the old component name for backward compatibility
export const AdminSearchFilterHeader = AdminPageHeader;
