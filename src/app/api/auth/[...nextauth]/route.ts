import NextAuth from "next-auth";
import { authOptions } from "@/app/lib/auth/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

/** Avoid static caching; session endpoints must always hit the route handler. */
export const dynamic = "force-dynamic";


