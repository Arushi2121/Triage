import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dashboard/auth";
import { listIssuesForUser } from "@/lib/dashboard/issues_data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10) || 50,
    100,
  );
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;

  try {
    const result = await listIssuesForUser(user, { limit, offset });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Failed to list issues:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
