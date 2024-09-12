import fs from 'fs';
import { Page } from 'puppeteer';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { waitForTimeout } from './utils.js';
import { ViewPortType } from '../types.js';

export async function takeScreenshot(page: Page, fileName: string, viewPort: ViewPortType): Promise<number> {

    await page.setViewport({ width: viewPort.width, height: viewPort.height });

    await page.evaluate(() => {
        const style = document.createElement('style');
        style.innerHTML = `
          * {
              animation: none !important;
              transition: none !important;
          }
        `;
        document.head.appendChild(style);
    });
  
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  
    let scrollPosition = 0;
    let screenshotIndex = 0;
  
    while (scrollPosition < totalHeight) {
        const path = `${fileName}-${screenshotIndex}.png`;
      
        await waitForTimeout(500);
        await page.screenshot({ path });
        
        scrollPosition += viewPort.height;

        await page.evaluate((scrollPosition) => {
            window.scrollTo(0, scrollPosition);
        }, scrollPosition);
  
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
