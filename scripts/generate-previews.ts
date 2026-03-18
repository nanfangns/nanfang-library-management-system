import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const ROOT_DIR = process.cwd();
const PREVIEW_DIR = join(ROOT_DIR, "public", "previews");
const PORT = 3006;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const npmCommand = "npm";
const browserCandidates = [
  process.env.PREVIEW_BROWSER_PATH,
  "D:\\Chrome\\App\\chrome.exe",
].filter((value): value is string => Boolean(value));
const localPreviewEnv = Object.fromEntries(
  Object.entries({
    ...process.env,
    DATABASE_DRIVER: "sqlite",
    DATABASE_URL: "",
    NEXT_PUBLIC_APP_URL: BASE_URL,
    NEXT_TELEMETRY_DISABLED: "1",
  }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
) as NodeJS.ProcessEnv;
const previewPages = [
  { path: "/", file: "home-hero.png" },
  { path: "/books", file: "catalog-overview.png" },
  { path: "/books/import", file: "import-workflow.png" },
  { path: "/books/new", file: "new-book-workflow.png" },
] as const;
const gifFrames = [
  { file: "home-hero.png", delay: 900 },
  { file: "catalog-overview.png", delay: 1000 },
  { file: "import-workflow.png", delay: 900 },
  { file: "new-book-workflow.png", delay: 1000 },
] as const;

function getBrowserPath() {
  return browserCandidates.find((candidate) => existsSync(candidate)) ?? null;
}

function runCommand(args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : npmCommand,
      process.platform === "win32" ? ["/d", "/s", "/c", `${npmCommand} ${args.join(" ")}`] : args,
      {
      cwd: ROOT_DIR,
      env,
      stdio: "inherit",
      },
    );

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Command "${npmCommand} ${args.join(" ")}" exited with code ${code}.`));
    });
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(BASE_URL, {
        cache: "no-store",
      });

      if (response.ok) {
        return;
      }
    } catch {
      // Ignore boot-time failures and retry.
    }

    await delay(1000);
  }

  throw new Error("Timed out waiting for the local preview server to start.");
}

function stopServer(server: ReturnType<typeof spawn>) {
  if (server.killed) {
    return;
  }

  server.kill("SIGTERM");
}

function buildGif() {
  const gif = GIFEncoder();

  for (const frame of gifFrames) {
    const imageBuffer = readFileSync(join(PREVIEW_DIR, frame.file));
    const png = PNG.sync.read(imageBuffer);
    const palette = quantize(png.data, 256);
    const indexedBitmap = applyPalette(png.data, palette);

    gif.writeFrame(indexedBitmap, png.width, png.height, {
      delay: frame.delay,
      palette,
      repeat: 0,
    });
  }

  gif.finish();
  writeFileSync(join(PREVIEW_DIR, "flow-demo.gif"), Buffer.from(gif.bytesView()));
}

async function main() {
  mkdirSync(PREVIEW_DIR, { recursive: true });

  await runCommand(["run", "db:reset"], localPreviewEnv);

  const server = spawn(
    process.platform === "win32" ? process.env.ComSpec ?? "cmd.exe" : npmCommand,
    process.platform === "win32"
      ? ["/d", "/s", "/c", `${npmCommand} run dev -- --port ${PORT}`]
      : ["run", "dev", "--", "--port", String(PORT)],
    {
      cwd: ROOT_DIR,
      env: localPreviewEnv,
      stdio: "ignore",
    },
  );

  try {
    await waitForServer();

    const browserPath = getBrowserPath();
    let browser;

    try {
      browser = browserPath
        ? await chromium.launch({ executablePath: browserPath, headless: true })
        : await chromium.launch({ headless: true });
    } catch {
      browser = await chromium.launch({ headless: true });
    }

    try {
      const page = await browser.newPage({
        viewport: {
          width: 1600,
          height: 1000,
        },
      });

      for (const previewPage of previewPages) {
        await page.goto(`${BASE_URL}${previewPage.path}`, {
          waitUntil: "networkidle",
        });
        await page.screenshot({
          animations: "disabled",
          caret: "hide",
          path: join(PREVIEW_DIR, previewPage.file),
        });
      }
    } finally {
      await browser.close();
    }
  } finally {
    stopServer(server);
  }

  buildGif();
  copyFileSync(join(PREVIEW_DIR, "home-hero.png"), join(PREVIEW_DIR, "social-preview.png"));

  console.log("预览资源已生成：");
  for (const previewPage of previewPages) {
    console.log(`- public/previews/${previewPage.file}`);
  }
  console.log("- public/previews/flow-demo.gif");
  console.log("- public/previews/social-preview.png");
}

main().catch((error) => {
  console.error("生成预览资源失败。");
  console.error(error);
  process.exit(1);
});
