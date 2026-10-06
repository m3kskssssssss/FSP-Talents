import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z } from "zod";
import { AppError, tooMany } from "../lib/errors";
import { rateLimit } from "./rate-limit";

type Ctx<P> = { params: Promise<P> };
type Handler<P> = (req: NextRequest, ctx: { params: P }) => Promise<unknown>;

export function errorResponse(e: unknown) {
  if (e instanceof AppError) {
    return NextResponse.json(
      { error: { code: e.code, message: e.message, details: e.details } },
      { status: e.status },
    );
  }
  if (e instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: e.issues[0]?.message ?? "Некорректные данные",
          details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 422 },
    );
  }
  console.error("[api] unhandled", e);
  return NextResponse.json({ error: { code: "internal", message: "Внутренняя ошибка" } }, { status: 500 });
}

/**
 * Thin route-handler wrapper: resolves params, maps domain errors to HTTP and
 * serialises the result. Business logic stays in server/services.
 */
export function route<P = Record<string, string>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: Ctx<P>) => {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      const out = await handler(req, { params });
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export async function parseJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError(400, "bad_json", "Тело запроса должно быть JSON");
  }
  return schema.parse(body);
}

export function parseQuery<T extends z.ZodType>(req: NextRequest, schema: T): z.infer<T> {
  const obj: Record<string, string | string[]> = {};
  for (const [k, v] of req.nextUrl.searchParams) {
    const prev = obj[k];
    obj[k] = prev === undefined ? v : Array.isArray(prev) ? [...prev, v] : [prev, v];
  }
  return schema.parse(obj);
}

export function clientIp(req: Request) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function limitOrThrow(key: string, limit: number, windowSec: number) {
  const r = await rateLimit(key, limit, windowSec);
  if (!r.ok) throw tooMany();
}
