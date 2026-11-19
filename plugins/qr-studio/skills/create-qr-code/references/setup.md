# Connect to QR Studio

Check for `qr_studio_status` first. Use its returned `editorUrl` and `outputDir`
instead of assuming the default port or a file destination. Do not create a
second companion when the intended one is already available.

## This installation

The source checkout used for this app is:

`/Users/ia2/Documents/Coding Projects/QR-code-gen`

The registered Codex MCP name is `qr-studio`. Its stdio entrypoint is
`plugins/qr-studio/server/index.mjs` inside that checkout. This machine's Node
executable is `/Users/ia2/.local/bin/node`. Verify those paths and the registration
before using them; the skill may be copied to another machine.

Read registration without changing it:

```sh
codex mcp get qr-studio
```

When it is enabled but tools are missing in an existing chat, open a fresh chat
or reconnect through the host. Editing configuration does not hot-load tools
into a running chat. If already authorized to operate the app, use its supported
browser controls for work possible there while reporting any MCP limitation.

## Source checkout or extracted plugin

Source checkout setup, if needed:

```sh
npm ci
npm run build
```

Run those commands in the verified project root. An extracted plugin instead
needs `npm ci --omit=dev` in its extracted root; built files are included.
Both require Node.js 22.16+ and npm. Do not run installation commands from the
skill directory itself.

Register an absent connection using verified absolute executable and entrypoint
paths through the host's supported MCP setup. For Codex:

```sh
codex mcp add qr-studio -- node "/absolute/path/to/qr-studio/server/index.mjs"
```

Use an absolute Node executable path if the desktop host does not inherit the
shell PATH. Preserve existing unrelated connections and settings. The stdio
launcher starts or reuses one loopback companion automatically.

For manual browser use, run `npm start` in the source checkout or extracted
plugin root and open the printed local URL. A running companion also exposes
Streamable HTTP at its local `/mcp` route. The usual editor URL is
`http://127.0.0.1:47833/`, but the actual status response is authoritative.
The public GitHub Pages site does not host the MCP server.

`QR_STUDIO_PORT` and `QR_STUDIO_OUTPUT_DIR` configure the first companion's
port and export folder. Later clients reuse that instance's settings. Do not
stop or restart it without accounting for unsaved editor content. A companion
autostarted by MCP remains running when a chat disconnects.

Browser WebMCP support is optional. Discover actual page tools before claiming
that route is available. Never expose the local service through a public tunnel
as a connection workaround.
