// app/api/env-check/route.ts

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
  });
}
