import { z } from "zod";
import { clientIp, limitOrThrow, parseJson, route } from "@/server/http/route";
import { resendVerification } from "@/server/services/accounts";

export const POST = route(async (req) => {
  await limitOrThrow(`resend:${clientIp(req)}`, 5, 60 * 60);
  const { email } = await parseJson(req, z.object({ email: z.email().transform((s) => s.toLowerCase()) }));
  return { ok: true, ...(await resendVerification(email)) };
});
