
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const ProfileSkeleton = () => {
  return (
    <div className="space-y-8">
      {/* Profile Information Card */}
      <Card className="p-6 rounded-2xl shadow-sm">
        <div className="mb-6">
          <Skeleton className="h-6 w-64 mb-2" />
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-2 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Skeleton className="h-10 w-24" />
        </div>
      </Card>

      {/* Account Access Card */}
      <Card className="p-6 rounded-2xl shadow-sm">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5" />
              <div>
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5" />
              <div>
                <Skeleton className="h-4 w-20 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      </Card>

      {/* Newsletter Card */}
      <Card className="p-6 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-6 w-11" />
            </div>
          ))}
        </div>
      </Card>

      {/* Data Management Card */}
      <Card className="p-6 rounded-2xl shadow-sm">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="w-full">
          <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
            <div className="flex items-center gap-3">
              <Skeleton className="h-5 w-5" />
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ProfileSkeleton;
