import { authRoute } from "@/lib/server/auth-route";

export const POST = (request: Request) => authRoute(request, "/auth/register");
