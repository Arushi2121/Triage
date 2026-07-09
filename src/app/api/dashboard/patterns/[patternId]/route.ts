import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dashboard/auth";
import { getPatternDetailForUser } from "@/lib/dashboard/patterns_data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ patternId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { patternId } = await params;

  try {
    const pattern = await getPatternDetailForUser(user, patternId);
    if (!pattern) {
      return NextResponse.json({ error: "Pattern not found" }, { status: 404 });
    }
    return NextResponse.json({ pattern });
  } catch (err) {
    console.error("Failed to get pattern detail:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
