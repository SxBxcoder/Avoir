const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('https://main.d2u0mm6cr1j81.amplifyapp.com/');

    console.log('Log in manually with your demo Google account. You have 60 seconds...');
    await page.waitForTimeout(60000);

    await context.storageState({ path: 'demo_session.json' });
    console.log('Session saved successfully!');
    await browser.close();
})();