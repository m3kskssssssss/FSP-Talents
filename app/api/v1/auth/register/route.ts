import { clientIp, limitOrThrow, parseJson, route } from "@/server/http/route";
import { registerSchema } from "@/server/schemas/auth";
import { register } from "@/server/services/accounts";

export const POST = route(async (req) => {
  await limitOrThrow(`register:${clientIp(req)}`, 10, 60 * 60);
  const input = await parseJson(req, registerSchema);
  const res = await register(input);
  return { ok: true, verifyUrl: res.verifyUrl, mailDelivered: res.delivered };
});
