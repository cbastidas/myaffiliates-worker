const { chromium } = require("playwright");
const fs = require("fs");

(async () => {
  const instance = process.argv[2] || "Throne";

  const url =
    instance === "Realm"
      ? "https://admin2.neataffiliates.com/landing-pages/search-and-replace"
      : "https://admin.throneneataffiliates.com/landing-pages/search-and-replace";

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: "domcontentloaded" });

  console.log("\nLog in manually in the opened browser window.");
  console.log("When you finish and you are NOT on login.php anymore, come back here and press ENTER.\n");

  await new Promise((resolve) => process.stdin.once("data", resolve));

  // Save cookies + localStorage/sessionStorage
  await context.storageState({ path: `storageState-${instance}.json` });

  console.log(`Saved: storageState-${instance}.json`);
  await browser.close();
})();
