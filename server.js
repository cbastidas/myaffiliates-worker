const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// TODO: replace with your real URLs
const MYA_LOGIN_URL = "https://admin.throneneataffiliates.com/index.php";
const MYA_DASHBOARD_URL = "https://admin.throneneataffiliates.com/landing-pages/search-and-replace";

let browser;
let context;
let page;

async function getPage() {
  if (!browser) {
    // Railway must be headless
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });

    // Load saved session (cookies/localStorage)
    if (!fs.existsSync("storageState.json")) {
      throw new Error("storageState.json not found in project root.");
    }

    context = await browser.newContext({
      storageState: "storageState.json"
    });

    page = await context.newPage();
  }
  return page;
}

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

/**
 * Quick check: go to dashboard and confirm we are NOT on login page
 */
app.get("/check-session", async (_req, res) => {
  try {
    const page = await getPage();
    await page.goto(MYA_DASHBOARD_URL, { waitUntil: "domcontentloaded", timeout: 60000 });

    const currentUrl = page.url();

    // naive check: if redirected to login, currentUrl will resemble login
    const looksLoggedOut = currentUrl.includes("login") || currentUrl.includes("signin");

    res.json({
      ok: !looksLoggedOut,
      currentUrl,
      note: looksLoggedOut
        ? "Looks like you were redirected to login (session invalid/expired)."
        : "Looks logged-in (not redirected to login)."
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.post("/job", async (req, res) => {
  try {
    const page = await getPage();
    res.json({ ok: true, message: "Worker ready", currentUrl: page.url(), input: req.body });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, () => {
  console.log(`Worker running on port ${PORT}`);
});
