app.post("/job", async (req, res) => {
  try {
    const { instance, blockedDomain, replacementDomain } = req.body || {};

    if (!instance || !blockedDomain || !replacementDomain) {
      return res.status(400).json({
        ok: false,
        error: "Missing required fields: instance, blockedDomain, replacementDomain"
      });
    }

    const page = await getPage();

    // Decide URL based on instance (replace with your real URLs if different)
    const url =
      instance === "Realm"
        ? "https://admin2.neataffiliates.com/landing-pages/search-and-replace"
        : "https://admin.throneneataffiliates.com/landing-pages/search-and-replace";

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

    // For now: just return what we would do
    return res.json({
      ok: true,
      step: "prepared",
      instance,
      urlOpened: page.url(),
      blockedDomain,
      replacementDomain
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: String(e) });
  }
});
