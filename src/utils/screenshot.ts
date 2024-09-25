import sharp from 'sharp';
import fs from 'fs';
import { Page } from 'puppeteer';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { waitForTimeout } from './utils.js';
import { ViewPortType } from '../types.js';

export async function takeScreenshot(page: Page, fileName: string, viewPort: ViewPortType): Promise<void> {
    
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

    const paths = []
    
    while (scrollPosition < totalHeight) {
        const path = `${fileName}-${screenshotIndex}.png`;
        paths.push(path);
        
        await waitForTimeout(500);
        
        await page.screenshot({ path });
        
        scrollPosition += viewPort.height;
        
        await page.evaluate((scrollPosition) => {
            window.scrollTo(0, scrollPosition);
        }, scrollPosition);
        
        screenshotIndex++;
    }

    await mergeImages(paths, `${fileName}.png`);

    paths.forEach(path => {
        fs.unlink(path, (err) => {
            if (err) {
                console.error(`Error deleting file: ${path}`, err);
            }
        });
    });
}

export async function mergeImages(imagePaths: string[], outputFile: string) {
    const imagesBuffers = await Promise.all(
        imagePaths.map((imagePath) => fs.promises.readFile(imagePath))
    );
    
    // Get dimensions of each image
    const imagesMetadata = await Promise.all(
        imagesBuffers.map((buffer) => sharp(buffer).metadata())
    );
    
    const totalWidth = Math.max(...imagesMetadata.map((meta) => meta.width!));
    const totalHeight = imagesMetadata.reduce((sum, meta) => sum + meta.height!, 0);
    
    const mergedImage = sharp({
        create: {
            width: totalWidth,
            height: totalHeight,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
    });

    const compositeOperations = imagesBuffers.map((buffer, index) => ({
        input: buffer,
        top: imagesMetadata.slice(0, index).reduce((sum, meta) => sum + meta.height!, 0),
        left: 0
    }));
    
    await mergedImage.composite(compositeOperations).png().toFile(outputFile);
}

export function compareScreenshots(newImagePath: string, baselineImagePath: string, diffImagePath: string): number {
    const img1 = PNG.sync.read(fs.readFileSync(newImagePath));
    const img2 = PNG.sync.read(fs.readFileSync(baselineImagePath));
    const { width: img1Width, height: img1Height } = img1;
    const { width: img2Width, height: img2Height } = img2;

    if (img1Width !== img2Width || img1Height !== img2Height) {
        const diffPixels = Math.abs(img1Width - img2Width) * Math.abs(img1Height - img2Height);
        const total = img1Width * img1Height;
        return (diffPixels / total) * 100;
    }

    const width = img1Width, height = img1Height;

    const diff = new PNG({ width, height });
    const numDiffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 });
    
    fs.writeFileSync(diffImagePath, PNG.sync.write(diff));
    
    return (numDiffPixels / (width * height)) * 100;
}
