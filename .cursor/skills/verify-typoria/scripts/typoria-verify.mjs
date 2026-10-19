#!/usr/bin/env node
// AudioContext objects stay inside the page. The probe records instances the app constructs.
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../../../..");
const args = process.argv.slice(2);
const cmd = args[0];

function flag(name, fallback = "") {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || args[index + 1] == null) return fallback;
  return args[index + 1];
}

function sessionPaths(sessionFile) {
  return {
    sessionFile,
    errorFile: `${sessionFile}.error`,
    logFile: `${sessionFile}.log`,
    requestsFile: `${sessionFile}.requests.json`,
    inbox: `${sessionFile}.inbox`,
    outbox: `${sessionFile}.outbox`,
  };
}

async function readIfPresent(file) {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if (error && error.code === "ENOENT") return "";
    throw error;
  }
}

async function waitForSession(sessionFile, errorFile, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const error = await readIfPresent(errorFile);
    if (error.trim()) throw new Error(error);
    const text = await readIfPresent(sessionFile);
    if (text.trim()) return text;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`timed out waiting for ${sessionFile}`);
}

async function serve() {
  const port = flag("port", "5173");
  const runDir = flag("run-dir");
  if (!runDir) throw new Error("pass --run-dir");
  await mkdir(runDir, { recursive: true });
  const logPath = path.join(runDir, "server.log");
  const logFd = openSync(logPath, "a");
  const child = spawn("pnpm", ["dev", "--host", "127.0.0.1", "--port", port, "--strictPort"], {
    cwd: repoRoot,
    detached: true,
    stdio: ["ignore", logFd, logFd],
  });
  child.unref();
  await writeFile(path.join(runDir, "server.pid"), `${child.pid}\n`);
  const url = `http://127.0.0.1:${port}/`;
  const started = Date.now();
  let lastError = "no response";
  while (Date.now() - started < 60_000) {
    try {
      const response = await fetch(url);
      const body = await response.text();
      if (response.ok && body.includes('id="root"') && body.includes("Typoria")) {
        console.log(JSON.stringify({ url, pid: child.pid, log: logPath }));
        process.exit(0);
      }
      lastError = `status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`dev server did not become ready: ${lastError}`);
}

async function doctor() {
  const url = flag("url");
  if (!url) throw new Error("pass --url");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.locator("main").waitFor({ state: "visible", timeout: 20_000 });
  const playCount = await page.getByRole("button", { name: "PLAY" }).count();
  const title = await page.title();
  const links = await page.evaluate(() => ({
    icon: document.querySelector("link[rel='icon']")?.getAttribute("href") ?? null,
    manifest: document.querySelector("link[rel='manifest']")?.getAttribute("href") ?? null,
  }));
  await browser.close();
  const report = {
    url,
    status: response?.status() ?? null,
    title,
    playVisible: playCount > 0,
    icon: links.icon,
    manifest: links.manifest,
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 200 || !title.includes("Typoria") || !report.playVisible) {
    process.exitCode = 1;
  }
}

async function cleanup() {
  const runDir = flag("run-dir");
  if (!runDir) throw new Error("pass --run-dir");
  const pidFile = path.join(runDir, "server.pid");
  const pidText = await readIfPresent(pidFile);
  const pid = Number(pidText.trim());
  if (pid > 0) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        // already gone
      }
    }
  }
  await rm(runDir, { recursive: true, force: true });
  console.log(JSON.stringify({ removed: runDir }));
}

const audioProbe = () => {
  const Original = window.AudioContext || window.webkitAudioContext;
  window.__audioContexts = [];
  if (!Original) return;
  const Wrapped = class extends Original {
    constructor(...args) {
      super(...args);
      window.__audioContexts.push(this);
    }
  };
  window.AudioContext = Wrapped;
  window.webkitAudioContext = Wrapped;
};

function target(page, command) {
  if (command.testid) return page.getByTestId(command.testid);
  if (!command.role || !command.name) throw new Error("pass --role and --name, or --testid");
  return page.getByRole(command.role, { name: command.name });
}

async function runCommand(page, command, paths) {
  if (command.op === "click") {
    await target(page, command).click({ timeout: 10_000 });
    return { clicked: command.name || command.testid };
  }
  if (command.op === "see") {
    await target(page, command).first().waitFor({ state: "visible", timeout: 10_000 });
    return { visible: command.name || command.testid };
  }
  if (command.op === "text") {
    await page.getByText(command.text).first().waitFor({ state: "visible", timeout: 10_000 });
    return { visible: command.text };
  }
  if (command.op === "screenshot") {
    await mkdir(path.dirname(command.path), { recursive: true });
    await page.screenshot({ path: command.path });
    return { screenshot: command.path };
  }
  if (command.op === "attr") {
    const value = await target(page, command).first().getAttribute(command.attr);
    return { testid: command.testid, attr: command.attr, value };
  }
  if (command.op === "audio") {
    const contexts = await page.evaluate(() =>
      (window.__audioContexts ?? []).map((ctx) => ({
        state: ctx.state,
        currentTime: ctx.currentTime,
      })),
    );
    return { contexts };
  }
  if (command.op === "sw") {
    const serviceWorker = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return { error: "unsupported" };
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 8_000)),
      ]);
      if (!registration) return { error: "timeout" };
      return { scope: registration.scope, state: registration.active?.state ?? null };
    });
    return serviceWorker;
  }
  if (command.op === "manifest") {
    return page.evaluate(async () => {
      const link = document.querySelector("link[rel=manifest]");
      if (!link) return { error: "missing link" };
      const data = await (await fetch(link.href)).json();
      return {
        href: link.href,
        start_url: data.start_url,
        scope: data.scope,
        display: data.display,
        icons: (data.icons ?? []).map((icon) => ({
          src: icon.src,
          sizes: icon.sizes,
          purpose: icon.purpose ?? "",
        })),
      };
    });
  }
  if (command.op === "favicon") {
    const dom = await page.evaluate(() => {
      const icon = document.querySelector("link[rel='icon']");
      return {
        href: icon?.getAttribute("href") ?? null,
        type: icon?.getAttribute("type") ?? null,
        sizes: icon?.getAttribute("sizes") ?? null,
      };
    });
    const pageUrl = new URL(page.url());
    const iconUrl = dom.href ? new URL(dom.href, pageUrl).href : null;
    const iconResponse = iconUrl ? await page.request.get(iconUrl) : null;
    const faviconIco = await page.request.get(`${pageUrl.origin}/favicon.ico`);
    const requestsText = await readIfPresent(paths.requestsFile);
    const requests = requestsText ? JSON.parse(requestsText) : [];
    return {
      link: dom,
      iconUrl,
      iconStatus: iconResponse?.status() ?? null,
      originFaviconStatus: faviconIco.status(),
      requests,
    };
  }
  throw new Error(`unknown op ${command.op}`);
}

async function sessionDaemon(url, sessionFile) {
  const paths = sessionPaths(sessionFile);
  let browser;
  try {
    const headed = process.env.HEADED === "1";
    browser = await chromium.launch({
      channel: "chrome",
      headless: !headed,
      args: [
        "--no-first-run",
        "--no-default-browser-check",
        "--window-position=0,0",
        "--window-size=1280,800",
      ],
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(audioProbe);
    const requests = [];
    const page = await context.newPage();
    page.on("response", (response) => {
      const responseUrl = response.url();
      if (!/favicon|icon-|manifest|\.webmanifest/.test(responseUrl)) return;
      requests.push({
        url: responseUrl,
        status: response.status(),
        contentType: response.headers()["content-type"] ?? "",
      });
      void writeFile(paths.requestsFile, JSON.stringify(requests, null, 2));
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator("main, #root").first().waitFor({ state: "visible", timeout: 20_000 });
    await mkdir(paths.inbox, { recursive: true });
    await mkdir(paths.outbox, { recursive: true });
    await writeFile(sessionFile, JSON.stringify({ pid: process.pid, url }, null, 2));
    const seen = new Set();
    while (browser.isConnected()) {
      const names = await readdir(paths.inbox);
      for (const name of names.sort()) {
        if (seen.has(name)) continue;
        seen.add(name);
        const command = JSON.parse(await readFile(path.join(paths.inbox, name), "utf8"));
        let result;
        try {
          if (command.op === "stop") {
            result = { exitCode: 0, output: { stopped: sessionFile } };
            await writeFile(path.join(paths.outbox, name), JSON.stringify(result));
            await browser.close();
            return;
          }
          const output = await runCommand(page, command, paths);
          const failed = Boolean(output && output.error);
          result = { exitCode: failed ? 1 : 0, output };
        } catch (error) {
          result = {
            exitCode: 1,
            output: { error: error instanceof Error ? error.message : String(error) },
          };
        }
        await writeFile(path.join(paths.outbox, name), JSON.stringify(result));
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  } catch (error) {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    await browser?.close().catch(() => {});
    await writeFile(paths.errorFile, message);
    process.exit(1);
  }
}

async function sessionStart() {
  const url = flag("url");
  const sessionFile = flag("session");
  if (!url || !sessionFile) throw new Error("pass --url and --session");
  const paths = sessionPaths(sessionFile);
  await mkdir(path.dirname(sessionFile), { recursive: true });
  await rm(paths.errorFile, { force: true });
  await rm(sessionFile, { force: true });

  if (process.env.TYPORIA_VERIFY_DAEMON !== "1") {
    const child = spawn(process.execPath, process.argv.slice(1), {
      cwd: repoRoot,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, TYPORIA_VERIFY_DAEMON: "1" },
    });
    child.unref();
    const text = await waitForSession(sessionFile, paths.errorFile, 45_000);
    console.log(text);
    process.exit(0);
  }

  await sessionDaemon(url, sessionFile);
}

async function sessionSend(op, extra = {}) {
  const sessionFile = flag("session");
  if (!sessionFile) throw new Error("pass --session");
  const paths = sessionPaths(sessionFile);
  const id = `${Date.now()}-${randomUUID()}.json`;
  const command = {
    op,
    role: flag("role"),
    name: flag("name"),
    testid: flag("testid"),
    text: flag("text"),
    path: flag("path"),
    attr: flag("attr"),
    ...extra,
  };
  await writeFile(path.join(paths.inbox, id), JSON.stringify(command));
  const started = Date.now();
  while (Date.now() - started < 20_000) {
    const text = await readIfPresent(path.join(paths.outbox, id));
    if (text.trim()) {
      const result = JSON.parse(text);
      console.log(JSON.stringify(result.output, null, 2));
      if (result.exitCode !== 0) process.exitCode = result.exitCode;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${op}`);
}

async function sessionStop() {
  const sessionFile = flag("session");
  await sessionSend("stop");
  const paths = sessionPaths(sessionFile);
  const session = JSON.parse((await readIfPresent(sessionFile)) || "{}");
  if (session.pid) {
    try {
      process.kill(session.pid, "SIGTERM");
    } catch {
      // daemon exits after close
    }
  }
  await rm(paths.inbox, { recursive: true, force: true });
  await rm(paths.outbox, { recursive: true, force: true });
  await rm(sessionFile, { force: true });
  await rm(paths.requestsFile, { force: true });
}

async function main() {
  if (cmd === "serve") return serve();
  if (cmd === "doctor") return doctor();
  if (cmd === "cleanup") return cleanup();
  if (cmd === "session-start") return sessionStart();
  if (cmd === "session-stop") return sessionStop();
  if (cmd === "session-click") return sessionSend("click");
  if (cmd === "session-see") return sessionSend("see");
  if (cmd === "session-text") return sessionSend("text");
  if (cmd === "session-screenshot") return sessionSend("screenshot");
  if (cmd === "session-attr") return sessionSend("attr");
  if (cmd === "session-audio") return sessionSend("audio");
  if (cmd === "session-sw") return sessionSend("sw");
  if (cmd === "session-manifest") return sessionSend("manifest");
  if (cmd === "session-favicon") return sessionSend("favicon");
  throw new Error(
    "usage: typoria-verify.mjs serve|doctor|cleanup|session-start|session-stop|session-click|session-see|session-text|session-screenshot|session-attr|session-audio|session-sw|session-manifest|session-favicon",
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
