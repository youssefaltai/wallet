import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    currency?: string;
  }
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      currency: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    currency?: string;
  }
}
