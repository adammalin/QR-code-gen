import QRCodeStyling from "qr-code-styling";
import { JSDOM } from "jsdom";
import { Resvg } from "@resvg/resvg-js";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import qrcode from "qrcode-generator";
import { createPayload, type FieldValues } from "../src/data";
import { buildQrOptions, byteCapacity, utf8Binary } from "../src/qr-options";
import { jobSchema, type Job } from "./schema";

export function payloadFor(content: Job["content"]): string {
  const { type, ...values } = content;
  const fields: FieldValues = {};
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) fields[key] = typeof value === "number" ? String(value) : value;
  }
  const payload = createPayload(type, fields);
  if (payload.error) throw new Error(payload.error);
  return payload.value;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
  });
  return .2126 * r + .7152 * g + .0722 * b;
}

export function assess(input: unknown) {
  const job = jobSchema.parse(input);
  const payload = payloadFor(job.content);
  const bytes = Buffer.byteLength(payload, "utf8");
  if (bytes > byteCapacity[job.design.errorLevel]) {
    throw new Error(`Content exceeds the ${byteCapacity[job.design.errorLevel]} UTF-8 byte limit for ${job.design.errorLevel} error correction. Shorten the content or lower error correction.`);
  }
  const matrix = qrcode(0, job.design.errorLevel);
  matrix.addData(utf8Binary(payload), "Byte");
  matrix.make();
  const modules = matrix.getModuleCount();
  const margin = Math.ceil(job.design.size * job.design.quietZoneModules / (modules + 2 * job.design.quietZoneModules));
  const pixelsPerModule = Math.floor((job.design.size - 2 * margin) / modules);
  const foreground = luminance(job.design.foreground);
  const background = luminance(job.design.background);
  const contrast = (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
  const warnings: string[] = [];
  if (job.design.transparentBackground) warnings.push("Transparent codes must be placed on a light, solid surface. Decode verification uses a white backing; test the final placement.");
  if (contrast < 4.5) warnings.push(`Low contrast (${contrast.toFixed(2)}:1). Use darker modules and a lighter background.`);
  if (foreground >= background) warnings.push("Modules should be darker than their background.");
  if (pixelsPerModule < 4) warnings.push("The code is dense at this size. Increase output size to at least four pixels per module.");
  if (pixelsPerModule < 1) throw new Error("The output size cannot fit this content and quiet zone. Increase size or shorten content.");
  return { job, payload, margin, report: { type: job.content.type, payloadBytes: bytes,
    modules, pixelsPerModule, quietZoneModules: job.design.quietZoneModules,
    contrastRatio: Number(contrast.toFixed(2)), warnings } };
}

export async function render(input: unknown) {
  const assessed = assess(input);
  const { job, payload, margin } = assessed;
  const qr = new QRCodeStyling({ ...buildQrOptions({ ...job.design, quietZone: 0 }, job.design.size, payload, margin), jsdom: JSDOM });
  try {
    const raw = await qr.getRawData("svg");
    if (!raw) throw new Error("SVG generation failed.");
    // resvg does not resolve the quoted fragment URLs emitted by this renderer.
    const svg = raw.toString().replace(/url\('#([^']+)'\)/g, "url(#$1)");
    const png = new Resvg(svg).render().asPng();
    const decodedPng = PNG.sync.read(png);
    const pixels = new Uint8ClampedArray(decodedPng.data);
    // Composite transparency over white for verification; exported PNG stays transparent.
    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3] / 255;
      for (let channel = 0; channel < 3; channel++) pixels[i + channel] = Math.round(pixels[i + channel] * alpha + 255 * (1 - alpha));
      pixels[i + 3] = 255;
    }
    const decoded = jsQR(pixels, decodedPng.width, decodedPng.height, { inversionAttempts: "attemptBoth" });
    const expected = Buffer.from(payload, "utf8");
    const verified = decoded !== null && Buffer.from(decoded.binaryData).equals(expected);
    if (!verified) assessed.report.warnings.push("Automated decode did not match the intended bytes. Adjust styling, contrast, or size and regenerate before use.");
    return { svg: Buffer.from(svg), png: Buffer.from(png), report: { ...assessed.report,
      size: job.design.size, design: job.design, verification: { decodedMatchesPayload: verified, backing: "white", method: "jsQR byte comparison", physicalScanTestRequired: true } } };
  } finally {
    qr._window.close();
  }
}
