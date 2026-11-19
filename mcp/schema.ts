import { z } from "zod";

const text = z.string().max(4096);
const required = text.min(1);
export const contentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("url"), url: required }).strict(),
  z.object({ type: z.literal("text"), text: required }).strict(),
  z.object({ type: z.literal("email"), email: required, subject: text.optional(), body: text.optional() }).strict(),
  z.object({ type: z.literal("phone"), phone: required }).strict(),
  z.object({ type: z.literal("sms"), smsPhone: required, smsMessage: text.optional() }).strict(),
  z.object({ type: z.literal("wifi"), ssid: required, security: z.enum(["WPA", "WEP", "nopass"]).default("WPA"), password: text.optional(), hidden: z.boolean().default(false) }).strict(),
  z.object({ type: z.literal("contact"), contactName: required, organization: text.optional(), contactPhone: text.optional(), contactEmail: text.optional(), contactUrl: text.optional() }).strict(),
  z.object({ type: z.literal("location"), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), locationLabel: text.optional() }).strict(),
]);
export const designSchema = z.object({
  dotStyle: z.enum(["dots", "square", "rounded"]).default("dots"),
  eyeStyle: z.enum(["square", "extra-rounded", "dot"]).default("extra-rounded"),
  foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#00662C"),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FFFFFF"),
  transparentBackground: z.boolean().default(false),
  size: z.number().int().min(256).max(2048).default(1024),
  errorLevel: z.enum(["L", "M", "Q", "H"]).default("Q"),
  quietZoneModules: z.number().int().min(4).max(16).default(4),
}).strict();
export const jobSchema = z.object({
  content: contentSchema,
  design: designSchema.prefault({}),
  format: z.enum(["png", "svg", "both"]).default("both"),
  name: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/).default("qr-code")
    .describe("Filename stem only: letters, digits, hyphens or underscores. Files are written only to the configured export folder."),
}).strict();
export type Job = z.infer<typeof jobSchema>;
