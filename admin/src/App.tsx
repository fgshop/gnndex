import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { RequireAdminAuth } from "./components/RequireAdminAuth";
import { AdminDashboardPage } from "./pages/AdminDashboardPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { CompliancePage } from "./pages/CompliancePage";
import { CoinListingsPage } from "./pages/CoinListingsPage";
import { AdminLoginPage } from "./pages/AdminLoginPage";
import { OrdersPage } from "./pages/OrdersPage";
import { PermissionsPage } from "./pages/PermissionsPage";
import { RiskPolicyPage } from "./pages/RiskPolicyPage";
import { SupportTicketsPage } from "./pages/SupportTicketsPage";
import { UsersPage } from "./pages/UsersPage";
import { WalletLedgerPage } from "./pages/WalletLedgerPage";
import { DepositsPage } from "./pages/DepositsPage";
import { NoticesPage } from "./pages/NoticesPage";
import { WithdrawalsPage } from "./pages/WithdrawalsPage";

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<AdminLoginPage />} />
      <Route
        element={
          <RequireAdminAuth>
            <AdminLayout />
          </RequireAdminAuth>
        }
      >
        <Route path="/dashboard" element={<AdminDashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/permissions" element={<PermissionsPage />} />
        <Route path="/deposits" element={<DepositsPage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route path="/withdrawals" element={<WithdrawalsPage />} />
        <Route path="/wallet-ledger" element={<WalletLedgerPage />} />
        <Route path="/coin-listings" element={<CoinListingsPage />} />
        <Route path="/risk" element={<RiskPolicyPage />} />
        <Route path="/compliance" element={<CompliancePage />} />
        <Route path="/support-tickets" element={<SupportTicketsPage />} />
        <Route path="/audit-logs" element={<AuditLogsPage />} />
      </Route>
    </Routes>
  );
}
