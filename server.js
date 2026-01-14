const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

let browser;
let page;

async function getPage() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"]
    });

    const context = await browser.newContext();
    page = await context.newPage();
  }
  return page;
}

app.get("/health", (_, res) => {
  res.json({ ok: true });
});

app.post("/job", async (req, res) => {
  try {
    const { dryRun } = req.body;
    const page = await getPage();

    if (dryRun) {
      await page.goto("https://example.com", { timeout: 60000 });
      return res.json({ ok: true, message: "Dry run OK" });
    }

    res.json({ ok: true, message: "Worker alive" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});

app.listen(PORT, () =>
  console.log(`Worker running on port ${PORT}`)
);
