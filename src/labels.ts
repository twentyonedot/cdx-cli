import { CdxError } from "./errors.js";

const RESERVED_LABELS = new Set([
  "add",
  "accounts",
  "autoswitch",
  "config",
  "doctor",
  "help",
  "refresh",
  "remove",
  "usage",
  "use"
]);

export function validateLabel(label: string): string {
  const normalized = label.trim();
  if (normalized.length < 1 || normalized.length > 64) {
    throw new CdxError("invalid-label", "Labels must be 1-64 characters long.");
  }
  if (normalized.includes("/") || normalized.includes("\\") || normalized.includes("..")) {
    throw new CdxError("invalid-label", "Labels cannot contain path separators or parent-directory segments.");
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9@+._-]*$/.test(normalized)) {
    throw new CdxError("invalid-label", "Labels may contain letters, numbers, @, plus signs, dots, underscores, and hyphens, and must start with a letter or number.");
  }
  if (RESERVED_LABELS.has(normalized.toLowerCase())) {
    throw new CdxError("invalid-label", `Label "${normalized}" is reserved.`);
  }
  return normalized;
}
