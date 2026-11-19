# QR Studio agent plugin

This package includes the local browser editor, MCP server and `create-qr-code`
skill. It needs Node.js 22.16+ and npm. Install runtime dependencies in this
extracted folder before connecting the server:

```sh
npm ci --omit=dev
```

Connect `mcp.json` through a host that supports local Agent Plugins, or add the
server to Codex with the **absolute path to this folder**:

```sh
codex mcp add qr-studio -- node "/absolute/path/to/qr-studio/server/index.mjs"
```

Use an absolute Node executable path when the desktop host does not inherit
your shell PATH. Restart the agent connection or open a fresh chat if needed.
The launcher automatically starts or reuses one local companion. Ask the agent
to call `qr_studio_status` and open the returned editor URL. The default is
http://127.0.0.1:47833/. Other local HTTP-capable MCP hosts may connect directly
to http://127.0.0.1:47833/mcp while the companion is running.

To start the browser editor manually, run `npm start` in this folder and open
the displayed local URL. Stop that foreground instance with Ctrl+C. A companion
started automatically by the stdio launcher remains running after a chat ends;
stop its Node process to end the session. There is no background login service.

`QR_STUDIO_PORT` changes the port (set it consistently for all clients).
`QR_STUDIO_OUTPUT_DIR` changes the export folder; its default is
`~/Downloads/QR-Studio`. Only the first companion process's environment applies
until it stops. Never expose the loopback service through a public tunnel.

The browser's Pause editor access control blocks agent tools from reading or
changing the shared editor. Independent QR generation remains available.
Editor content, including credentials, is held in memory; it is not a saved
project. Exported files persist, and Wi-Fi exports contain their password.

Technical checks are documented in the repository. An automated decode match
does not replace scanning the final printed or placed artwork.
