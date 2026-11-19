import { z } from "zod";
import { defaultDesign } from "../src/qr-options";
import { designSchema, type Job } from "./schema";
import { assess } from "./engine";

const fieldNames = ["url", "text", "email", "subject", "body", "phone", "smsPhone", "smsMessage", "ssid", "security", "password", "hidden", "contactName", "organization", "contactPhone", "contactEmail", "contactUrl", "latitude", "longitude", "locationLabel"] as const;
export const editorSchema = z.object({
  type: z.enum(["url", "text", "email", "phone", "sms", "wifi", "contact", "location"]),
  fields: z.partialRecord(z.enum(fieldNames), z.union([z.string().max(4096), z.boolean()])),
  design: designSchema.omit({ quietZoneModules: true }).extend({ quietZone: z.number().min(0).max(45) }).strict(),
}).strict();
export type EditorState = z.infer<typeof editorSchema>;

export class Workspace {
  editorUrl = "";
  paused = false;
  revision = 1;
  state: EditorState = { type: "url", fields: { url: "https://www.ornl.gov" }, design: { ...defaultDesign } };
  snapshot() { return { revision: this.revision, paused: this.paused, state: structuredClone(this.state) }; }
  agentRead() {
    if (this.paused) throw new Error("Editor access is paused. Resume it in QR Studio before reading or changing its content.");
    return this.snapshot();
  }
  update(input: unknown, expectedRevision: number) {
    if (expectedRevision !== this.revision) throw new Error("The editor changed. Read the latest state and retry with its revision.");
    this.state = editorSchema.parse(input);
    this.revision++;
    return this.snapshot();
  }
  agentSet(job: Job, expectedRevision: number) {
    this.agentRead();
    const { type, ...values } = job.content;
    const fields = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, typeof v === "number" ? String(v) : v]));
    const { quietZoneModules: _, ...design } = job.design;
    const { margin } = assess(job);
    return this.update({ type, fields, design: { ...design, quietZone: Math.round(margin / job.design.size * 1000) / 10 } }, expectedRevision);
  }
}
