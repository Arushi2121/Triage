import { cookies } from "next/headers";
import { getUserByApiKey } from "@/db/users";
import type { User } from "@/types/db";

export const DASHBOARD_COOKIE_NAME = "triage_dashboard_key";

/**
 * Resolve the current dashboard user from the cookie.
 * Returns null if no cookie or invalid key.
 */
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(DASHBOARD_COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    return await getUserByApiKey(cookie.value);
  } catch (err) {
    console.error("Dashboard auth lookup failed:", err);
    return null;
  }
}

/**
 * Require authentication for a page/API route.
 * Callers should throw or redirect if user is null.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}
