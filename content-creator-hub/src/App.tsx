import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "@/contexts/WalletContext";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import Explore from "./pages/Explore";
import CreatorProfile from "./pages/CreatorProfile";
import ContentView from "./pages/ContentView";
import CreatorDashboard from "./pages/CreatorDashboard";
import RegisterCreator from "./pages/RegisterCreator";
import UploadContent from "./pages/UploadContent";
import FanDashboard from "./pages/FanDashboard";
import NotFound from "./pages/NotFound";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

const App = () => (
  <ThemeProvider>
    <ConvexProvider client={convex}>
      <WalletProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/creator/:handle" element={<CreatorProfile />} />
              <Route path="/content/:id" element={<ContentView />} />
              <Route path="/dashboard/creator" element={<CreatorDashboard />} />
              <Route path="/dashboard/creator/register" element={<RegisterCreator />} />
              <Route path="/dashboard/creator/upload" element={<UploadContent />} />
              <Route path="/dashboard/fan" element={<FanDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </WalletProvider>
    </ConvexProvider>
  </ThemeProvider>
);

export default App;
