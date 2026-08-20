import "@fontsource/mulish/latin-400.css";
import "@fontsource/mulish/latin-600.css";
import "@fontsource/mulish/latin-700.css";
import "@fontsource/mulish/latin-800.css";
import QRCodeStyling, { type Options } from "qr-code-styling";
import { createPayload, type FieldValues, type QRDataType } from "./data";
import "./style.css";

type DotStyle = "dots" | "square" | "rounded";
type EyeStyle = "square" | "extra-rounded" | "dot";
type ErrorLevel = "L" | "M" | "Q" | "H";

interface DesignState {
  dotStyle: DotStyle;
  eyeStyle: EyeStyle;
  foreground: string;
  background: string;
  transparentBackground: boolean;
  size: number;
  quietZone: number;
  errorLevel: ErrorLevel;
}

const dataTypes: Array<{ id: QRDataType; label: string; short: string }> = [
  { id: "url", label: "Website", short: "URL" },
  { id: "text", label: "Plain text", short: "TXT" },
  { id: "email", label: "Email", short: "@" },
  { id: "phone", label: "Phone", short: "TEL" },
  { id: "sms", label: "Text message", short: "SMS" },
  { id: "wifi", label: "Wi-Fi", short: "WIFI" },
  { id: "contact", label: "Contact card", short: "VCF" },
  { id: "location", label: "Location", short: "GEO" },
];

const defaultFields: FieldValues = {
  url: "https://www.ornl.gov",
  text: "",
  email: "",
  subject: "",
  body: "",
  phone: "",
  smsPhone: "",
  smsMessage: "",
  ssid: "",
  security: "WPA",
  password: "",
  hidden: false,
  contactName: "",
  organization: "",
  contactPhone: "",
  contactEmail: "",
  contactUrl: "",
  latitude: "",
  longitude: "",
  locationLabel: "",
};

const defaultDesign: DesignState = {
  dotStyle: "dots",
  eyeStyle: "extra-rounded",
  foreground: "#00662C",
  background: "#FFFFFF",
  transparentBackground: false,
  size: 1024,
  quietZone: 4,
  errorLevel: "Q",
};

// Approximate Version 40 byte-mode limits. The guard prevents the QR library
// from receiving payloads it cannot encode at the selected correction level.
const byteCapacity: Record<ErrorLevel, number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };

const savedDesign = loadDesign();
let currentType: QRDataType = "url";
let fields: FieldValues = { ...defaultFields };
let design: DesignState = { ...defaultDesign, ...savedDesign };
let previewQr: QRCodeStyling | null = null;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("App container is missing.");

app.innerHTML = `
  <div class="brand-rail" aria-hidden="true"></div>
  <header class="site-header">
    <a class="wordmark" href="#main-content" aria-label="QR Studio home">
      <span class="wordmark-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span>QR Studio</span>
    </a>
    <div class="header-note">
      <span class="header-dot" aria-hidden="true"></span>
      ORNL color system
    </div>
  </header>

  <main id="main-content" class="page-shell">
    <section class="intro" aria-labelledby="page-title">
      <p class="eyebrow">Fast. Flexible. Private.</p>
      <h1 id="page-title">Make a QR code<br /><span>worth scanning.</span></h1>
      <p class="intro-copy">Choose your content, shape the modules, and export a crisp code for screens or print. Everything happens in your browser.</p>
    </section>

    <div class="studio-layout">
      <section class="controls-panel" aria-label="QR code settings">
        <div class="panel-section data-section">
          <div class="section-heading">
            <span class="step-number">01</span>
            <div><h2>Choose the content</h2><p>What should happen when the code is scanned?</p></div>
          </div>
          <div class="type-grid" role="tablist" aria-label="QR code content type">
            ${dataTypes
              .map(
                ({ id, label, short }) => `
                <button class="type-button${id === currentType ? " is-active" : ""}" type="button" role="tab" aria-selected="${id === currentType}" data-type="${id}">
                  <span aria-hidden="true">${short}</span>${label}
                </button>`,
              )
              .join("")}
          </div>
          <div id="type-fields" class="field-grid" aria-live="polite"></div>
        </div>

        <div class="panel-section">
          <div class="section-heading">
            <span class="step-number">02</span>
            <div><h2>Shape the code</h2><p>Dots are the signature; pixels maximize simplicity.</p></div>
          </div>

          <fieldset class="control-group">
            <legend>Module style</legend>
            <div class="visual-options visual-options--three">
              ${visualOption("dots", "Dots", dotIcon("dots"), design.dotStyle === "dots")}
              ${visualOption("square", "Pixels", dotIcon("square"), design.dotStyle === "square")}
              ${visualOption("rounded", "Soft pixels", dotIcon("rounded"), design.dotStyle === "rounded")}
            </div>
          </fieldset>

          <fieldset class="control-group">
            <legend>Finder style</legend>
            <div class="visual-options visual-options--three">
              ${eyeOption("square", "Square", design.eyeStyle === "square")}
              ${eyeOption("extra-rounded", "Rounded", design.eyeStyle === "extra-rounded")}
              ${eyeOption("dot", "Dot", design.eyeStyle === "dot")}
            </div>
          </fieldset>

          <div class="color-grid">
            ${colorControl("foreground", "Code color", design.foreground)}
            ${colorControl("background", "Background", design.background)}
            <label class="checkbox-label transparent-toggle">
              <input id="transparent-background" type="checkbox"${design.transparentBackground ? " checked" : ""} />
              <span aria-hidden="true"></span>
              <div><strong>Transparent background</strong><small>Applied to PNG and SVG exports</small></div>
            </label>
          </div>

          <div class="palette-row" aria-label="ORNL code color presets">
            <span>ORNL presets</span>
            ${[
              ["#00662C", "ORNL Green"],
              ["#00454D", "Hale Navy"],
              ["#005776", "Hydro"],
              ["#006BA6", "Infinity"],
              ["#373A36", "Dark Matter"],
            ]
              .map(
                ([color, label]) =>
                  `<button class="swatch" type="button" data-preset="${color}" style="--swatch:${color}" aria-label="Use ${label}"></button>`,
              )
              .join("")}
          </div>
        </div>

        <div class="panel-section">
          <div class="section-heading">
            <span class="step-number">03</span>
            <div><h2>Set the output</h2><p>Large PNGs and SVGs stay sharp in production.</p></div>
          </div>

          <div class="range-control">
            <div class="range-label"><label for="output-size">Output size</label><output id="output-size-value">${design.size} px</output></div>
            <input id="output-size" type="range" min="256" max="2048" step="64" value="${design.size}" />
            <div class="range-scale"><span>256 px</span><span>2048 px</span></div>
          </div>

          <details class="advanced-settings">
            <summary>Advanced scan settings</summary>
            <div class="advanced-grid">
              <label class="field-label">Error correction
                <select id="error-level">
                  <option value="L"${design.errorLevel === "L" ? " selected" : ""}>Low — smaller code</option>
                  <option value="M"${design.errorLevel === "M" ? " selected" : ""}>Medium</option>
                  <option value="Q"${design.errorLevel === "Q" ? " selected" : ""}>Quartile — recommended</option>
                  <option value="H"${design.errorLevel === "H" ? " selected" : ""}>High — most resilient</option>
                </select>
              </label>
              <div class="range-control range-control--compact">
                <div class="range-label"><label for="quiet-zone">Quiet zone</label><output id="quiet-zone-value">${design.quietZone}%</output></div>
                <input id="quiet-zone" type="range" min="0" max="12" step="1" value="${design.quietZone}" />
              </div>
            </div>
          </details>
        </div>
      </section>

      <aside class="preview-panel" aria-label="QR code preview">
        <div class="preview-heading">
          <div><span class="live-indicator" aria-hidden="true"></span><strong>Live preview</strong></div>
          <span id="payload-count">0 characters</span>
        </div>
        <div id="preview-stage" class="preview-stage${design.transparentBackground ? " is-transparent" : ""}">
          <div class="stage-grid" aria-hidden="true"></div>
          <span id="transparent-chip" class="transparent-chip"${design.transparentBackground ? "" : " hidden"}>Transparent</span>
          <div id="qr-preview" aria-label="Generated QR code preview"></div>
        </div>
        <div id="quality-status" class="quality-status" role="status"></div>
        <div class="export-actions">
          <button class="button button--primary" type="button" data-export="png">
            <span>Download PNG</span><b>High-res</b>
          </button>
          <button class="button button--secondary" type="button" data-export="svg">
            <span>Download SVG</span><b>Editable</b>
          </button>
          <button class="button button--quiet" id="copy-png" type="button">Copy PNG</button>
        </div>
        <button class="reset-button" id="reset-design" type="button">Reset appearance</button>
        <p class="privacy-note"><span aria-hidden="true">◆</span><strong>Private by design.</strong> Your data never leaves this device.</p>
      </aside>
    </div>
  </main>
  <footer class="site-footer"><span>QR Studio</span><span>Client-side generator · Ready for static hosting</span></footer>
  <div id="toast" class="toast" role="status" aria-live="polite"></div>
`;

const fieldsHost = getElement<HTMLDivElement>("type-fields");
const previewHost = getElement<HTMLDivElement>("qr-preview");

renderTypeFields();
createPreview();
wireEvents();
updateAll();

function wireEvents(): void {
  app?.addEventListener("click", async (event) => {
    const target = event.target as HTMLElement;
    const typeButton = target.closest<HTMLButtonElement>("[data-type]");
    if (typeButton) {
      currentType = typeButton.dataset.type as QRDataType;
      document.querySelectorAll<HTMLButtonElement>("[data-type]").forEach((button) => {
        const active = button === typeButton;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
      });
      renderTypeFields();
      updateAll();
      return;
    }

    const dotButton = target.closest<HTMLButtonElement>("[data-dot-style]");
    if (dotButton) {
      design.dotStyle = dotButton.dataset.dotStyle as DotStyle;
      setSelected("[data-dot-style]", dotButton);
      persistDesign();
      updateAll();
      return;
    }

    const eyeButton = target.closest<HTMLButtonElement>("[data-eye-style]");
    if (eyeButton) {
      design.eyeStyle = eyeButton.dataset.eyeStyle as EyeStyle;
      setSelected("[data-eye-style]", eyeButton);
      persistDesign();
      updateAll();
      return;
    }

    const swatch = target.closest<HTMLButtonElement>("[data-preset]");
    if (swatch?.dataset.preset) {
      design.foreground = swatch.dataset.preset;
      syncColor("foreground", design.foreground);
      persistDesign();
      updateAll();
      return;
    }

    const exportButton = target.closest<HTMLButtonElement>("[data-export]");
    if (exportButton) {
      const extension = exportButton.dataset.export as "png" | "svg";
      await exportQr(extension, exportButton);
      return;
    }

    if (target.closest("#copy-png")) {
      await copyPng();
      return;
    }

    if (target.closest("#reset-design")) {
      design = { ...defaultDesign };
      localStorage.removeItem("qr-studio-design");
      syncAllDesignControls();
      updateAll();
      showToast("Appearance reset to ORNL defaults.");
    }
  });

  app?.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    if (target.dataset.field) {
      fields[target.dataset.field] = target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;
      updateAll();
      return;
    }

    if (target.id === "transparent-background") {
      design.transparentBackground = (target as HTMLInputElement).checked;
      syncTransparencyControls();
      persistDesign();
      updateAll();
      return;
    }

    if (target.id === "output-size") {
      design.size = Number(target.value);
      getElement<HTMLOutputElement>("output-size-value").textContent = `${design.size} px`;
      persistDesign();
      updateAll();
      return;
    }

    if (target.id === "quiet-zone") {
      design.quietZone = Number(target.value);
      getElement<HTMLOutputElement>("quiet-zone-value").textContent = `${design.quietZone}%`;
      persistDesign();
      updateAll();
      return;
    }

    if (target.matches("[data-color-text]")) {
      const kind = target.dataset.colorText as "foreground" | "background";
      const normalized = normalizeHex(target.value);
      target.classList.toggle("is-invalid", !normalized);
      if (normalized) {
        design[kind] = normalized;
        const picker = getElement<HTMLInputElement>(`${kind}-picker`);
        picker.value = normalized;
        persistDesign();
        updateAll();
      }
      return;
    }

    if (target.matches("[data-color-picker]")) {
      const kind = target.dataset.colorPicker as "foreground" | "background";
      design[kind] = target.value.toUpperCase();
      getElement<HTMLInputElement>(`${kind}-text`).value = design[kind];
      persistDesign();
      updateAll();
    }
  });

  app?.addEventListener("change", (event) => {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.field) {
      fields[target.dataset.field] = target.type === "checkbox" ? (target as HTMLInputElement).checked : target.value;
      if (target.dataset.field === "security") renderTypeFields();
      updateAll();
      return;
    }
    if (target.id === "error-level") {
      design.errorLevel = target.value as ErrorLevel;
      persistDesign();
      updateAll();
    }
  });
}

function renderTypeFields(): void {
  const templates: Record<QRDataType, string> = {
    url: `${inputField("url", "Website URL", "url", "https://example.org", true, "full")}`,
    text: `${textAreaField("text", "Text", "Type or paste the text to encode", true, "full")}`,
    email: `${inputField("email", "Email address", "email", "name@example.org", true)}${inputField("subject", "Subject", "text", "Optional")}${textAreaField("body", "Message", "Optional email body", false, "full")}`,
    phone: `${inputField("phone", "Phone number", "tel", "+1 555 123 4567", true, "full")}`,
    sms: `${inputField("smsPhone", "Phone number", "tel", "+1 555 123 4567", true)}${textAreaField("smsMessage", "Message", "Optional text message", false)}`,
    wifi: `${inputField("ssid", "Network name (SSID)", "text", "Network name", true)}${selectField("security", "Security", [{ value: "WPA", label: "WPA / WPA2 / WPA3" }, { value: "WEP", label: "WEP" }, { value: "nopass", label: "Open network" }])}${designWifiPassword()}${checkboxField("hidden", "Hidden network")}`,
    contact: `${inputField("contactName", "Full name", "text", "Name", true)}${inputField("organization", "Organization", "text", "Optional")}${inputField("contactPhone", "Phone", "tel", "Optional")}${inputField("contactEmail", "Email", "email", "Optional")}${inputField("contactUrl", "Website", "url", "Optional", false, "full")}`,
    location: `${inputField("latitude", "Latitude", "number", "35.93", true)}${inputField("longitude", "Longitude", "number", "−84.31", true)}${inputField("locationLabel", "Place label", "text", "Optional", false, "full")}`,
  };
  fieldsHost.innerHTML = templates[currentType];
}

function designWifiPassword(): string {
  if (fields.security === "nopass") return "";
  return inputField("password", "Password", "text", "Network password", true);
}

function updateAll(): void {
  const payload = createPayload(currentType, fields);
  const payloadBytes = new TextEncoder().encode(payload.value).length;
  const capacityError =
    !payload.error && payloadBytes > byteCapacity[design.errorLevel]
      ? `This content is too large for ${design.errorLevel} error correction. Keep it under about ${byteCapacity[design.errorLevel].toLocaleString()} bytes or choose a lower correction level.`
      : null;
  const validationError = payload.error ?? capacityError;
  const fallback = "https://www.ornl.gov";
  const qrData = validationError ? fallback : payload.value || fallback;
  previewQr?.update(buildOptions(480, qrData));

  getElement("payload-count").textContent = `${payload.value.length.toLocaleString()} character${payload.value.length === 1 ? "" : "s"}`;
  updateQuality(payload.value, validationError);
  document.querySelectorAll<HTMLButtonElement>("[data-export], #copy-png").forEach((button) => {
    button.disabled = Boolean(validationError);
  });
}

function createPreview(): void {
  previewQr = new QRCodeStyling(buildOptions(480, "https://www.ornl.gov"));
  previewQr.append(previewHost);
}

function buildOptions(size: number, data: string): Options {
  const margin = Math.round(size * (design.quietZone / 100));
  return {
    width: size,
    height: size,
    type: "svg",
    data,
    margin,
    qrOptions: { errorCorrectionLevel: design.errorLevel },
    dotsOptions: { color: design.foreground, type: design.dotStyle },
    backgroundOptions: { color: design.transparentBackground ? "transparent" : design.background },
    cornersSquareOptions: { color: design.foreground, type: design.eyeStyle },
    cornersDotOptions: { color: design.foreground, type: design.eyeStyle === "extra-rounded" ? "dot" : design.eyeStyle },
  };
}

function updateQuality(value: string, error: string | null): void {
  const host = getElement("quality-status");
  if (error) {
    host.className = "quality-status quality-status--error";
    host.innerHTML = `<span aria-hidden="true">!</span><div><strong>Needs adjustment</strong><p>${escapeHtml(error)}</p></div>`;
    return;
  }

  if (design.transparentBackground) {
    host.className = "quality-status quality-status--warning";
    host.innerHTML = '<span aria-hidden="true">!</span><div><strong>Transparent background</strong><p>Scan reliability depends on the final surface. Place the code over a light, solid area and test it before use.</p></div>';
    return;
  }

  const ratio = contrastRatio(design.foreground, design.background);
  const foregroundLuminance = luminance(design.foreground);
  const backgroundLuminance = luminance(design.background);
  const issues: string[] = [];
  if (ratio < 4.5) issues.push(`Contrast is only ${ratio.toFixed(1)}:1; use darker modules or a lighter background.`);
  if (foregroundLuminance >= backgroundLuminance) issues.push("The code should be darker than its background for reliable scanning.");
  if (design.quietZone < 3) issues.push("Increase the quiet zone to at least 3% for more reliable scanning.");
  if (value.length > 1200) issues.push("This is a dense code; export it large and test it with several devices.");

  if (issues.length) {
    host.className = "quality-status quality-status--warning";
    host.innerHTML = `<span aria-hidden="true">!</span><div><strong>Scan check</strong><p>${escapeHtml(issues[0])}</p></div>`;
    return;
  }

  host.className = "quality-status quality-status--good";
  host.innerHTML = `<span aria-hidden="true">✓</span><div><strong>Strong scan contrast</strong><p>${ratio.toFixed(1)}:1 contrast · ${design.errorLevel} error correction</p></div>`;
}

async function exportQr(extension: "png" | "svg", button: HTMLButtonElement): Promise<void> {
  const payload = createPayload(currentType, fields);
  if (payload.error) return;
  setBusy(button, true);
  try {
    const qr = new QRCodeStyling(buildOptions(design.size, payload.value));
    const raw = await qr.getRawData(extension);
    if (!raw) throw new Error("The QR file could not be created.");
    const blob = raw instanceof Blob ? raw : new Blob([raw], { type: extension === "svg" ? "image/svg+xml" : "image/png" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `qr-${currentType}-${design.size}px.${extension}`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`${extension.toUpperCase()} downloaded.`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "Export failed.", true);
  } finally {
    setBusy(button, false);
  }
}

async function copyPng(): Promise<void> {
  const button = getElement<HTMLButtonElement>("copy-png");
  const payload = createPayload(currentType, fields);
  if (payload.error) return;
  if (!("ClipboardItem" in window) || !navigator.clipboard?.write) {
    showToast("PNG copying is not supported in this browser. Download it instead.", true);
    return;
  }
  setBusy(button, true);
  try {
    const qr = new QRCodeStyling(buildOptions(design.size, payload.value));
    const raw = await qr.getRawData("png");
    if (!(raw instanceof Blob)) throw new Error("The PNG could not be created.");
    await navigator.clipboard.write([new ClipboardItem({ "image/png": raw })]);
    showToast("PNG copied to clipboard.");
  } catch {
    showToast("Could not copy the PNG. Download it instead.", true);
  } finally {
    setBusy(button, false);
  }
}

function loadDesign(): Partial<DesignState> {
  try {
    const stored = localStorage.getItem("qr-studio-design");
    return stored ? (JSON.parse(stored) as Partial<DesignState>) : {};
  } catch {
    return {};
  }
}

function persistDesign(): void {
  localStorage.setItem("qr-studio-design", JSON.stringify(design));
}

function syncAllDesignControls(): void {
  setSelected("[data-dot-style]", document.querySelector(`[data-dot-style="${design.dotStyle}"]`) as HTMLButtonElement);
  setSelected("[data-eye-style]", document.querySelector(`[data-eye-style="${design.eyeStyle}"]`) as HTMLButtonElement);
  syncColor("foreground", design.foreground);
  syncColor("background", design.background);
  syncTransparencyControls();
  getElement<HTMLInputElement>("output-size").value = String(design.size);
  getElement("output-size-value").textContent = `${design.size} px`;
  getElement<HTMLInputElement>("quiet-zone").value = String(design.quietZone);
  getElement("quiet-zone-value").textContent = `${design.quietZone}%`;
  getElement<HTMLSelectElement>("error-level").value = design.errorLevel;
}

function syncTransparencyControls(): void {
  const checkbox = getElement<HTMLInputElement>("transparent-background");
  const picker = getElement<HTMLInputElement>("background-picker");
  const textInput = getElement<HTMLInputElement>("background-text");
  const colorControl = getElement("background-control");
  const stage = getElement("preview-stage");
  const chip = getElement("transparent-chip");
  checkbox.checked = design.transparentBackground;
  picker.disabled = design.transparentBackground;
  textInput.disabled = design.transparentBackground;
  colorControl.classList.toggle("is-disabled", design.transparentBackground);
  stage.classList.toggle("is-transparent", design.transparentBackground);
  chip.hidden = !design.transparentBackground;
}

function syncColor(kind: "foreground" | "background", color: string): void {
  getElement<HTMLInputElement>(`${kind}-picker`).value = color;
  getElement<HTMLInputElement>(`${kind}-text`).value = color;
}

function setSelected(selector: string, selected: HTMLButtonElement): void {
  document.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
    const active = button === selected;
    button.classList.toggle("is-selected", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function normalizeHex(value: string): string | null {
  const candidate = value.trim().toUpperCase();
  const withHash = candidate.startsWith("#") ? candidate : `#${candidate}`;
  return /^#[0-9A-F]{6}$/.test(withHash) ? withHash : null;
}

function luminance(hex: string): number {
  const normalized = normalizeHex(hex) ?? "#373A36";
  const values = [1, 3, 5].map((index) => parseInt(normalized.slice(index, index + 2), 16) / 255);
  const linear = values.map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function setBusy(button: HTMLButtonElement, busy: boolean): void {
  button.disabled = busy;
  button.classList.toggle("is-busy", busy);
  button.setAttribute("aria-busy", String(busy));
}

let toastTimer = 0;
function showToast(message: string, isError = false): void {
  const toast = getElement("toast");
  toast.textContent = message;
  toast.className = `toast is-visible${isError ? " toast--error" : ""}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (toast.className = "toast"), 3200);
}

function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element as T;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

function valueOf(field: string): string {
  const value = fields[field];
  return typeof value === "string" ? escapeHtml(value) : "";
}

function inputField(field: string, label: string, type: string, placeholder: string, required = false, span = ""): string {
  const numeric = type === "number" ? ' step="any"' : "";
  return `<label class="field-label${span === "full" ? " field-label--full" : ""}">${label}${required ? '<span aria-hidden="true"> *</span>' : ""}<input data-field="${field}" type="${type}" value="${valueOf(field)}" placeholder="${placeholder}"${required ? " required" : ""}${numeric} /></label>`;
}

function textAreaField(field: string, label: string, placeholder: string, required = false, span = ""): string {
  return `<label class="field-label${span === "full" ? " field-label--full" : ""}">${label}${required ? '<span aria-hidden="true"> *</span>' : ""}<textarea data-field="${field}" placeholder="${placeholder}"${required ? " required" : ""}>${valueOf(field)}</textarea></label>`;
}

function selectField(field: string, label: string, options: Array<{ value: string; label: string }>): string {
  return `<label class="field-label">${label}<select data-field="${field}">${options.map((option) => `<option value="${option.value}"${fields[field] === option.value ? " selected" : ""}>${option.label}</option>`).join("")}</select></label>`;
}

function checkboxField(field: string, label: string): string {
  return `<label class="checkbox-label"><input data-field="${field}" type="checkbox"${fields[field] === true ? " checked" : ""} /><span aria-hidden="true"></span>${label}</label>`;
}

function visualOption(id: DotStyle, label: string, icon: string, selected: boolean): string {
  return `<button class="visual-option${selected ? " is-selected" : ""}" type="button" data-dot-style="${id}" aria-pressed="${selected}">${icon}<span>${label}</span></button>`;
}

function eyeOption(id: EyeStyle, label: string, selected: boolean): string {
  return `<button class="visual-option${selected ? " is-selected" : ""}" type="button" data-eye-style="${id}" aria-pressed="${selected}">${eyeIcon(id)}<span>${label}</span></button>`;
}

function dotIcon(style: DotStyle): string {
  return `<span class="module-icon module-icon--${style}" aria-hidden="true">${Array.from({ length: 16 }, () => "<i></i>").join("")}</span>`;
}

function eyeIcon(style: EyeStyle): string {
  return `<span class="eye-icon eye-icon--${style}" aria-hidden="true"><i></i></span>`;
}

function colorControl(kind: "foreground" | "background", label: string, color: string): string {
  const disabled = kind === "background" && design.transparentBackground;
  return `<div id="${kind}-control" class="color-control${disabled ? " is-disabled" : ""}"><label for="${kind}-text">${label}</label><div class="color-input"><input id="${kind}-picker" data-color-picker="${kind}" type="color" value="${color}" aria-label="Choose ${label.toLowerCase()}"${disabled ? " disabled" : ""} /><input id="${kind}-text" data-color-text="${kind}" type="text" value="${color}" maxlength="7" spellcheck="false" aria-label="${label} hex value"${disabled ? " disabled" : ""} /></div></div>`;
}
