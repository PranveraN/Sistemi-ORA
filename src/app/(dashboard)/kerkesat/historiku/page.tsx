import { redirect } from "next/navigation";

// Historiku u bashkua me faqen e kërkesave: kërkesat e mbyllura gjenden te
// "Të gjitha" / "Dorëzuar" / "Refuzuara"; periudha dhe mësuesi te "Filtra";
// historiku i statuseve dhe porositë e çdo artikulli te detajet e kërkesës.
export default function KerkesatHistorikuPage() {
  redirect("/kerkesat?s=ALL");
}
