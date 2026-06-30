const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ defaultViewport: { width: 1440, height: 900 } });
  const page = await browser.newPage();

  const screenshotsDir = path.join(__dirname, '..', 'docs', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const takeScreenshot = async (url, filename, waitTime = 3000) => {
    console.log(`Navigating to ${url}...`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    } catch (e) {
      console.log(`Goto timeout caught for ${url}, proceeding anyway to screenshot...`);
    }
    await new Promise(r => setTimeout(r, waitTime));
    await page.screenshot({ path: path.join(screenshotsDir, filename) });
    console.log(`Saved ${filename}`);
  };

  try {
    // 1. Dashboard (War Room / Genome Mode)
    await takeScreenshot('http://127.0.0.1:3000/?demo=true', 'dashboard.png', 5000);

    // 2. Omni-Deck (Published)
    await takeScreenshot('http://127.0.0.1:3000/omnideck?demo=true', 'omnideck_published.png', 5000);

    // 3. Pricing
    await takeScreenshot('http://127.0.0.1:3000/pricing', 'pricing.png', 2000);

    // 4. Login
    await takeScreenshot('http://127.0.0.1:3000/login', 'login.png', 2000);

    // 5. Register
    await takeScreenshot('http://127.0.0.1:3000/register', 'register.png', 2000);

    console.log('Successfully captured all extended screenshots.');
  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
})();
