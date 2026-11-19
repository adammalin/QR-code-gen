export type QRDataType =
  | "url"
  | "text"
  | "email"
  | "phone"
  | "sms"
  | "wifi"
  | "contact"
  | "location";

export type FieldValues = Record<string, string | boolean>;

export interface PayloadResult {
  value: string;
  error: string | null;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function escapeWifi(value: string): string {
  return value.replace(/([\\;,\":])/g, "\\$1");
}

function escapeVCard(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function stringField(fields: FieldValues, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : "";
}

function rawField(fields: FieldValues, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value : "";
}

export function createPayload(type: QRDataType, fields: FieldValues): PayloadResult {
  switch (type) {
    case "url": {
      const rawUrl = stringField(fields, "url");
      if (!rawUrl) return { value: "", error: "Enter a URL to create a code." };
      if (/^[a-z][a-z\d+.-]*:/i.test(rawUrl) && !/^https?:\/\//i.test(rawUrl) && !/^[^/:\s]+:\d+(?:[/#?]|$)/.test(rawUrl)) {
        return { value: "", error: "Use an HTTP or HTTPS web address." };
      }
      const url = normalizeUrl(rawUrl);
      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) throw new Error("Unsupported address");
      } catch {
        return { value: "", error: "Enter a valid web address." };
      }
      return { value: url, error: null };
    }

    case "text": {
      const text = rawField(fields, "text");
      return text.trim()
        ? { value: text, error: null }
        : { value: "", error: "Enter the text you want to encode." };
    }

    case "email": {
      const address = stringField(fields, "email");
      if (!emailPattern.test(address)) {
        return { value: "", error: "Enter a valid email address." };
      }
      const query = new URLSearchParams();
      const subject = stringField(fields, "subject");
      const body = rawField(fields, "body");
      if (subject) query.set("subject", subject);
      if (body) query.set("body", body);
      const suffix = query.toString();
      return { value: `mailto:${address}${suffix ? `?${suffix}` : ""}`, error: null };
    }

    case "phone": {
      const phone = stringField(fields, "phone").replace(/\s/g, "");
      return phone && /^[+\d().xX-]+$/.test(phone) && /\d/.test(phone)
        ? { value: `tel:${phone}`, error: null }
        : { value: "", error: "Enter a phone number." };
    }

    case "sms": {
      const phone = stringField(fields, "smsPhone").replace(/\s/g, "");
      const message = rawField(fields, "smsMessage");
      return phone && /^[+\d().-]+$/.test(phone) && /\d/.test(phone)
        ? { value: `SMSTO:${phone}:${message}`, error: null }
        : { value: "", error: "Enter the recipient’s phone number." };
    }

    case "wifi": {
      const ssid = rawField(fields, "ssid");
      if (!ssid) return { value: "", error: "Enter the network name (SSID)." };
      const security = stringField(fields, "security") || "WPA";
      if (!["WPA", "WEP", "nopass"].includes(security)) return { value: "", error: "Choose WPA, WEP, or an open network." };
      const password = rawField(fields, "password");
      if (security !== "nopass" && !password) {
        return { value: "", error: "Enter the network password or choose Open network." };
      }
      const hidden = fields.hidden === true ? "true" : "false";
      const passwordPart = security === "nopass" ? "" : `P:${escapeWifi(password)};`;
      return {
        value: `WIFI:T:${security};S:${escapeWifi(ssid)};${passwordPart}H:${hidden};;`,
        error: null,
      };
    }

    case "contact": {
      const name = stringField(fields, "contactName");
      if (!name) return { value: "", error: "Enter the contact’s name." };
      const organization = stringField(fields, "organization");
      const phone = stringField(fields, "contactPhone");
      const email = stringField(fields, "contactEmail");
      const website = normalizeUrl(stringField(fields, "contactUrl"));
      if (email && !emailPattern.test(email)) return { value: "", error: "Enter a valid contact email address." };
      if (website && createPayload("url", { url: website }).error) return { value: "", error: "Enter a valid contact website." };
      const lines = [
        "BEGIN:VCARD",
        "VERSION:3.0",
        `N:;${escapeVCard(name)};;;`,
        `FN:${escapeVCard(name)}`,
      ];
      if (organization) lines.push(`ORG:${escapeVCard(organization)}`);
      if (phone) lines.push(`TEL;TYPE=CELL:${escapeVCard(phone)}`);
      if (email) lines.push(`EMAIL:${escapeVCard(email)}`);
      if (website) lines.push(`URL:${escapeVCard(website)}`);
      lines.push("END:VCARD");
      return { value: lines.join("\n"), error: null };
    }

    case "location": {
      const latitudeText = stringField(fields, "latitude");
      const longitudeText = stringField(fields, "longitude");
      if (!latitudeText) return { value: "", error: "Enter a latitude from −90 to 90." };
      if (!longitudeText) return { value: "", error: "Enter a longitude from −180 to 180." };
      const latitude = Number(latitudeText);
      const longitude = Number(longitudeText);
      if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
        return { value: "", error: "Enter a latitude from −90 to 90." };
      }
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return { value: "", error: "Enter a longitude from −180 to 180." };
      }
      const label = stringField(fields, "locationLabel");
      const coordinates = `${latitude},${longitude}`;
      return {
        value: `geo:${coordinates}${label ? `?q=${coordinates}(${encodeURIComponent(label)})` : ""}`,
        error: null,
      };
    }
  }
}
