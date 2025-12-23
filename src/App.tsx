import { lazy, Suspense, memo } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

// Lazy load Toasters - not needed for initial paint
const Toaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const Sonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
const TooltipProvider = lazy(() => import("@/components/ui/tooltip").then(m => ({ default: m.TooltipProvider })));

// Eager load ABRouter for fastest initial paint
import ABRouter from "./pages/ABRouter";

// Lazy load all other routes
const Index = lazy(() => import("./pages/Index"));
const IndexB = lazy(() => import("./pages/IndexB"));
const CAT = lazy(() => import("./pages/CAT"));
const UPSC = lazy(() => import("./pages/UPSC"));
const Waitlist = lazy(() => import("./pages/Waitlist"));
const Admin = lazy(() => import("./pages/Admin"));
const Chat = lazy(() => import("./pages/Chat"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CarouselDemo = lazy(() => import("./pages/CarouselDemo"));
const Reputation = lazy(() => import("./pages/Reputation"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Minimal route loading fallback - memoized to prevent re-renders
const RouteLoader = memo(() => (
  <div className="min-h-screen bg-white" />
));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minute
      gcTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <Suspense fallback={null}>
        <TooltipProvider>
          <Suspense fallback={null}>
            <Toaster />
            <Sonner />
          </Suspense>
          <BrowserRouter>
            <Suspense fallback={<RouteLoader />}>
              <Routes>
                <Route path="/" element={<ABRouter />} />
                <Route path="/a" element={<Index />} />
                <Route path="/b" element={<IndexB />} />
                <Route path="/upsc" element={<UPSC />} />
                <Route path="/cat" element={<CAT />} />
                <Route path="/waitlist" element={<Waitlist />} />
                <Route path="/admin" element={<Admin />} />
                <Route path="/chat" element={<Chat />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/dashboard" element={<AdminDashboard />} />
                <Route path="/demo/carousel" element={<CarouselDemo />} />
                <Route path="/reputation" element={<Reputation />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </Suspense>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
