export function Skeleton({
  className = "",
  style
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function DashboardSkeleton() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-12 w-72 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border-2 border-chalk-3 bg-white p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-10 w-16 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border-2 border-chalk-3 bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <Skeleton className="h-5 w-48 mb-2" />
                  <Skeleton className="h-3 w-32 mb-4" />
                  <Skeleton className="h-2 w-full mb-3" />
                  <div className="flex gap-4">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </div>
                <div>
                  <Skeleton className="h-10 w-14" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          <div className="border-2 border-chalk-3 bg-white p-5">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                  <Skeleton className="h-2 w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export function CallDetailSkeleton() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
      <Skeleton className="h-4 w-48 mb-6" />
      <div className="border-2 border-chalk-3 bg-white p-6 mb-6">
        <div className="flex justify-between gap-4">
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-3" />
            <Skeleton className="h-8 w-80 mb-2" />
            <Skeleton className="h-3 w-48" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="border-2 border-chalk-3 p-3 text-center">
                <Skeleton className="h-3 w-12 mx-auto mb-2" />
                <Skeleton className="h-7 w-8 mx-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="border-2 border-chalk-3 bg-white">
          <div className="border-b-2 border-chalk-3 p-4">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className={`flex gap-3 ${i % 2 === 0 ? "flex-row-reverse" : ""}`}>
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <Skeleton className={`h-16 ${i % 2 === 0 ? "w-2/3" : "w-3/4"}`} style={{ borderRadius: "0 12px 12px 12px" }} />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="border-2 border-chalk-3 bg-white p-5">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-16 w-full mb-3" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

export function CallsListSkeleton() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
      <Skeleton className="h-10 w-48 mb-2" />
      <Skeleton className="h-4 w-64 mb-8" />
      <div className="border-2 border-ink bg-white">
        <div className="border-b-2 border-chalk-3 p-4">
          <div className="grid grid-cols-5 gap-4">
            {["Agent", "Duration", "Status", "Errors", "Date"].map((h) => (
              <Skeleton key={h} className="h-3 w-16" />
            ))}
          </div>
        </div>
        {[1,2,3,4,5,6,7,8].map((i) => (
          <div key={i} className="border-b border-chalk-2 p-4">
            <div className="grid grid-cols-5 gap-4 items-center">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export function AgentDetailSkeleton() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
      <nav className="mb-6 flex gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-32" />
      </nav>
      <div className="mb-8">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-14 w-96 mb-2" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="border-2 border-chalk-3 bg-white p-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-10 w-16 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          <section>
            <Skeleton className="h-8 w-48 mb-4" />
            <div className="border-2 border-chalk-3 bg-white p-5 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className="flex justify-between mb-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-12" />
                  </div>
                  <Skeleton className="h-2 w-full mb-3" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mt-1" />
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="border-2 border-chalk-3 bg-white p-5">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <Skeleton className="h-5 w-full mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

export function BlueprintSkeleton() {
  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 md:px-8">
      <div className="mb-8 max-w-2xl">
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-12 w-64 mb-3" />
        <Skeleton className="h-4 w-96 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-5">
        <div className="bg-white border-2 border-chalk-3 p-5 flex flex-wrap gap-4 items-end">
          <div className="grid gap-2">
             <Skeleton className="h-3 w-24" />
             <Skeleton className="h-10 w-48" />
          </div>
          <Skeleton className="h-10 w-48" />
        </div>
        <div className="border-2 border-chalk-3 bg-white p-16 text-center">
           <Skeleton className="h-8 w-64 mx-auto mb-4" />
           <Skeleton className="h-4 w-96 mx-auto mb-2" />
           <Skeleton className="h-4 w-80 mx-auto" />
        </div>
      </div>
    </main>
  );
}
