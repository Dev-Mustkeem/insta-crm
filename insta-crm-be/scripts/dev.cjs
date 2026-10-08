const { spawn } = require("node:child_process");

const typescriptCli = require.resolve("typescript/bin/tsc");
const children = new Set();
let shuttingDown = false;

/**
 * Starts a development child process without invoking a command shell.
 *
 * @param {string} command - Executable path.
 * @param {string[]} args - Arguments passed directly to the executable.
 * @returns {import("node:child_process").ChildProcess} The running child process.
 * @throws {Error} When the child process cannot be spawned.
 */
function start(command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: "inherit",
  });
  children.add(child);
  child.once("error", (error) => {
    console.error(error);
    stop(1);
  });
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown && code !== 0 && signal === null) stop(code ?? 1);
  });
  return child;
}

/**
 * Stops all development child processes and exits with the requested status.
 *
 * @param {number} exitCode - Process exit status.
 * @returns {void}
 */
function stop(exitCode) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = exitCode;
}

process.once("SIGINT", () => stop(0));
process.once("SIGTERM", () => stop(0));

start(process.execPath, [typescriptCli, "--watch", "--preserveWatchOutput"]);
start(process.execPath, ["--watch", "dist/main.js"]);
