import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { cache } from "react";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";

if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  throw new Error("AUTH_SECRET environment variable is required");
}

const nextAuth = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Rate limit login attempts per email
        const { allowed } = await rateLimit(
          `login:${email.toLowerCase()}`,
          5,
          15 * 60 * 1000,
        );
        if (!allowed) return null;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) return null;

        const passwordMatch = await compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        if (!user.emailVerified) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          currency: user.currency,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
    updateAge: 12 * 60 * 60, // refresh token every 12 hours (sliding window)
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      // NextAuth's own API routes must never be intercepted — signout, session,
      // CSRF, callbacks, etc. all rely on reaching the route handler untouched.
      if (pathname.startsWith("/api/auth/")) return true;

      const isAuthPage =
        pathname.startsWith("/login") ||
        pathname.startsWith("/signup") ||
        pathname.startsWith("/verify-email");

      if (isAuthPage) {
        if (isLoggedIn) return Response.redirect(new URL("/", request.url));
        return true;
      }

      return isLoggedIn;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.jti = crypto.randomUUID();
        token.currency = user.currency ?? "USD";
        token.lastVerified = Date.now();
        return token;
      }

      // Client called update() — force re-read from DB immediately
      if (trigger === "update" && typeof token.id === "string") {
        const [existing] = await db
          .select({ id: users.id, currency: users.currency })
          .from(users)
          .where(eq(users.id, token.id))
          .limit(1);

        if (!existing) return null;
        token.currency = existing.currency;
        token.lastVerified = Date.now();
        return token;
      }

      // Periodically verify the user still exists in the DB.
      // This ensures DB resets (or user deletion) invalidate the session.
      const verifyInterval = 5 * 60 * 1000; // 5 minutes
      const lastVerified = (token.lastVerified as number) ?? 0;

      if (
        typeof token.id === "string" &&
        Date.now() - lastVerified > verifyInterval
      ) {
        const [existing] = await db
          .select({ id: users.id, currency: users.currency })
          .from(users)
          .where(eq(users.id, token.id))
          .limit(1);

        if (!existing) return null;

        token.currency = existing.currency;
        token.lastVerified = Date.now();
      }

      return token;
    },
    session({ session, token }) {
      if (session.user && typeof token.id === "string") {
        session.user.id = token.id;
        session.user.currency = (token.currency as string) ?? "USD";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

export const { handlers, signIn, signOut, auth } = nextAuth;

/** Deduplicated auth() — safe to call multiple times within a single request. */
export const cachedAuth = cache(auth);
