# QR Studio

A mobile-friendly, client-side QR code generator using the ORNL color system. It creates QR codes for websites, text, email, phone, SMS, Wi-Fi, vCards, and locations, then exports high-resolution PNG or editable SVG files with solid or transparent backgrounds.

## Local development

```bash
npm install
npm run dev
```

Production checks:

```bash
npm test
npm run build
npm run preview
```

The static site is generated in `dist/`. Vite uses relative asset paths, so the same build works at a GitHub Pages project URL.

## GitHub Pages

The repository is configured to publish through GitHub Actions. The included `.github/workflows/deploy-pages.yml` workflow tests, builds, and deploys the site whenever `main` is pushed.

The standalone public page sends no QR content to a server and stores only
appearance settings in the browser. The optional local companion shares editor
content with connected agents as described below.

## Agent access

QR Studio now includes a **local browser companion** and standard MCP server.
People and agents can share the same editor. The GitHub Pages app stays static;
the companion listens only on this computer at `http://127.0.0.1:47833/`.

From this source checkout, with Node.js 22.16+:

```sh
npm ci
npm run build
npm start
```

Open the printed local URL. To connect Codex (use your actual absolute paths):

```sh
codex mcp add qr-studio -- node "/absolute/path/to/QR-code-gen/plugins/qr-studio/server/index.mjs"
```

The stdio launcher automatically starts or reuses the companion. HTTP-capable
local MCP clients can use `http://127.0.0.1:47833/mcp` while it is running.
Use `qr_studio_status` to discover the actual editor URL and export folder.
`QR_STUDIO_PORT` and `QR_STUDIO_OUTPUT_DIR` configure those values; the first
companion's settings apply until it stops. Default exports go to
`~/Downloads/QR-Studio`. Use an absolute Node path if your desktop app needs it.

| Tool | Purpose |
| --- | --- |
| `qr_studio_status` | Connection, editor URL, limits and export folder |
| `qr_studio_get_editor` | Read visible content, appearance and revision |
| `qr_studio_set_editor` | Update the browser with conflict protection |
| `qr_studio_build_payload` | Inspect the exact encoded payload explicitly |
| `qr_studio_validate` | Capacity, density, contrast and quiet-zone checks |
| `qr_studio_preview` | Inline PNG preview and decode result |
| `qr_studio_generate` | Save verified PNG and/or editable SVG |
| `qr_studio_batch_generate` | Export up to 25 jobs with individual results |

The server also provides a workflow prompt, guide resource, and generated-file
resources. Exports never overwrite an existing file. The 200 resource handles
are scoped to the companion session; files persist after it stops. Changes to
the shared editor remain in memory and are lost when the companion stops.

**Pause editor access** blocks agents from reading or editing the visible code.
Independent generation remains available. Browser tabs and MCP clients share
revision checks. A conflict preserves the visible browser edit and asks the
person to reload shared state before reconnecting. Connected agents can receive
the content they read; Wi-Fi exports encode the supplied password. Content is
not written to browser storage or application logs.

The public page also registers three optional `qr_studio_browser_*` WebMCP
actions when supported by the browser. Browser downloads and automated MCP
file exports have different confirmation semantics; only the companion returns
verified filesystem paths and an automated byte-for-byte decode result.

### Skill and plugin package

The portable local plugin and its `create-qr-code` skill are in
`plugins/qr-studio/`. The extracted plugin needs `npm ci --omit=dev` before its
server is connected. It runs locally; account upload alone cannot make it
available on web/mobile. Full instructions are in that folder's README.

To build a reproducible ZIP for the site's download link:

```sh
npm run build
npm install --package-lock-only --ignore-scripts --prefix plugins/qr-studio
npm run package:plugin
```

This writes `outputs/qr-studio-plugin-0.2.0.zip` and adds a copy to
`dist/downloads/qr-studio-plugin.zip`. Dependencies are locked but not bundled
in the ZIP. No private QR exports or editor content are packaged.

The shared renderer preserves UTF-8 content and enforces a quiet zone of at
least four modules. Generated SVG artwork is rasterized for verification, and
the decoded bytes are compared to the intended payload. This is a technical
check; scan the final printed/placed artwork on actual devices before release.

Implementation references: [MCP SDK server guidance](https://ts.sdk.modelcontextprotocol.io/server),
[QR Code Styling](https://github.com/kozakdenys/qr-code-styling),
[resvg-js](https://github.com/thx/resvg-js).

## Brand status

This is a draft application of the ORNL visual system, not an officially approved ORNL product. It intentionally omits the ORNL logo because approved production artwork was not supplied.
