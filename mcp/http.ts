import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer, readArtifact, type Context, VERSION } from "./server";
import { z } from "zod";

const types: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".woff": "font/woff", ".woff2": "font/woff2", ".zip": "application/zip", ".json": "application/json" };
async function body(req: IncomingMessage) {
  if (req.headers["content-type"]?.split(";")[0] !== "application/json") throw new Error("JSON content type required.");
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > 256 * 1024) throw new Error("Request exceeds 256 KiB.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function startHost(context: Context, options: { port?: number; siteDir: string; outputDir?: string }) {
  const root = await realpath(options.siteDir);
  const http = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    const json = (code: number, value: unknown) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }); res.end(JSON.stringify(value)); };
    try {
      const address = http.address();
      if (!address || typeof address === "string") return json(503, { error: "Companion starting." });
      const allowed = [`http://127.0.0.1:${address.port}`, `http://localhost:${address.port}`];
      if (!allowed.some(origin => req.headers.host === new URL(origin).host)) return json(403, { error: "Invalid host." });
      if (req.headers.origin && !allowed.includes(req.headers.origin)) return json(403, { error: "Cross-origin requests are blocked." });
      if (req.headers["sec-fetch-site"] === "cross-site") return json(403, { error: "Cross-site requests are blocked." });
      const url = new URL(req.url ?? "/", allowed[0]);
      if (url.pathname === "/mcp") {
        if (req.method !== "POST") return json(405, { error: "Use Streamable HTTP POST requests." });
        const input = await body(req);
        const mcp = createServer({ context, outputDir: options.outputDir });
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
        res.once("close", () => { void transport.close(); void mcp.close(); });
        await mcp.connect(transport);
        await transport.handleRequest(req, res, input);
        return;
      }
      if (req.method === "GET" && url.pathname === "/api/status") return json(200, { app: "qr-studio-companion", version: VERSION, editorUrl: context.workspace.editorUrl });
      if (req.method === "GET" && url.pathname === "/api/editor") return json(200, context.workspace.snapshot());
      if (req.method === "POST" && url.pathname === "/api/editor") {
        const input = z.object({ state: z.unknown(), expectedRevision: z.number().int().positive() }).strict().parse(await body(req));
        try { return json(200, context.workspace.update(input.state, input.expectedRevision)); }
        catch (error) { return json(409, { error: error instanceof Error ? error.message : "Editor conflict." }); }
      }
      if (req.method === "POST" && url.pathname === "/api/access") {
        const { paused } = z.object({ paused: z.boolean() }).strict().parse(await body(req));
        context.workspace.paused = paused;
        return json(200, context.workspace.snapshot());
      }
      if (req.method !== "GET" && req.method !== "HEAD") return json(405, { error: "Method not allowed." });
      if (url.pathname.startsWith("/exports/")) {
        const { artifact, bytes } = await readArtifact(context, `qr-studio://artifacts/${url.pathname.slice(9)}`);
        res.writeHead(200, { "Content-Type": artifact.mimeType, "Content-Length": bytes.length, "Content-Disposition": `attachment; filename="${artifact.name}"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
        res.end(req.method === "HEAD" ? undefined : bytes); return;
      }
      const relative = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
      if (!(relative === "index.html" || relative === "favicon.svg" || /^assets\/[a-zA-Z0-9_.-]+$/.test(relative) || /^downloads\/[a-zA-Z0-9_.-]+$/.test(relative))) return json(404, { error: "Not found." });
      const file = await realpath(path.join(root, relative));
      if (!file.startsWith(root + path.sep)) return json(404, { error: "Not found." });
      const bytes = await readFile(file);
      res.writeHead(200, { "Content-Type": types[path.extname(file)] ?? "application/octet-stream", "Content-Length": bytes.length, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
      res.end(req.method === "HEAD" ? undefined : bytes);
    } catch (error) { if (!res.headersSent) json(400, { error: error instanceof Error ? error.message : "Request failed." }); else res.end(); }
  });
  await new Promise<void>((resolve, reject) => { http.once("error", reject); http.listen(options.port ?? 0, "127.0.0.1", resolve); });
  const address = http.address();
  if (!address || typeof address === "string") throw new Error("No editor address.");
  context.workspace.editorUrl = `http://127.0.0.1:${address.port}/`;
  return http;
}
