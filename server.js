const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// Helper to determine the state file path based on the instance name
const getStatePath = (instance) => {
  return instance === "Realm" ? "storageState-Realm.json" : "storageState-Throne.json";
};

// Function to refresh the session and overwrite the JSON with fresh cookies
async function refreshSession(instance) {
  const stateFile = getStatePath(instance);
  
  if (!fs.existsSync(stateFile)) {
    throw new Error(`State file ${stateFile} not found. Run auth-save.js locally first.`);
  }

  const browser = await chromium.launch({ 
    headless: true, 
    args: ["--no-sandbox", "--disable-dev-shm-usage"] 
  });
  
  const context = await browser.newContext({ storageState: stateFile });
  const page = await context.newPage();

  const url = instance === "Realm"
    ? "https://admin2.neataffiliates.com/dashboard"
    : "https://admin.throneneataffiliates.com/dashboard";

  try {
    console.log(`Refreshing session for ${instance}...`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });

    // If redirected to login, the session is dead
    if (page.url().includes("login.php")) {
      throw new Error("Session expired. Manual re-authentication required.");
    }

    // CRITICAL: Save the state back to the file to update cookie expiration
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
    res.json({ ok: true, status: "Refreshed and Saved" });
  } catch (error) {
    console.error("REFRESH_ERROR:", error.message);
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
    
    // Automation logic for MyAffiliates Search and Replace form goes here
    // Example: 
    // await page.fill('input[name="search"]', blockedDomain);
    // await page.fill('input[name="replace"]', replacementDomain);

    res.json({ ok: true, message: "Job processed", domain: replacementDomain });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  } finally {
    await browser.close();
  }
});

const PORT = process.env.PORT || 8080; 

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Worker is up on port ${PORT} and ready for n8n! ✅`);
});