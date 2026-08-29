import { FinanceProvider } from "@/components/finance/finance-provider";
import { Dashboard } from "@/components/finance/dashboard";

export default function Home() {
  return (
    <FinanceProvider>
      <Dashboard />
    </FinanceProvider>
  );
}
