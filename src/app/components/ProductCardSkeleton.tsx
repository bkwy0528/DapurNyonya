import { Card } from './ui/card';

export default function ProductCardSkeleton() {
  return (
    <Card className="overflow-hidden" aria-hidden="true">
      <div className="flex flex-col sm:flex-row animate-pulse">
        <div className="w-full sm:w-64 aspect-[4/3] sm:self-start flex-shrink-0 bg-gray-200" />
        <div className="flex-1 p-6 space-y-4">
          <div className="space-y-2">
            <div className="h-5 w-2/3 rounded bg-gray-200" />
            <div className="h-4 w-full rounded bg-gray-200" />
            <div className="h-4 w-4/5 rounded bg-gray-200" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="h-7 w-20 rounded bg-gray-200" />
            <div className="h-9 w-28 rounded-md bg-gray-200" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ProductListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-6" role="status" aria-label="Loading products">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
