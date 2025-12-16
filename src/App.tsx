import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";

// Eager load Index for fastest initial paint
import Index from "./pages/Index";

// Lazy load other routes
const IndexB = lazy(() => import("./pages/IndexB"));
const Waitlist = lazy(() => import("./pages/Waitlist"));
const Admin = lazy(() => import("./pages/Admin"));
const Chat = lazy(() => import("./pages/Chat"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const CarouselDemo = lazy(() => import("./pages/CarouselDemo"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Minimal route loading fallback
const RouteLoader = () => (
  <div className="min-h-screen bg-white" />
);

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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/b" element={<IndexB />} />
              <Route path="/waitlist" element={<Waitlist />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<AdminDashboard />} />
              <Route path="/demo/carousel" element={<CarouselDemo />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
