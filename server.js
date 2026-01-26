const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const app = express(); // This line was likely missing
app.use(express.json());

const getStatePath = (instance) => {
  return instance === "Realm" ? "storageState-Realm.json" : "storageState-Throne.json";
};

// ENDPOINT: Check if sessions are valid and files exist
app.get("/status", async (req, res) => {
  const instances = ["Throne", "Realm"];
  const report = {};

  for (const instance of instances) {
    const stateFile = getStatePath(instance);
    const fileExists = fs.existsSync(stateFile);
    let sessionActive = false;
    let details = "";

    if (fileExists) {
      const browser = await chromium.launch({ 
        headless: true, 
        args: ["--no-sandbox", "--disable-dev-shm-usage"] 
      });
      try {
        const context = await browser.newContext({ storageState: stateFile });
        const page = await context.newPage();
        const url = instance === "Realm"
          ? "https://admin2.neataffiliates.com/dashboard"
          : "https://admin.throneneataffiliates.com/dashboard";

        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        sessionActive = !page.url().includes("login.php");
        details = sessionActive ? "Session Verified" : "Cookies Expired";
      } catch (err) {
        details = `Error: ${err.message}`;
      } finally {
        if (browser) await browser.close();
      }
    } else {
      details = "File Missing";
    }

    report[instance] = {
      instance: instance,
      file_exists: fileExists,
      session_active: sessionActive,
      message: details,
      can_proceed: sessionActive && fileExists
    };
  }

  res.json({
    timestamp: new Date().toISOString(),
    worker_status: "ONLINE",
    results: report
  });
});

// ENDPOINT: Session Refresh (Heartbeat)
app.post("/refresh", async (req, res) => {
  const { instance } = req.body;
  if (!instance) return res.status(400).json({ error: "Missing instance" });

  const stateFile = getStatePath(instance);
  const browser = await chromium.launch({ 
    headless: true, 
    args: ["--no-sandbox", "--disable-dev-shm-usage"] 
  });

  try {
    const context = await browser.newContext({ storageState: stateFile });
    const page = await context.newPage();
    const url = instance === "Realm"
      ? "https://admin2.neataffiliates.com/dashboard"
      : "https://admin.throneneataffiliates.com/dashboard";

    await page.goto(url, { waitUntil: "networkidle" });

    if (page.url().includes("login.php")) {
      throw new Error("Session expired");
    }

    await context.storageState({ path: stateFile });
    console.log(`[SESSION] ${instance} state updated on disk.`);
    
    res.json({ ok: true, message: `Session for ${instance} refreshed and saved.` });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

// ENDPOINT: Execute Job
app.post("/job", async (req, res) => {
  const { instance, blockedDomain, replacementDomain } = req.body;
  const stateFile = getStatePath(instance);

  const browser = await chromium.launch({ 
    headless: true, 
    args: ["--no-sandbox", "--disable-dev-shm-usage"] 
  });
  
  try {
    const context = await browser.newContext({ storageState: stateFile });
    const page = await context.newPage();
    const url = instance === "Realm"
      ? "https://admin2.neataffiliates.com/landing-pages/search-and-replace"
      : "https://admin.throneneataffiliates.com/landing-pages/search-and-replace";

    await page.goto(url, { waitUntil: "networkidle" });
    
    if (page.url().includes("login.php")) {
      return res.status(401).json({ ok: false, error: "Auth failed" });
    }

    // FORM AUTOMATION LOGIC GOES HERE
    
    res.json({ ok: true, message: "Job processed", instance: instance });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Worker listening on port ${PORT}`);
});