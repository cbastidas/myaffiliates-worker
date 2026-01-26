const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// Helper to get the correct state file
const getStatePath = (instance) => {
  return instance === "Realm" ? "storageState-Realm.json" : "storageState-Throne.json";
};

// ENDPOINT: Debug Status
app.get("/status", async (req, res) => {
  const instances = ["Throne", "Realm"];
  const report = {};

  for (const instance of instances) {
    const stateFile = getStatePath(instance);
    const fileExists = fs.existsSync(stateFile);
    let sessionActive = false;

    if (fileExists) {
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
      try {
        const context = await browser.newContext({ storageState: stateFile });
        const page = await context.newPage();
        const url = instance === "Realm" ? "https://admin2.neataffiliates.com/dashboard" : "https://admin.throneneataffiliates.com/dashboard";
        await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
        sessionActive = !page.url().includes("login.php");
      } catch (err) {
        console.error(`Status check failed for ${instance}:`, err.message);
      } finally {
        if (browser) await browser.close();
      }
    }
    report[instance] = { file_exists: fileExists, session_active: sessionActive };
  }
  res.json({ status: "ONLINE", results: report });
});

// ENDPOINT: Session Heartbeat (Refresh)
app.post("/refresh", async (req, res) => {
  const { instance } = req.body;
  if (!instance) return res.status(400).json({ error: "Missing instance" });

  const stateFile = getStatePath(instance);
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

  try {
    const context = await browser.newContext({ storageState: stateFile });
    const page = await context.newPage();
    const url = instance === "Realm" ? "https://admin2.neataffiliates.com/dashboard" : "https://admin.throneneataffiliates.com/dashboard";

    await page.goto(url, { waitUntil: "networkidle" });
    if (page.url().includes("login.php")) throw new Error("Session expired");

    await context.storageState({ path: stateFile });
    console.log(`[DEBUG] [${instance}] Cookies updated on disk.`);
    res.json({ ok: true, message: `Session for ${instance} refreshed.` });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

// ENDPOINT: Execute Search & Replace Job
app.post("/job", async (req, res) => {
  const { instance, blockedDomain, replacementDomain } = req.body;
  const stateFile = getStatePath(instance);
  const trace = [];

  const addLog = (msg) => {
    const log = `[${new Date().toISOString().split('T')[1].split('.')[0]}] [${instance}] ${msg}`;
    console.log(log);
    trace.push(log);
  };

  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  
  try {
    addLog("DEBUG: Starting Job...");
    const context = await browser.newContext({ storageState: stateFile });
    const page = await context.newPage();
    
    const baseUrl = instance === "Realm" ? "https://admin2.neataffiliates.com" : "https://admin.throneneataffiliates.com";
    
    addLog("DEBUG: Navigating to Search & Replace page...");
    await page.goto(`${baseUrl}/landing-pages/search-and-replace`, { waitUntil: "networkidle" });
    
    if (page.url().includes("login.php")) {
      addLog("DEBUG: ERROR - Redirected to login. Session dead.");
      return res.status(401).json({ ok: false, error: "Auth failed", debug: trace });
    }

    addLog("DEBUG: Page loaded. Filling form...");
    const searchInput = "#search_and_replace_dataSearch";
    const replaceInput = "#search_and_replace_dataReplace";
    
    await page.waitForSelector(searchInput, { timeout: 10000 });
    await page.fill(searchInput, blockedDomain);
    await page.fill(replaceInput, replacementDomain);

    addLog(`DEBUG: Domain injected: ${blockedDomain} -> ${replacementDomain}`);
    addLog("DEBUG: Clicking Preview button...");

    await Promise.all([
      page.click('input[type="submit"].btn-success'),
      page.waitForNavigation({ waitUntil: "networkidle" })
    ]);

    addLog("DEBUG: Job Finished Successfully.");
    res.json({ ok: true, instance: instance, trace: trace });

  } catch (error) {
    addLog(`DEBUG: EXCEPTION - ${error.message}`);
    res.status(500).json({ ok: false, error: error.message, debug: trace });
  } finally {
    if (browser) await browser.close();
  }
});

// Start the server
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Worker 24/7 active on port ${PORT} ✅`);
});