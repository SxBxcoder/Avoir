const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ defaultViewport: { width: 1440, height: 900 } });
  const page = await browser.newPage();

  // Create dir if not exist
  const screenshotsDir = path.join(__dirname, '..', '..', 'docs', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    console.log('Navigating to localhost:3000...');
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded' });
    
    // Wait for animations
    await new Promise(r => setTimeout(r, 2000));
    
    // 1. Hero
    console.log('Capturing Hero...');
    await page.screenshot({ path: path.join(screenshotsDir, 'hero.png') });

    // 2. Features
    console.log('Capturing Features...');
    // Scroll to the features section
    await page.evaluate(() => {
      const el = document.getElementById('features');
      if (el) el.scrollIntoView();
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, 'features.png') });
    
    // 3. How It Works
    console.log('Capturing How It Works...');
    await page.evaluate(() => {
      const el = document.getElementById('how-it-works');
      if (el) el.scrollIntoView();
    });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, 'how_it_works.png') });
    
    // 4. Dashboard
    console.log('Navigating to Dashboard...');
    await page.goto('http://localhost:3000/?demo=true', { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: path.join(screenshotsDir, 'dashboard.png') });
    
    console.log('Successfully captured all screenshots.');
  } catch (error) {
    console.error('Error taking screenshots:', error);
  } finally {
    await browser.close();
  }
})();
