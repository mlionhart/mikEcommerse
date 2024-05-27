// This middleware gets called before every single function and every single page call. Basically what we want to do is in the function is check for if we're on an admin page, to make sure we're logged in

import { NextRequest, NextResponse } from "next/server";
import { isValidPassword } from "./lib/isValidPassword";

export async function middleware(req: NextRequest) {
  if ((await isAuthenticated(req)) === false) {
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": "Basic" }, // This is browser's built-in authentication
    });
  }
}

async function isAuthenticated(req: NextRequest) {
  // get header
  const authHeader =
    req.headers.get("authorization") || req.headers.get("Authorization");

  if (authHeader == null) return false;

  const [username, password] = Buffer.from(authHeader.split(" ")[1], "base64")
    .toString()
    .split(":")

    return username === process.env.ADMIN_USERNAME && (await isValidPassword(password, process.env.HASHED_ADMIN_PASSWORD as string))
}

// config === url route matcher
export const config = {
  // :path* matches any route that is on admin/ or beyond
  matcher: "/admin/:path*",
};
