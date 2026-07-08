import { NextResponse } from "next/server";
import { getUserByApiKey } from "@/db/users";
import { DASHBOARD_COOKIE_NAME } from "@/lib/dashboard/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const apiKey: string | undefined = body?.apiKey;

    if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
      return NextResponse.json({ error: "API key required" }, { status: 400 });
    }

    const user = await getUserByApiKey(apiKey);
    if (!user) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(DASHBOARD_COOKIE_NAME, apiKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return response;
  } catch (err) {
    console.error("Dashboard login error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
