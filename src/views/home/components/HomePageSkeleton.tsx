import { Skeleton } from '@/shared/ui/skeleton';

/** Main content only — used under the real navbar/footer while sections hydrate. */
export function HomeMainSkeleton() {
  return (
    <>
      {/* Hero */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32 px-6 overflow-hidden">
        <div className="container mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-8 max-w-2xl">
            <Skeleton className="h-8 w-56 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-12 sm:h-14 md:h-16 w-full max-w-lg rounded-lg" />
              <Skeleton className="h-12 sm:h-14 md:h-16 w-4/5 max-w-md rounded-lg" />
            </div>
            <div className="space-y-2 max-w-lg">
              <Skeleton className="h-5 w-full rounded-md" />
              <Skeleton className="h-5 w-11/12 rounded-md" />
              <Skeleton className="h-5 w-4/5 rounded-md" />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <Skeleton className="h-14 w-56 rounded-2xl" />
            </div>
          </div>
          <div className="relative mt-8 md:mt-0 min-h-[280px] md:min-h-[360px]">
            <Skeleton className="absolute inset-0 rounded-2xl" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-white px-6">
        <div className="container mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-20 space-y-4">
            <Skeleton className="h-4 w-32 mx-auto rounded-md" />
            <Skeleton className="h-10 md:h-12 w-full max-w-2xl mx-auto rounded-lg" />
            <Skeleton className="h-5 w-3/4 max-w-xl mx-auto rounded-md" />
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="p-8 rounded-[2rem] bg-[#F7F6F2] border border-transparent space-y-4"
              >
                <Skeleton className="w-14 h-14 rounded-2xl" />
                <Skeleton className="h-6 w-3/4 rounded-md" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-full rounded-md" />
                  <Skeleton className="h-4 w-2/3 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tools */}
      <section id="tools" className="py-24 bg-[#F3F1EA] px-6 overflow-hidden">
        <div className="container mx-auto">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/3 space-y-8 w-full">
              <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-2xl" />
                ))}
              </div>
            </div>
            <div className="hidden lg:block lg:w-2/3 w-full">
              <Skeleton className="w-full min-h-[400px] rounded-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ + testimonial-style row */}
      <section id="faq" className="py-24 bg-white px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16 space-y-3">
            <Skeleton className="h-10 w-64 mx-auto rounded-lg" />
            <Skeleton className="h-5 w-80 max-w-full mx-auto rounded-md" />
          </div>
          <div className="flex flex-col sm:flex-row gap-6 items-start p-6 rounded-3xl bg-[#F7F6F2] border border-slate-100 mb-10">
            <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2 w-full">
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
            </div>
          </div>
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-3xl" />
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section id="contact" className="py-24 bg-[#064e3b] px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="bg-white rounded-[3rem] p-8 md:p-16 shadow-2xl flex flex-col lg:flex-row gap-16">
            <div className="lg:w-1/2 space-y-4">
              <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
              <Skeleton className="h-5 w-full rounded-md" />
              <Skeleton className="h-5 w-4/5 rounded-md" />
            </div>
            <div className="lg:w-1/2 space-y-5 w-full">
              <div className="grid sm:grid-cols-2 gap-5">
                <Skeleton className="h-14 w-full rounded-2xl" />
                <Skeleton className="h-14 w-full rounded-2xl" />
              </div>
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/** Full landing layout while auth resolves — matches page shell (nav + main + footer). */
export function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-[#F3F1EA] selection:bg-[#0f5132] selection:text-white">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent py-5">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <Skeleton className="h-10 w-44 rounded-xl" />
          <div className="hidden md:flex items-center gap-8">
            <Skeleton className="h-4 w-16 rounded-md" />
            <Skeleton className="h-4 w-14 rounded-md" />
            <Skeleton className="h-4 w-12 rounded-md" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Skeleton className="h-10 w-20 rounded-lg" />
            <Skeleton className="h-10 w-24 rounded-lg" />
          </div>
          <Skeleton className="md:hidden h-10 w-10 rounded-lg" />
        </div>
      </nav>
      <main>
        <HomeMainSkeleton />
      </main>
      <footer className="bg-[#F3F1EA] pt-20 pb-10 px-6 border-t border-slate-200">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-12 mb-16">
            <div className="space-y-4">
              <Skeleton className="h-8 w-40 rounded-lg" />
              <Skeleton className="h-4 w-full max-w-xs rounded-md" />
              <Skeleton className="h-4 w-5/6 max-w-xs rounded-md" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-24 rounded-md" />
              <Skeleton className="h-4 w-32 rounded-md" />
            </div>
            <Skeleton className="h-24 w-full max-w-sm rounded-2xl" />
          </div>
          <Skeleton className="h-4 w-64 mx-auto rounded-md" />
        </div>
      </footer>
    </div>
  );
}
