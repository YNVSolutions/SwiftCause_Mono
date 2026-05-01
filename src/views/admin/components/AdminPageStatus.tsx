import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../shared/ui/card';
import { Skeleton } from '../../../shared/ui/skeleton';

interface AdminPageLoaderProps {
  message?: string;
}

export function AdminPageLoader({ message = 'Loading data...' }: AdminPageLoaderProps) {
  return (
    <div className="w-full px-6 pt-8 pb-6 lg:px-8">
      <div className="mb-4 text-sm text-gray-500">{message}</div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card
            key={`admin-loader-stat-${index}`}
            className="rounded-3xl border border-gray-100 shadow-sm"
          >
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-6 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6 rounded-3xl border border-gray-100 shadow-sm">
        <CardContent className="p-5">
          <div className="space-y-4">
            <Skeleton className="h-4 w-40" />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-4 w-52" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <div key={`admin-loader-row-${rowIndex}`} className="grid grid-cols-6 gap-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface AdminPageErrorProps {
  title?: string;
  message: string;
}

export function AdminPageError({ title = 'Unable To Load Data', message }: AdminPageErrorProps) {
  return (
    <div className="flex min-h-[280px] w-full items-center justify-center">
      <Card className="w-full max-w-lg border-red-200 bg-red-50">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-red-700">
            <AlertCircle className="h-5 w-5" />
            <CardTitle className="text-red-700">{title}</CardTitle>
          </div>
          <CardDescription className="text-red-600">{message}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
