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
    
    // Construct the URL based on the instance
    const baseUrl = instance === "Realm"
      ? "https://admin2.neataffiliates.com"
      : "https://admin.throneneataffiliates.com";
    
    const targetUrl = `${baseUrl}/landing-pages/search-and-replace`;

    console.log(`[JOB] Navigating to ${targetUrl} for ${instance}...`);
    await page.goto(targetUrl, { waitUntil: "networkidle" });
    
    // Check if we were redirected to login
    if (page.url().includes("login.php")) {
      return res.status(401).json({ ok: false, error: "Authentication failed. Session expired." });
    }

    // --- AUTOMATION STEPS ---
    
    // 1. Insert Blocked Domain
    const searchInput = "#search_and_replace_dataSearch";
    await page.waitForSelector(searchInput, { timeout: 15000 });
    await page.fill(searchInput, blockedDomain);
    console.log(`[JOB] Inserted Blocked Domain: ${blockedDomain}`);

    // 2. Insert Backup Domain
    const replaceInput = "#search_and_replace_dataReplace";
    await page.fill(replaceInput, replacementDomain);
    console.log(`[JOB] Inserted Backup Domain: ${replacementDomain}`);

    // 3. Click Preview and wait for the result
    const previewButton = 'input[type="submit"].btn-success';
    await Promise.all([
      page.click(previewButton),
      page.waitForNavigation({ waitUntil: "networkidle" })
    ]);

    console.log(`[JOB] Preview executed successfully on ${instance} ✅`);

    res.json({ 
      ok: true, 
      message: "Search & Replace preview executed", 
      instance: instance, 
      details: {
        from: blockedDomain,
        to: replacementDomain
      }
    });

  } catch (error) {
    console.error(`[JOB ERROR] ${instance}:`, error.message);
    res.status(500).json({ ok: false, error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});