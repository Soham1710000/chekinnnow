import { lazy, Suspense } from "react";

// Lazy load Index for code splitting
const Index = lazy(() => import("./Index"));

// Minimal loading placeholder - matches Index background
const PageLoader = () => (
  <div className="min-h-screen bg-white" />
);

const ABRouter = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Index />
    </Suspense>
  );
};

export default ABRouter;