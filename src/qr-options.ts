import type { Options } from "qr-code-styling";
import qrcode from "qrcode-generator";

export type DotStyle = "dots" | "square" | "rounded";
export type EyeStyle = "square" | "extra-rounded" | "dot";
export type ErrorLevel = "L" | "M" | "Q" | "H";
export interface DesignState {
  dotStyle: DotStyle;
  eyeStyle: EyeStyle;
  foreground: string;
  background: string;
  transparentBackground: boolean;
  size: number;
  quietZone: number;
  errorLevel: ErrorLevel;
}

export const defaultDesign: DesignState = {
  dotStyle: "dots", eyeStyle: "extra-rounded", foreground: "#00662C",
  background: "#FFFFFF", transparentBackground: false, size: 1024,
  quietZone: 4, errorLevel: "Q",
};
export const byteCapacity: Record<ErrorLevel, number> = { L: 2953, M: 2331, Q: 1663, H: 1273 };

// qr-code-styling 1.9.2's embedded encoder uses one byte per JS character.
// Feed UTF-8 bytes as a binary string, otherwise non-ASCII content is corrupted.
export function utf8Binary(value: string): string {
  return String.fromCharCode(...new TextEncoder().encode(value));
}

export function moduleMargin(data: string, size: number, errorLevel: ErrorLevel, quietModules: number): number {
  const matrix = qrcode(0, errorLevel);
  matrix.addData(utf8Binary(data), "Byte");
  matrix.make();
  return Math.ceil(size * quietModules / (matrix.getModuleCount() + 2 * quietModules));
}

export function buildQrOptions(design: DesignState, size: number, data: string, margin = Math.round(size * design.quietZone / 100)): Options {
  const minimumMargin = moduleMargin(data, size, design.errorLevel, 4);
  return {
    width: size, height: size, type: "svg", data: utf8Binary(data), margin: Math.max(margin, minimumMargin),
    qrOptions: { mode: "Byte", errorCorrectionLevel: design.errorLevel },
    dotsOptions: { color: design.foreground, type: design.dotStyle },
    backgroundOptions: { color: design.transparentBackground ? "transparent" : design.background },
    cornersSquareOptions: { color: design.foreground, type: design.eyeStyle },
    cornersDotOptions: { color: design.foreground, type: design.eyeStyle === "extra-rounded" ? "dot" : design.eyeStyle },
  };
}
