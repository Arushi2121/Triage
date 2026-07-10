import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/dashboard/auth";
import { getDigestDetailForUser } from "@/lib/dashboard/digests_data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ digestId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { digestId } = await params;

  try {
    const digest = await getDigestDetailForUser(user, digestId);
    if (!digest) {
      return NextResponse.json({ error: "Digest not found" }, { status: 404 });
    }
    return NextResponse.json({ digest });
  } catch (err) {
    console.error("Failed to get digest detail:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
