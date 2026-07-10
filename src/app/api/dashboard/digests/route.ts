import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dashboard/auth";
import { listDigestsForUser } from "@/lib/dashboard/digests_data";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const digests = await listDigestsForUser(user);
    return NextResponse.json({ digests });
  } catch (err) {
    console.error("Failed to list digests:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
