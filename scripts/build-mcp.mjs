import { build } from "esbuild";
import { mkdir, writeFile, readFile, copyFile, cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = new URL("../", import.meta.url);
const plugin = new URL("plugins/qr-studio/", root);
await mkdir(new URL("server/", plugin), { recursive: true });
await build({
  absWorkingDir: fileURLToPath(root), entryPoints: ["mcp/index.ts", "mcp/host.ts"],
  outdir: fileURLToPath(new URL("server/", plugin)), outExtension: { ".js": ".mjs" },
  bundle: true, platform: "node", target: "node22", format: "esm",
  packages: "external", sourcemap: false,
});
const source = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
const names = ["@modelcontextprotocol/sdk", "@resvg/resvg-js", "jsdom", "jsqr", "pngjs", "qr-code-styling", "qrcode-generator", "zod"];
await writeFile(new URL("package.json", plugin), JSON.stringify({
  name: "qr-studio-agent-plugin", version: "0.2.0", private: true, type: "module",
  engines: { node: ">=22.16.0" }, scripts: { start: "node server/host.mjs", mcp: "node server/index.mjs" },
  dependencies: Object.fromEntries(names.map(name => [name, source.dependencies[name]])),
}, null, 2) + "\n");
await mkdir(new URL("assets/", plugin), { recursive: true });
await copyFile(new URL("public/favicon.svg", root), new URL("assets/qr-studio.svg", plugin));
await rm(new URL("site/", plugin), { recursive: true, force: true });
await cp(new URL("dist/", root), new URL("site/", plugin), { recursive: true, filter: file => path.basename(file) !== "downloads" });
console.error("Built plugins/qr-studio/server/index.mjs");
