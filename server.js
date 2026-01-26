// ENDPOINT: Check if sessions are valid and files exist
app.get("/status", async (req, res) => {
  const instances = ["Throne", "Realm"];
  const report = {};

  for (const instance of instances) {
    const stateFile = getStatePath(instance);
    const fileExists = fs.existsSync(stateFile);
    let sessionValid = false;
    let lastChecked = new Date().toISOString();

    if (fileExists) {
      const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      try {
        const context = await browser.newContext({ storageState: stateFile });
        const page = await context.newPage();
        
        const url = instance === "Realm" 
          ? "https://admin2.neataffiliates.com/dashboard" 
          : "https://admin.throneneataffiliates.com/dashboard";

        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        
        // If the URL does not contain 'login.php', the session is ACTIVE
        sessionValid = !page.url().includes("login.php");
      } catch (err) {
        console.error(`Validation error for ${instance}:`, err.message);
      } finally {
        await browser.close();
      }
    }

    report[instance] = {
      file_found: fileExists,
      session_active: sessionValid,
      last_validation: lastChecked,
      status: sessionValid ? "READY_TO_PROCEED" : "RE_AUTH_REQUIRED"
    };
  }

  res.json({
    system_status: "ONLINE",
    instances: report
  });
});

// IMPROVED REFRESH LOGIC (Ensures the file is physically overwritten on disk)
async function refreshSession(instance) {
  const stateFile = getStatePath(instance);
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  
  try {
    const context = await browser.newContext({ storageState: stateFile });
    const page = await context.newPage();
    const url = instance === "Realm" ? "https://admin2.neataffiliates.com/dashboard" : "https://admin.throneneataffiliates.com/dashboard";

    await page.goto(url, { waitUntil: "networkidle" });

    if (page.url().includes("login.php")) throw new Error("Expired");

    // This command triggers the physical save to the storageState-X.json file
    await context.storageState({ path: stateFile });
    console.log(`[DISK SAVE] ${stateFile} updated with fresh cookies.`);
    return true;
  } finally {
    await browser.close();
  }
}