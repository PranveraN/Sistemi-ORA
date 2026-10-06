import { redirect } from "next/navigation";

// Historiku u bashkua me "Materialet → Kërkesat" (Të gjitha / Dorëzuar / Refuzuar).
export default function KerkesatHistorikuPage() {
  redirect("/materialet/kerkesat");
}
