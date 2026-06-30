import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as { role?: string })?.role;
  if (role !== "SUPERADMIN") redirect("/dashboard");

  return (
    <SessionProvider session={session}>
      {children}
    </SessionProvider>
  );
}
