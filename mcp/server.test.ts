import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext } from "./server";
import { startHost } from "./http";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

function data(result: unknown): Record<string, any> { return (result as CallToolResult).structuredContent ?? {}; }
describe("MCP clients and shared browser editor", () => {
  const context = createContext();
  let directory: string;
  let http: Awaited<ReturnType<typeof startHost>>;
  let client: Client;
  let stdio: Client;
  let url: string;
  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), "qr-studio-test-"));
    http = await startHost(context, { siteDir: fileURLToPath(new URL("../dist", import.meta.url)), outputDir: directory });
    url = context.workspace.editorUrl;
    client = new Client({ name: "http-test", version: "1.0.0" });
    await client.connect(new StreamableHTTPClientTransport(new URL("mcp", url)));
    stdio = new Client({ name: "stdio-test", version: "1.0.0" });
    await stdio.connect(new StdioClientTransport({ command: process.execPath,
      args: [fileURLToPath(new URL("../plugins/qr-studio/server/index.mjs", import.meta.url))],
      env: { ...process.env, QR_STUDIO_PORT: new URL(url).port } as Record<string, string>,
    }));
  });
  afterAll(async () => { await stdio?.close(); await client?.close(); if (http) await new Promise<void>(resolve => http.close(() => resolve())); if (directory) await rm(directory, { recursive: true, force: true }); });
  it("discovers all eight tools, the prompt and resources through real HTTP and stdio", async () => {
    const tools = await stdio.listTools();
    expect(tools.tools).toHaveLength(8);
    expect(tools.tools.every(tool => !!tool.inputSchema)).toBe(true);
    expect((await stdio.listPrompts()).prompts[0].name).toBe("create-qr-code");
    expect((await stdio.readResource({ uri: "qr-studio://guide" })).contents[0].mimeType).toBe("application/json");
    expect(data(await stdio.callTool({ name: "qr_studio_status", arguments: {} })).editorUrl).toBe(url);
  });
  it("synchronizes agent edits to the browser API and refuses stale revisions", async () => {
    const initial = data(await client.callTool({ name: "qr_studio_get_editor", arguments: {} }));
    const applied = await stdio.callTool({ name: "qr_studio_set_editor", arguments: {
      content: { type: "text", text: "Agent → browser 🧪" }, expectedRevision: initial.revision,
    } });
    expect(applied.isError).not.toBe(true);
    const browser = await (await fetch(new URL("api/editor", url))).json();
    expect(browser.state.fields.text).toBe("Agent → browser 🧪");
    const stale = await client.callTool({ name: "qr_studio_set_editor", arguments: {
      content: { type: "text", text: "Should not overwrite" }, expectedRevision: initial.revision,
    } });
    expect(stale.isError).toBe(true);
    const response = await fetch(new URL("api/editor", url), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: { ...browser.state, fields: { text: "Browser → agent" } }, expectedRevision: browser.revision }) });
    expect(response.status).toBe(200);
    expect(data(await client.callTool({ name: "qr_studio_get_editor", arguments: {} })).state.fields.text).toBe("Browser → agent");
  });
  it("blocks agent editor reads and writes when the browser pauses access", async () => {
    await fetch(new URL("api/access", url), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: true }) });
    expect((await client.callTool({ name: "qr_studio_get_editor", arguments: {} })).isError).toBe(true);
    expect((await client.callTool({ name: "qr_studio_set_editor", arguments: { content: { type: "url", url: "ornl.gov" }, expectedRevision: context.workspace.revision } })).isError).toBe(true);
    expect(data(await client.callTool({ name: "qr_studio_status", arguments: {} })).editorAccessPaused).toBe(true);
    await fetch(new URL("api/access", url), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paused: false }) });
  });
  it("creates unique verified files, serves downloads, and reads resources across clients", async () => {
    const args = { content: { type: "url", url: "https://ornl.gov" }, name: "sample", design: { size: 512 } };
    const first = data(await client.callTool({ name: "qr_studio_generate", arguments: args }));
    const second = data(await stdio.callTool({ name: "qr_studio_generate", arguments: args }));
    expect(first.quality.verification.decodedMatchesPayload).toBe(true);
    expect(first.files).toHaveLength(2);
    expect(first.files[0].path).not.toBe(second.files[0].path);
    expect(first.files[0].path.startsWith(await realpath(directory) + path.sep)).toBe(true);
    const downloaded = Buffer.from(await (await fetch(first.files[0].downloadUrl)).arrayBuffer());
    expect(downloaded.equals(await readFile(first.files[0].path))).toBe(true);
    const resource = await stdio.readResource({ uri: first.files[0].uri });
    expect(Buffer.from((resource.contents[0] as { blob: string }).blob, "base64").equals(downloaded)).toBe(true);
    await writeFile(first.files[0].path, Buffer.alloc(downloaded.length));
    await expect(client.readResource({ uri: first.files[0].uri })).rejects.toThrow(/changed/);
    await expect(client.readResource({ uri: "qr-studio://artifacts/nope/secret.txt" })).rejects.toThrow(/Unknown artifact/);
  });
  it("validates without echoing Wi-Fi credentials and previews without saving", async () => {
    const result = await client.callTool({ name: "qr_studio_validate", arguments: { content: { type: "wifi", ssid: "Guest", password: "private-test-value" } } });
    expect(JSON.stringify(result)).not.toContain("private-test-value");
    const preview = await stdio.callTool({ name: "qr_studio_preview", arguments: { content: { type: "text", text: "Preview" }, design: { size: 256 } } });
    expect(data(preview).quality.verification.decodedMatchesPayload).toBe(true);
    expect((preview as CallToolResult).content[1].type).toBe("image");
  });
  it("isolates runtime errors within batches", async () => {
    const result = data(await client.callTool({ name: "qr_studio_batch_generate", arguments: { jobs: [
      { content: { type: "text", text: "Batch first" }, design: { size: 256 }, format: "png" },
      { content: { type: "text", text: "🧪".repeat(500) } },
      { content: { type: "url", url: "ornl.gov" }, design: { size: 256 }, format: "svg" },
    ] } }));
    expect(result.succeeded).toBe(2); expect(result.failed).toBe(1);
    expect(result.results[1]).toMatchObject({ index: 1, ok: false });
  });
  it("blocks cross-origin requests, host spoofing, source paths and non-JSON writes", async () => {
    expect((await fetch(new URL("api/editor", url), { headers: { Origin: "https://evil.example" } })).status).toBe(403);
    const spoofed = await new Promise(resolve => {
      const req = request(new URL("api/editor", url), { headers: { Host: "evil.example" } }, response => { response.resume(); resolve(response.statusCode); });
      req.end();
    });
    expect(spoofed).toBe(403);
    expect((await fetch(new URL("api/editor", url), { method: "POST", body: "{}" })).status).toBe(400);
    expect((await fetch(new URL("package.json", url))).status).toBe(404);
    expect((await fetch(new URL("%2e%2e%2fpackage.json", url))).status).toBe(404);
    expect((await fetch(url)).headers.get("content-type")).toMatch(/text\/html/);
  });
});
