import { CdxError } from "./errors.js";

const colors = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m"
};

function useColor(): boolean {
  return process.stdout.isTTY && !process.env.NO_COLOR;
}

function paint(text: string, code: string): string {
  return useColor() ? `${code}${text}${colors.reset}` : text;
}

export function bold(text: string): string {
  return paint(text, colors.bold);
}

export function muted(text: string): string {
  return paint(text, colors.dim);
}

export function success(text: string): string {
  return paint(text, colors.green);
}

export function warn(text: string): string {
  return paint(text, colors.yellow);
}

export function danger(text: string): string {
  return paint(text, colors.red);
}

export function info(text: string): string {
  return paint(text, colors.cyan);
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printKeyValue(label: string, value: string): void {
  console.log(`${muted(label.padEnd(14, "."))} ${value}`);
}

export function printError(error: unknown): void {
  if (error instanceof CdxError) {
    console.error(`${danger("Error:")} ${error.message}`);
    process.exit(error.exitCode);
  }
  if (error instanceof Error) {
    console.error(`${danger("Error:")} ${error.message}`);
    process.exit(1);
  }
  console.error(`${danger("Error:")} ${String(error)}`);
  process.exit(1);
}
