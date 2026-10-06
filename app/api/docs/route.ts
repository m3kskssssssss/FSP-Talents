export const dynamic = "force-static";

const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API · ФСП Таланты</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>body{margin:0} .topbar{display:none}</style>
</head>
<body>
  <div id="swagger"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>window.ui = SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#swagger", withCredentials: true });</script>
</body>
</html>`;

export function GET() {
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
