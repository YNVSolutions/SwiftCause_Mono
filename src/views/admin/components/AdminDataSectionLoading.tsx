import { Card, CardContent } from '../../../shared/ui/card';
import { Skeleton } from '../../../shared/ui/skeleton';

interface AdminDataSectionLoadingProps {
  desktopColumns?: number;
  desktopRows?: number;
  mobileRows?: number;
  cardClassName?: string;
}

export function AdminDataSectionLoading({
  desktopColumns = 6,
  desktopRows = 5,
  mobileRows = 3,
  cardClassName = 'overflow-hidden rounded-3xl',
}: AdminDataSectionLoadingProps) {
  return (
    <>
      <div className="hidden space-y-4 md:block">
        {Array.from({ length: desktopRows }).map((_, rowIndex) => (
          <div
            key={`admin-data-loading-row-${rowIndex}`}
            className={`grid gap-4 border-b border-gray-100 py-4`}
            style={{ gridTemplateColumns: `repeat(${desktopColumns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: desktopColumns }).map((_, colIndex) => (
              <Skeleton
                key={`admin-data-loading-cell-${rowIndex}-${colIndex}`}
                className="h-10 w-full"
              />
            ))}
          </div>
        ))}
      </div>
      <div className="space-y-4 md:hidden">
        {Array.from({ length: mobileRows }).map((_, rowIndex) => (
          <Card key={`admin-data-loading-mobile-${rowIndex}`} className={cardClassName}>
            <CardContent className="p-4">
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
