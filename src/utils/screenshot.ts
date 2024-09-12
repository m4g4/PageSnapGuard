import fs from 'fs';
import { Page } from 'puppeteer';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { waitForTimeout } from './utils.js';
import { ViewPortType } from '../types.js';

export async function takeScreenshot(page: Page, fileName: string, viewPort: ViewPortType): Promise<number> {

    const viewportHeight = 840;
    await page.setViewport({ width: 1280, height: viewportHeight });
  
    // Get the total height of the page
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  
    let scrollPosition = 0;
    let screenshotIndex = 0;
  
    while (scrollPosition < totalHeight) {
      const path = `${fileName}-${screenshotIndex}.png`;
      
      await page.screenshot({ path });
  
      // Scroll the page by the viewport height
      scrollPosition += viewportHeight;

      await page.evaluate((scrollPosition) => {
        window.scrollTo(0, scrollPosition);
      }, scrollPosition);
  
      await waitForTimeout(500);
  
      screenshotIndex++;
    }  

    return screenshotIndex;
}

export function compareScreenshots(newImagePath: string, baselineImagePath: string, diffImagePath: string): number {
    const img1 = PNG.sync.read(fs.readFileSync(newImagePath));
    const img2 = PNG.sync.read(fs.readFileSync(baselineImagePath));
    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });

    // Write the diff image to disk
    fs.writeFileSync(diffImagePath, PNG.sync.write(diff));

    return (numDiffPixels / (width * height)) * 100; // Percentage of pixels that differ
}