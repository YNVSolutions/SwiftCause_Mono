import { Card, CardContent } from '../../../shared/ui/card';
import { Skeleton } from '../../../shared/ui/skeleton';
import { AdminStatsGrid } from './AdminStatsGrid';

interface AdminStatsGridLoadingProps {
  count?: number;
  className?: string;
}

export function AdminStatsGridLoading({
  count = 4,
  className = 'grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6',
}: AdminStatsGridLoadingProps) {
  return (
    <AdminStatsGrid className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <Card
          key={`admin-stats-loading-${index}`}
          className="rounded-3xl border border-gray-100 shadow-sm"
        >
          <CardContent className="p-5 flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </AdminStatsGrid>
  );
}
