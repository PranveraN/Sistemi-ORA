import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();
  if (session) {
    const role = (session.user as { role?: string } | undefined)?.role;
    if (role === "TEACHER") redirect("/kerkesa-material");
    redirect("/dashboard");
  } else {
    redirect("/login");
  }
}
