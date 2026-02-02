const express = require("express");
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

// Helper: Get the correct storage state file path
const getStatePath = (instance) => {
    return instance === "Realm" ? "storageState-Realm.json" : "storageState-Throne.json";
};

// HELPER: Simulate human-like mouse movements to bypass anti-bot
async function simulateHumanMovement(page) {
    const viewport = page.viewportSize() || { width: 1280, height: 720 };
    const movements = Math.floor(Math.random() * 6) + 5;
    
    for (let i = 0; i < movements; i++) {
        const x = Math.floor(Math.random() * viewport.width);
        const y = Math.floor(Math.random() * viewport.height);
        
        await page.mouse.move(x, y, { steps: 10 }); 
        await page.waitForTimeout(Math.random() * 1000 + 500); 
    }
}

// ENDPOINT 1: Visual Debug Refresh (Targeting index.php)
app.post("/debug-refresh", async (req, res) => {
    const { instance } = req.body;
    const stateFile = getStatePath(instance);
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

    try {
        const context = await browser.newContext({ storageState: stateFile });
        const page = await context.newPage();
        const baseUrl = instance === "Realm" ? "https://admin2.neataffiliates.com" : "https://admin.throneneataffiliates.com";
        const url = `${baseUrl}/index.php`;
        
        await page.goto(url, { waitUntil: "networkidle" });
        await simulateHumanMovement(page);
        await page.reload({ waitUntil: "networkidle" });

        const screenshotName = `debug-${instance}.png`;
        await page.screenshot({ path: screenshotName });

        if (page.url().includes("login.php")) {
            const errorImg = fs.readFileSync(screenshotName, { encoding: 'base64' });
            return res.status(401).json({ ok: false, message: "AUTH_REQUIRED", screenshot: errorImg });
        }

        await context.storageState({ path: stateFile });
        const imageBase64 = fs.readFileSync(screenshotName, { encoding: 'base64' });

        res.json({ ok: true, instance, message: "Hard refresh successful", screenshot: imageBase64 });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

// ENDPOINT 2: Ghost Activity (Lightweight presence simulation)
app.post("/ghost-activity", async (req, res) => {
    const { instance } = req.body;
    const stateFile = getStatePath(instance);
    const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    
    try {
        const context = await browser.newContext({ storageState: stateFile });
        const page = await context.newPage();
        const baseUrl = instance === "Realm" ? "https://admin2.neataffiliates.com" : "https://admin.throneneataffiliates.com";
        
        await page.goto(`${baseUrl}/index.php`, { waitUntil: "networkidle" });
        console.log(`[${instance}] Ghost Activity: Simulating mouse movements...`);
        await simulateHumanMovement(page);
        
        res.json({ ok: true, message: `Ghost Activity successfully simulated for ${instance}.` });
    } catch (error) {
        res.status(500).json({ ok: false, error: error.message });
    } finally {
        if (browser) await browser.close();
    }
});

// ENDPOINT 3: Execute Search & Replace Job
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
        
        await page.goto(`${baseUrl}/landing-pages/search-and-replace`, { waitUntil: "networkidle" });
        if (page.url().includes("login.php")) {
            addLog("DEBUG: ERROR - Session dead.");
            return res.status(401).json({ ok: false, error: "Auth failed", debug: trace });
        }

        await simulateHumanMovement(page);

        addLog("DEBUG: Filling domains...");
        await page.fill("#search_and_replace_dataSearch", blockedDomain);
        await page.fill("#search_and_replace_dataReplace", replacementDomain);
        
        addLog("DEBUG: Clicking Preview...");
        await Promise.all([
            page.click('input[type="submit"].btn-success'),
            page.waitForNavigation({ waitUntil: "networkidle", timeout: 60000 }) // 60s timeout for navigation
        ]);

        // VERIFICATION: Check if confirmation exists OR if an error alert appeared
        addLog("DEBUG: Checking for results...");
        try {
            await page.waitForSelector('label[for="search_and_replace_confirmation_confirm"], .alert-error', { timeout: 15000 });
        } catch (e) {
            addLog("DEBUG: Timeout - No confirmation or error found.");
            return res.status(404).json({ ok: false, message: "Page results took too long or were not found.", debug: trace });
        }

        const errorAlert = await page.$(".alert-error");
        if (errorAlert) {
            const errorText = await errorAlert.innerText();
            addLog(`DEBUG: ALERT - ${errorText.trim()}`);
            return res.json({ ok: false, message: "No records found", details: errorText.trim(), debug: trace });
        }

        // CONFIRMATION SCREEN
        addLog("DEBUG: Reading confirmation label...");
        const confirmLabel = await page.innerText('label[for="search_and_replace_confirmation_confirm"]');
        addLog(`DEBUG: Confirmation Text: ${confirmLabel.trim()}`);

        addLog("DEBUG: Checking confirmation box...");
        await page.click("#search_and_replace_confirmation_confirm");

        addLog("DEBUG: Clicking 'Replace All'...");
        await Promise.all([
            page.click('input[type="submit"][value="Replace All"]'),
            page.waitForNavigation({ waitUntil: "networkidle", timeout: 60000 })
        ]);

        addLog("DEBUG: Execution successful.");
        res.json({ ok: true, instance, confirmation: confirmLabel.trim(), debug: trace });
    } catch (error) {
        addLog(`DEBUG: EXCEPTION - ${error.message}`);
        res.status(500).json({ ok: false, error: error.message, debug: trace });
    } finally {
        if (browser) await browser.close();
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => { console.log(`DomainSwitcher Worker active on ${PORT} ✅`); });