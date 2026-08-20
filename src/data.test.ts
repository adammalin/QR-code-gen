import { describe, expect, it } from "vitest";
import { createPayload, normalizeUrl } from "./data";

describe("QR payload builders", () => {
  it("normalizes a web address", () => {
    expect(normalizeUrl("ornl.gov")).toBe("https://ornl.gov");
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("creates an encoded email payload", () => {
    expect(
      createPayload("email", {
        email: "hello@example.com",
        subject: "Hello there",
        body: "A short note",
      }).value,
    ).toBe("mailto:hello@example.com?subject=Hello+there&body=A+short+note");
  });

  it("escapes reserved Wi-Fi characters", () => {
    expect(
      createPayload("wifi", {
        ssid: "Lab;Guest",
        security: "WPA",
        password: "a:b,c",
        hidden: true,
      }).value,
    ).toBe("WIFI:T:WPA;S:Lab\\;Guest;P:a\\:b\\,c;H:true;;");
  });

  it("builds a vCard without empty optional lines", () => {
    const payload = createPayload("contact", {
      contactName: "Ada Lovelace",
      organization: "",
      contactPhone: "",
      contactEmail: "ada@example.com",
      contactUrl: "",
    }).value;
    expect(payload).toContain("FN:Ada Lovelace");
    expect(payload).toContain("EMAIL:ada@example.com");
    expect(payload).not.toContain("ORG:");
  });

  it("rejects out-of-range coordinates", () => {
    expect(createPayload("location", { latitude: "91", longitude: "0" }).error).toMatch(
      /latitude/i,
    );
  });

  it("does not coerce blank coordinates to zero", () => {
    expect(createPayload("location", { latitude: "", longitude: "" }).error).toMatch(
      /latitude/i,
    );
  });
});
