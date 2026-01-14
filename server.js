const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 3000;

// IMPORTANT: Use a persistent directory (Render Disk)
const USER_DATA_DIR = process.env.USER_DATA_DIR || path.join(process.cwd(), "browser-profile");

// Optional: keep one browser context alive for multiple requests
let contextPromise = null;

async function getContext() {
  if (!contextPromise) {
    contextPromise = (async () => {
      fs.mkdirSync(USER_DATA_DIR, { recursive: true });

      const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: true, // set false only for local debugging; in Render keep true
        args: [
          "--no-sandbox",
          "--disable-dev-shm-usage"
        ],
        viewport: { width: 1280, height: 720 }
      });

      // Create a single page that we can reuse
      const pages = context.pages();
      const page = pages.length ? pages[0] : await context.newPage();

      return { context, page };
    })();
  }
  return contextPromise;
}

app.get("/health", async (_req, res) => {
  res.json({ ok: true });
});

/**
 * POST /job
 * body: { instance: "Throne"|"Realm", blockedDomain: "...", replacementDomain: "...", dryRun?: true }
 */
app.post("/job", async (req, res) => {
  try {
    const { instance, blockedDomain, replacementDomain, dryRun } = req.body || {};

    if (!instance || !blockedDomain || !replacementDomain) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: instance, blockedDomain, replacementDomain"
      });
    }

    const { page } = await getContext();

    // TODO: In Step 2 we will implement the real navigation + clicks.
    // For now, just prove the worker runs and can open a page.
    if (dryRun) {
      await page.goto("https://example.com", { waitUntil: "domcontentloaded", timeout: 60000 });
      return res.json({ ok: true, step: "dryRun", instance, blockedDomain, replacementDomain });
    }

    // Placeholder for next step
    return res.json({
      ok: true,
      message: "Worker is running. Next step is to implement MyAffiliates automation.",
      instance,
      blockedDomain,
      replacementDomain
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Worker listening on port ${PORT}`);
});
