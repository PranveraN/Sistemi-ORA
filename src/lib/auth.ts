import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { getAllowedModules } from "./modulePermissions";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Fjalëkalimi", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.active) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) return null;

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const role = (user as { role?: string; organizationId?: number }).role as string;
        const organizationId = (user as { role?: string; organizationId?: number }).organizationId as number;
        token.role = role;
        token.id = user.id;
        token.organizationId = organizationId;
        // Llogaritet VETËM në momentin e kyçjes (jo në çdo kërkesë) — ndaj
        // ndryshimet e lejeve (faqja e re e administrimit) marrin efekt për
        // një përdorues të kyçur tashmë vetëm pas kyçjes së tij të radhës.
        token.allowedModules = await getAllowedModules(organizationId, role);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string; id?: string; organizationId?: number; allowedModules?: string[] }).role = token.role as string;
        (session.user as { role?: string; id?: string; organizationId?: number; allowedModules?: string[] }).id = token.id as string;
        (session.user as { role?: string; id?: string; organizationId?: number; allowedModules?: string[] }).organizationId = token.organizationId as number;
        (session.user as { role?: string; id?: string; organizationId?: number; allowedModules?: string[] }).allowedModules = token.allowedModules as string[];
      }
      return session;
    },
  },
});
