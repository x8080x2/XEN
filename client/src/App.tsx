import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import EmailSender from "@/pages/EmailSender";
import OriginalEmailSender from "@/pages/OriginalEmailSender";

function Router() {
  return (
    <Switch>
      <Route path="/" component={OriginalEmailSender} />
      <Route path="/legacy" component={EmailSender} />
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
