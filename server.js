const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let browser;
let context;
let page;

async function getPage(headless = true) {
  if (!browser) {
    browser = await chromium.launch({
      headless,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });

    context = await browser.newContext();
    page = await context.newPage();
  }
  return page;
}

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

/**
 * STEP 3 — LOGIN MODE
 */
app.get("/login", async (_req, res) => {
  try {
    // ⚠️ open browser NOT headless for login
    page = await getPage(false);

    await page.goto("https://admin.throneneataffiliates.com/index.php", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    res.json({
      ok: true,
      message:
        "Login page opened. Complete login + captcha manually, then come back here."
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post("/job", async (req, res) => {
  try {
    const page = await getPage(true);

    // For now, just confirm session exists
    const url = page.url();

    res.json({
      ok: true,
      message: "Worker alive",
      currentUrl: url
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, () =>
  console.log(`Worker running on port ${PORT}`)
);
