import { NextRequest, NextResponse } from "next/server";
import { isValidPassword } from "./lib/isValidPassword";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only apply middleware to /admin routes
  if (pathname.startsWith("/admin")) {
    if (!(await isAuthenticated(req))) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: { "WWW-Authenticate": "Basic" }, // This is browser's built-in authentication
      });
    }
  }

  // Continue with the request if not an admin path
  return NextResponse.next();
}

async function isAuthenticated(req: NextRequest): Promise<boolean> {
  // Get the authorization header
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");

  if (!authHeader) return false;

  const [username, password] = Buffer.from(authHeader.split(" ")[1], "base64")
    .toString()
    .split(":");

  return (
    username === process.env.ADMIN_USERNAME &&
    (await isValidPassword(
      password,
      process.env.HASHED_ADMIN_PASSWORD as string
    ))
  );
}

// Config to specify the matcher for the middleware
export const config = {
  matcher: "/admin/:path*",
};
