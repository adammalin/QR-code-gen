# QR Studio inputs and editor conversion

Read the live tool schemas when available; they take precedence over this
reference if the app changes.

## A complete generation job

```json
{
  "content": {"type": "url", "url": "https://www.ornl.gov"},
  "design": {
    "dotStyle": "dots",
    "eyeStyle": "extra-rounded",
    "foreground": "#00662C",
    "background": "#FFFFFF",
    "transparentBackground": false,
    "size": 1024,
    "errorLevel": "Q",
    "quietZoneModules": 4
  },
  "format": "both",
  "name": "ornl-website"
}
```

`qr_studio_generate` accepts this job. Preview and validate accept only
`content` and `design`; omit `format` and `name`. `qr_studio_set_editor` accepts
`content`, `design`, and the required `expectedRevision`; omit export options.
`qr_studio_build_payload` accepts only `content`.

`name` is a stem of 1–64 letters, digits, hyphens or underscores, beginning with
a letter or digit. `format` is `png`, `svg` or `both`. The tools reject extra
fields and cannot accept a destination directory.

## Content types

| type | Required fields | Optional fields |
| --- | --- | --- |
| `url` | `url` | — |
| `text` | `text` | — |
| `email` | `email` | `subject`, `body` |
| `phone` | `phone` | — |
| `sms` | `smsPhone` | `smsMessage` |
| `wifi` | `ssid`; `password` for secured networks | `security` (WPA/WEP/nopass; default WPA), `hidden` (boolean) |
| `contact` | `contactName` | `organization`, `contactPhone`, `contactEmail`, `contactUrl` |
| `location` | `latitude`, `longitude` as numbers | `locationLabel` |

Only include fields belonging to the selected type. Latitude is −90…90;
longitude is −180…180. Optional contact fields are independent. URLs may be
normalized to HTTPS; phone whitespace is removed by the app. Text and Wi-Fi
password whitespace are preserved. `nopass` means an open Wi-Fi network.

## Design values

| Key | Allowed values |
| --- | --- |
| `dotStyle` | `dots`, `square`, `rounded` |
| `eyeStyle` | `square`, `extra-rounded`, `dot` |
| `foreground`, `background` | Six-digit `#RRGGBB` |
| `transparentBackground` | Boolean |
| `size` | Integer 256–2048 pixels |
| `errorLevel` | `L`, `M`, `Q`, `H` |
| `quietZoneModules` | Integer 4–16 |

Correction limits are measured in UTF-8 bytes: L 2953, M 2331, Q 1663, H 1273.
For excessive content, shorten only with the user's agreement; changing styling
or image size does not increase payload capacity.

## Convert a live editor read

`qr_studio_get_editor` returns:

```json
{
  "revision": 7,
  "paused": false,
  "state": {
    "type": "url",
    "fields": {"url": "https://www.ornl.gov"},
    "design": {
      "dotStyle": "dots", "eyeStyle": "extra-rounded",
      "foreground": "#00662C", "background": "#FFFFFF",
      "transparentBackground": false, "size": 1024,
      "errorLevel": "Q", "quietZone": 4
    }
  }
}
```

Build `content` from `state.type` plus **only** that type's fields. The browser
can retain inactive fields from other tabs; do not send them all to a strict
content schema. Convert location strings to finite numbers after checking that
they are nonblank. Keep `hidden` as a boolean. Treat empty optional inputs as
omitted, while preserving meaningful whitespace in text and passwords.

Copy the shared appearance keys. The editor's `quietZone` is a **percentage**;
the generation tools require `quietZoneModules`. Do not pass the percentage as
a module count or send `quietZone` to an MCP design schema. The app enforces a
minimum of four modules even when the browser percentage is smaller.

For a new code, use the four-module default unless the user requested a larger
margin. If a current code has a custom percentage margin, use supported browser
controls for targeted edits when the MCP conversion would change that margin.
For an exact matching export, use the browser's own PNG/SVG export with its
download confirmation, or explain the available module-margin choices. Do not silently round a custom browser
margin and claim an identical MCP export. There is no current-editor export
tool that accepts the raw editor state directly.

To change one setting, preserve the selected content and other shared design
keys, then send `expectedRevision: 7` from the same read. If the editor changes
before the write, read again before merging.

## Batch example

```json
{
  "jobs": [
    {
      "content": {"type": "url", "url": "https://www.ornl.gov"},
      "name": "ornl-website", "format": "both"
    },
    {
      "content": {"type": "text", "text": "Exact supplied text"},
      "name": "supplied-text", "format": "png",
      "design": {"dotStyle": "square", "size": 1024}
    }
  ]
}
```

Use 1–25 complete jobs; this tool has no top-level shared design/defaults field.
Inspect each result's `ok`, `quality`, files and errors. Runtime failures can be
isolated per job; a malformed overall request may be rejected before any job
runs. Keep the original row-to-result mapping.
