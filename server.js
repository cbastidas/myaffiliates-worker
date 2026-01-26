const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const getStatePath = (instance) => {
  return instance === "Realm" ? "storageState-Realm.json" : "storageState-Throne.json";
};

// ENDPOINT: Status Check
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
      } catch (err) { console.error(err); } finally { if (browser) await browser.close(); }
    }
    report[instance] = { file_exists: fileExists, session_active: sessionActive };
  }
  res.json({ status: "ONLINE", results: report });
});

// ENDPOINT: Session Refresh
app.post("/refresh", async (req, res) => {
  const { instance } = req.body;
  const stateFile = getStatePath(instance);
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const context = await browser.newContext({ storageState: stateFile });
    const page = await context.newPage();
    const url = instance === "Realm" ? "https://admin2.neataffiliates.com/dashboard" : "https://admin.throneneataffiliates.com/dashboard";
    await page.goto(url, { waitUntil: "networkidle" });
    if (page.url().includes("login.php")) throw new Error("Expired");
    await context.storageState({ path: stateFile });
    res.json({ ok: true, message: `Session ${instance} refreshed.` });
  } catch (error) { res.status(500).json({ ok: false, error: error.message }); } finally { if (browser) await browser.close(); }
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
      addLog("DEBUG: ERROR - Session dead.");
      return res.status(401).json({ ok: false, error: "Auth failed", debug: trace });
    }

    addLog("DEBUG: Filling domains...");
    await page.fill("#search_and_replace_dataSearch", blockedDomain);
    await page.fill("#search_and_replace_dataReplace", replacementDomain);
    addLog("DEBUG: Clicking Preview...");

    await Promise.all([
      page.click('input[type="submit"].btn-success'),
      page.waitForNavigation({ waitUntil: "networkidle" })
    ]);

    // CHECK FOR ERROR MESSAGE (No records found)
    const errorAlert = await page.$(".alert-error");
    if (errorAlert) {
      const errorText = await errorAlert.innerText();
      addLog(`DEBUG: ALERT - ${errorText.trim()}`);
      return res.json({ ok: false, message: "No records found", details: errorText.trim(), debug: trace });
    }

    // CONFIRMATION SCREEN
    addLog("DEBUG: Confirmation screen detected.");
    
    // 1. Get confirmation text
    const confirmLabel = await page.innerText('label[for="search_and_replace_confirmation_confirm"]');
    addLog(`DEBUG: Confirmation Text: ${confirmLabel.trim()}`);

    // 2. Click Checkbox
    addLog("DEBUG: Checking confirmation box...");
    await page.click("#search_and_replace_confirmation_confirm");

    // 3. Click Replace All
    addLog("DEBUG: Clicking 'Replace All'...");
    await Promise.all([
      page.click('input[type="submit"][value="Replace All"]'),
      page.waitForNavigation({ waitUntil: "networkidle" })
    ]);

    addLog("DEBUG: Replace All executed successfully.");
    res.json({ ok: true, instance: instance, confirmation: confirmLabel.trim(), debug: trace });

  } catch (error) {
    addLog(`DEBUG: EXCEPTION - ${error.message}`);
    res.status(500).json({ ok: false, error: error.message, debug: trace });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => { console.log(`Worker active on ${PORT} ✅`); });