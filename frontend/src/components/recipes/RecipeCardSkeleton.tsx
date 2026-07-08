export default function RecipeCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border overflow-hidden flex flex-col animate-pulse">
      <div className="aspect-video bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-full" />
        <div className="h-3 bg-gray-200 rounded w-2/3" />
        <div className="flex gap-3 pt-2">
          <div className="h-3 bg-gray-200 rounded w-14" />
          <div className="h-3 bg-gray-200 rounded w-10" />
        </div>
      </div>
    </div>
  );
}
