import { redirect } from "next/navigation";

// Shpenzimet e Shkollimit regjistrohen, shihen dhe ndryshohen vetëm te
// Shkollimi → Shpenzime (një libër i vetëm). Lidhjet e vjetra ridrejtohen.
export default function ShpenzimePage() {
  redirect("/shkollimi?tab=expense");
}
