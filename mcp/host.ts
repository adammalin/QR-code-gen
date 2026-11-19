import { fileURLToPath } from "node:url";
import { createContext } from "./server";
import { startHost } from "./http";

const context = createContext();
const port = Number(process.env.QR_STUDIO_PORT ?? "47833");
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("QR_STUDIO_PORT must be 1–65535.");
const http = await startHost(context, { port, siteDir: fileURLToPath(new URL("../site/", import.meta.url)) });
console.error(`QR Studio editor: ${context.workspace.editorUrl}`);
const close = () => http.close(() => process.exit(0));
process.once("SIGINT", close); process.once("SIGTERM", close);
