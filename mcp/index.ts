import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, ListResourcesRequestSchema, ReadResourceRequestSchema, ListResourceTemplatesRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const port = Number(process.env.QR_STUDIO_PORT ?? "47833");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("QR_STUDIO_PORT must be 1–65535.");
const origin = `http://127.0.0.1:${port}`;
async function ready() {
  try {
    const response = await fetch(`${origin}/api/status`, { signal: AbortSignal.timeout(750) });
    const status = await response.json();
    if (status.app !== "qr-studio-companion" || status.version !== "0.2.0") throw new Error("Port is occupied by a different application or QR Studio version.");
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Port is occupied")) throw error;
    return false;
  }
}
if (!await ready()) {
  const child = spawn(process.execPath, [fileURLToPath(new URL("host.mjs", import.meta.url))], { detached: true, stdio: "ignore", env: process.env });
  child.unref();
  let started = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (await ready()) { started = true; break; }
  }
  if (!started) throw new Error("QR Studio companion could not start. Run npm start in the installed plugin folder to inspect the error.");
}
const client = new Client({ name: "qr-studio-local-bridge", version: "0.2.0" });
await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
const server = new Server({ name: "qr-studio", version: "0.2.0" }, { capabilities: { tools: {}, resources: {}, prompts: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => client.listTools());
server.setRequestHandler(CallToolRequestSchema, async request => client.callTool(request.params));
server.setRequestHandler(ListResourcesRequestSchema, async () => client.listResources());
server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => client.listResourceTemplates());
server.setRequestHandler(ReadResourceRequestSchema, async request => client.readResource(request.params));
server.setRequestHandler(ListPromptsRequestSchema, async () => client.listPrompts());
server.setRequestHandler(GetPromptRequestSchema, async request => client.getPrompt(request.params));
await server.connect(new StdioServerTransport(process.stdin, process.stdout, { maxBufferSize: 256 * 1024 }));
process.stdin.once("end", () => { void client.close(); });
