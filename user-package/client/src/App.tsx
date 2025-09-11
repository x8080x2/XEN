import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import OriginalEmailSender from "@/pages/OriginalEmailSender";
import QROverlayTest from "@/pages/QROverlayTest";

function Router() {
  return (
    <Switch>
      <Route path="/" component={OriginalEmailSender} />
      <Route path="/qr-test" component={QROverlayTest} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
