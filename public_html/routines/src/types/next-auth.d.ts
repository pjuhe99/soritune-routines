import "next-auth";

declare module "next-auth" {
  interface User {
    role: string;
    subscriptionStatus: string;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      subscriptionStatus: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    subscriptionStatus: string;
  }
}
