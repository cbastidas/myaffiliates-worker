const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// Helper to determine the state file path
const getStatePath = (instance) => {
  return instance === "Realm" ? "storageState-Realm.json" : "storageState-Throne.json";
};

// Function to refresh the session and save updated cookies
async function refreshSession(instance) {
  const stateFile = getStatePath(instance);
  
  if (!fs.existsSync(stateFile)) {
    throw new Error(`State file ${stateFile} not found. Perform manual login first.`);
  }

  const browser = await chromium.launch({ 
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"] 
  });
  
  const context = await browser.newContext({ storageState: stateFile });
  const page = await context.newPage();

  const url = instance === "Realm"
    ? "https://admin2.neataffiliates.com/index.php"
    : "https://admin.throneneataffiliates.com/index.php";

  try {
    console.log(`Refreshing session for ${instance}...`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // Check if we were redirected to login (session died)
    if (page.url().includes("login.php")) {
      throw new Error("Session expired. Manual re-auth required.");
    }

    // Save the fresh state back to the file
    await context.storageState({ path: stateFile });
    console.log(`Session state updated successfully for ${instance} ✅`);
    return true;
  } finally {
    await browser.close();
  }
}

// ENDPOINT: Keep-alive (Call this from n8n every 10 mins)
app.post("/refresh", async (req, res) => {
  const { instance } = req.body;
  if (!instance) return res.status(400).json({ error: "Missing instance" });

  try {
    await refreshSession(instance);
    res.json({ ok: true, status: "Refreshed" });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// ENDPOINT: Execute Search & Replace Job
app.post("/job", async (req, res) => {
  const { instance, blockedDomain, replacementDomain } = req.body;
  const stateFile = getStatePath(instance);

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const context = await browser.newContext({ storageState: stateFile });
  const page = await context.newPage();

  const url = instance === "Realm"
    ? "https://admin2.neataffiliates.com/landing-pages/search-and-replace"
    : "https://admin.throneneataffiliates.com/landing-pages/search-and-replace";

  try {
    await page.goto(url, { waitUntil: "networkidle" });
    
    // --- ADD YOUR PLAYWRIGHT SELECTORS HERE ---
    // Example:
    // await page.fill('#search_input', blockedDomain);
    // await page.fill('#replace_input', replacementDomain);
    // await page.click('#submit_button');

    res.json({ ok: true, message: "Job processed", domain: replacementDomain });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  } finally {
    await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Worker running on port ${PORT}`));