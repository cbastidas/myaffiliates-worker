const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  // Open visible browser ON YOUR PC
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // TODO: Replace with your real login URL
  await page.goto("https://admin.throneneataffiliates.com/index.php", { waitUntil: "domcontentloaded" });

  console.log("\nLogin manually (solve captcha) and reach the dashboard.");
  console.log("When you are DONE, come back here and press ENTER in this terminal.\n");

  // Wait for Enter
  await new Promise((resolve) => process.stdin.once("data", resolve));

  // Save session cookies/localStorage
  const state = await context.storageState();
  fs.writeFileSync("storageState.json", JSON.stringify(state, null, 2));

  console.log("Saved storageState.json ✅");

  await browser.close();
})();
