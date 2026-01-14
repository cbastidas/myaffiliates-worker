const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

let browser = null;
let context = null;
let page = null;

async function getPage() {
  if (page) return page;

  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  context = await browser.newContext();
  page = await context.newPage();
  return page;
}

app.get("/health", (req, res) => {
  res.json({ ok: true, browserReady: !!page });
});

app.post("/job", async (req, res) => {
  try {
    const { instance, blockedDomain, replacementDomain } = req.body || {};

    if (!instance || !blockedDomain || !replacementDomain) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: instance, blockedDomain, replacementDomain",
      });
    }

    const p = await getPage();

    // ✅ Updated URLs
    const url =
      instance === "Realm"
        ? "https://admin2.neataffiliates.com/landing-pages/search-and-replace"
        : "https://admin.throneneataffiliates.com/landing-pages/search-and-replace";

    await p.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    return res.json({
      ok: true,
      step: "prepared",
      instance,
      currentUrl: p.url(),
      blockedDomain,
      replacementDomain,
    });
  } catch (e) {
    console.error("JOB_ERROR:", e);
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

process.on("unhandledRejection", (err) => console.error("UNHANDLED_REJECTION:", err));
process.on("uncaughtException", (err) => console.error("UNCAUGHT_EXCEPTION:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
