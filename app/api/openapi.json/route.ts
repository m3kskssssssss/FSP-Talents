import { NextResponse } from "next/server";
import { buildOpenApi } from "@/server/openapi/document";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(buildOpenApi());
}
