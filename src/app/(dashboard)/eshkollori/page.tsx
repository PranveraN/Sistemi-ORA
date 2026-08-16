import CategoryPaymentPage from "@/components/finance/CategoryPaymentPage";
import { BookMarked } from "lucide-react";

export default function EshkolloriPage() {
  return (
    <CategoryPaymentPage
      categoryName="Librat & Shkollorja"
      title="Eshkollori"
      icon={<BookMarked className="w-5 h-5" />}
      color="teal"
      isMonthly={false}
      singlePaymentOnly={true}
    />
  );
}
