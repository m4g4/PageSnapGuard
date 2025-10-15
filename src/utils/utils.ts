import path from "path";
import fs from 'fs';
import { Page } from 'puppeteer';

export async function removeDirFiles(dirPath: string) {
    fs.readdir(dirPath, (err, files) => {
        if (err) throw err;
      
        for (const file of files) {
            fs.unlink(path.join(dirPath, file), (err) => {
                if (err) throw err;
            });
        }
    });
}

export function prepareOutputDir(dirPath: string) {
    if (!fs.existsSync(dirPath)){
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

export function waitForTimeout(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Waits for all active animations on the page to complete,
 * while pausing infinite animations (like spinners or loaders).
 */
export async function waitForAnimationsToEnd(page: Page, timeout = 3000): Promise<void> {
  await page.evaluate(async (timeout) => {
    const animations = document.getAnimations();
    const infiniteAnims: Animation[] = [];
    const finiteAnims: Animation[] = [];

    animations.forEach(anim => {
        const count = anim.effect?.getComputedTiming().iterations;
        if (count === Infinity) {
            infiniteAnims.push(anim);
        } else {
            finiteAnims.push(anim);
        }
    });

    infiniteAnims.forEach(anim => anim.pause());

    await Promise.race([
        Promise.all(finiteAnims.map(a => a.finished)),
        new Promise(resolve => setTimeout(resolve, timeout))
    ]);

    finiteAnims.forEach(anim => anim.finish());
  }, timeout);
}
