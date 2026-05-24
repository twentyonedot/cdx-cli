import fs from "node:fs";

try {
  fs.chmodSync("dist/cli.js", 0o755);
} catch {
  // Windows does not need POSIX executable bits.
}
