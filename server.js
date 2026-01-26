app.post("/job", async (req, res) => {
  const { instance, blockedDomain, replacementDomain } = req.body;
  const stateFile = getStatePath(instance);
  const debugLogs = []; // Array to store steps for traceability

  const addLog = (msg) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logEntry = `[${timestamp}] [${instance}] ${msg}`;
    console.log(logEntry);
    debugLogs.push(logEntry);
  };

  const browser = await chromium.launch({ 
    headless: true, 
    args: ["--no-sandbox", "--disable-dev-shm-usage"] 
  });
  
  try {
    addLog("DEBUG: Initializing browser context...");
    const context = await browser.newContext({ storageState: stateFile });
    const page = await context.newPage();
    
    const baseUrl = instance === "Realm" 
      ? "https://admin2.neataffiliates.com" 
      : "https://admin.throneneataffiliates.com";
    
    addLog(`DEBUG: Navigating to Search & Replace URL...`);
    await page.goto(`${baseUrl}/landing-pages/search-and-replace`, { waitUntil: "networkidle" });
    
    addLog(`DEBUG: Current URL: ${page.url()}`);
    if (page.url().includes("login.php")) {
      addLog("DEBUG: ERROR - Redirected to login. Session is invalid.");
      return res.status(401).json({ ok: false, error: "Auth failed", debug: debugLogs });
    }

    const searchInput = "#search_and_replace_dataSearch";
    const replaceInput = "#search_and_replace_dataReplace";
    
    addLog("DEBUG: Waiting for form inputs to load...");
    await page.waitForSelector(searchInput, { timeout: 15000 });
    
    addLog(`DEBUG: Filling blocked domain: ${blockedDomain}`);
    await page.fill(searchInput, blockedDomain);
    
    addLog(`DEBUG: Filling replacement domain: ${replacementDomain}`);
    await page.fill(replaceInput, replacementDomain);

    addLog("DEBUG: Clicking 'Preview' button...");
    await Promise.all([
      page.click('input[type="submit"].btn-success'),
      page.waitForNavigation({ waitUntil: "networkidle" })
    ]);

    addLog("DEBUG: Preview page loaded successfully.");
    
    res.json({ 
      ok: true, 
      message: "Job executed", 
      instance: instance,
      trace: debugLogs 
    });

  } catch (error) {
    addLog(`DEBUG: EXCEPTION - ${error.message}`);
    res.status(500).json({ ok: false, error: error.message, trace: debugLogs });
  } finally {
    if (browser) await browser.close();
  }
});