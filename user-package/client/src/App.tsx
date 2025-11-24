import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import OriginalEmailSender from "@/pages/OriginalEmailSender";
import { queryClient } from "@/lib/queryClient";

function RouterComponent() {
  return (
    <Switch>
      <Route path="/" component={OriginalEmailSender} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <RouterComponent />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
