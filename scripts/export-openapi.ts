/** Writes docs/openapi.json from the same Zod schemas that validate requests. */
import { mkdirSync, writeFileSync } from "node:fs";
import { buildOpenApi } from "../server/openapi/document";

mkdirSync("docs", { recursive: true });
const doc = buildOpenApi();
writeFileSync("docs/openapi.json", JSON.stringify(doc, null, 2) + "\n");
console.log(`docs/openapi.json: ${Object.keys(doc.paths ?? {}).length} paths`);
