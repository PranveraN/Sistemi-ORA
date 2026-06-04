import CategoryPaymentPage from "@/components/finance/CategoryPaymentPage";
import { GraduationCap } from "lucide-react";

export default function ShkollimiPage() {
  return (
    <CategoryPaymentPage
      categoryName="Shkollimi"
      title="Shkollimi"
      icon={<GraduationCap className="w-5 h-5" />}
      color="primary"
      isMonthly={true}
    />
  );
}
