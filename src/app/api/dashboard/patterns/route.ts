import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dashboard/auth";
import { listPatternsForUser } from "@/lib/dashboard/patterns_data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const patterns = await listPatternsForUser(user);
    return NextResponse.json({ patterns });
  } catch (err) {
    console.error("Failed to list patterns:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
