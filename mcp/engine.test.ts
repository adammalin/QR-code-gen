import { describe, expect, it } from "vitest";
import { assess, payloadFor, render } from "./engine";
import { jobSchema } from "./schema";
import type { Job } from "./schema";

const samples: Job["content"][] = [
  { type: "url", url: "ornl.gov/research?x=1&y=2" },
  { type: "text", text: "  café 科学 🧪\nα → β  " },
  { type: "email", email: "ada@example.com", subject: "Research & design", body: "First line\nSecond line" },
  { type: "phone", phone: "+1 865 555 0100" },
  { type: "sms", smsPhone: "+1 865 555 0100", smsMessage: "Meet at 10:30 🧪" },
  { type: "wifi", ssid: "Guest;Lab", security: "WPA", password: " space:password, ", hidden: true },
  { type: "contact", contactName: "Zoë Example", organization: "Science; Design", contactEmail: "zoe@example.com" },
  { type: "location", latitude: 35.93, longitude: -84.31, locationLabel: "Research & Design" },
];
describe("real QR image verification", () => {
  it("decodes multilingual content at the default delivery size", async () => {
    const result = await render({ content: { type: "text", text: "Clean install: café 科学 🧪" } });
    expect(result.report.size).toBe(1024);
    expect(result.report.verification.decodedMatchesPayload).toBe(true);
  });
  it.each(samples)("round-trips $type content through styled SVG and PNG", async content => {
    const result = await render({ content, design: { size: 512 } });
    expect(result.report.verification.decodedMatchesPayload).toBe(true);
    expect(result.png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(result.svg.toString()).toContain("<svg");
    expect(result.report.pixelsPerModule).toBeGreaterThan(3);
  });
  it.each(["dots", "square", "rounded"])("decodes transparent %s modules", async dotStyle => {
    const result = await render({ content: samples[0], design: { dotStyle, transparentBackground: true, size: 512 } });
    expect(result.report.verification.decodedMatchesPayload).toBe(true);
    expect(result.report.warnings.join(" ")).toMatch(/final placement/);
  });
  it.each(["square", "extra-rounded", "dot"])("decodes %s finders", async eyeStyle => {
    expect((await render({ content: samples[0], design: { eyeStyle, size: 512 } })).report.verification.decodedMatchesPayload).toBe(true);
  });
  it("preserves whitespace in text and Wi-Fi credentials", () => {
    expect(payloadFor(samples[1])).toBe("  café 科学 🧪\nα → β  ");
    expect(payloadFor(samples[5])).toContain("P: space\\:password\\, ;");
  });
  it("warns about low contrast and distinguishes decode from physical approval", async () => {
    const result = await render({ content: samples[0], design: { foreground: "#FFFFFF", background: "#FFFFFF", size: 256 } });
    expect(result.report.warnings.join(" ")).toMatch(/Low contrast/);
    expect(result.report.verification.decodedMatchesPayload).toBe(false);
    expect(result.report.verification.physicalScanTestRequired).toBe(true);
  });
  it("rejects excessive UTF-8 content before rendering", () => {
    expect(() => assess({ content: { type: "text", text: "🧪".repeat(500) } })).toThrow(/byte limit/);
  });
  it("rejects traversal names, invalid options and unexpected fields", () => {
    expect(() => jobSchema.parse({ content: samples[0], name: "../secret" })).toThrow();
    expect(() => jobSchema.parse({ content: samples[0], design: { foreground: "url(https://evil.example)" } })).toThrow();
    expect(() => jobSchema.parse({ content: samples[0], path: "/tmp/secret" })).toThrow();
    expect(() => jobSchema.parse({ content: samples[0], design: { quietZoneModules: 0 } })).toThrow();
  });
});
