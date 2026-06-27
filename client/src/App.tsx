import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AdminLogin from "@/pages/admin-login";
import AdminDashboard from "@/pages/admin-dashboard";
import AdminFormBuilder from "@/pages/admin-form-builder";
import AdminFormDetail from "@/pages/admin-form-detail";
import AdminSettings from "@/pages/admin-settings";
import AdminReports from "@/pages/admin-reports";
import AdminOrderDetail from "@/pages/admin-order-detail";
import AthleteForm from "@/pages/athlete-form";
import PayOrder from "@/pages/pay-order";
import AdminDocs from "@/pages/admin-docs";
import AdminCustomers from "@/pages/admin-customers";
import MyOrders from "@/pages/my-orders";
import OrderDetailPage from "@/pages/order-detail";
import AdminPrivacyPolicy from "@/pages/admin-privacy-policy";
import AdminSubAdmins from "@/pages/admin-sub-admins";
import AdminSubscriptions from "@/pages/admin-subscriptions";
import SubscribePage from "@/pages/subscribe";

function Router() {
  return (
    <Switch>
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/" component={AdminDashboard} />
      <Route path="/admin/forms/new" component={AdminFormBuilder} />
      <Route path="/admin/forms/:id" component={AdminFormDetail} />
      <Route path="/admin/forms/:id/edit" component={AdminFormBuilder} />
      <Route path="/admin/settings" component={AdminSettings} />
      <Route path="/admin/reports" component={AdminReports} />
      <Route path="/admin/orders/:id" component={AdminOrderDetail} />
      <Route path="/admin/docs" component={AdminDocs} />
      <Route path="/admin/privacy-policy" component={AdminPrivacyPolicy} />
      <Route path="/admin/sub-admins" component={AdminSubAdmins} />
      <Route path="/admin/subscriptions" component={AdminSubscriptions} />
      <Route path="/assinar/:shareId" component={SubscribePage} />
      <Route path="/admin/customers" component={AdminCustomers} />
      <Route path="/form/:shareId" component={AthleteForm} />
      <Route path="/pay" component={PayOrder} />
      <Route path="/meus-pedidos/:cpf" component={MyOrders} />
      <Route path="/pedido/:id" component={OrderDetailPage} />
      <Route component={NotFound} />
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
