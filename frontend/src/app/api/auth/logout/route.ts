import { clearAuthCookie } from "@/lib/server/auth-cookie";
import { csrfGuard } from "@/lib/server/csrf";

export async function POST(request: Request) {
  const blocked = csrfGuard(request);
  if (blocked) return blocked;
  await clearAuthCookie();
  return new Response(null, { status: 204 });
}
