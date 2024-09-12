import { Page } from 'puppeteer';
import fs from 'fs';
import { compareScreenshots } from './utils/screenshot.js';
import { BatchType, ScreenType } from './types';
import { getConfig } from './config.js';

export const runBatches = async (page: Page, batches: BatchType[]) => {
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const screens = batch.screens();

        for (let i = 0; i < screens.length; i++) {
            await runBatch(page, batch, screens[i]);    
        }
    }
}

export const runBatch = async (page: Page, batch: BatchType, screen: ScreenType) => {
    const fileName = `${batch.name}_${screen.name}`;

    const takeScreenshotPathName: string = getConfig().screenshotDir+'/'+fileName;
    const baselinePathName: string = getConfig().baselineDir+'/'+fileName;
    const diffPathName = getConfig().diffDir+'/'+fileName;

    const numberOfScreenshots = await screen.takeScreenshot(page, takeScreenshotPathName);

    for (let i = 0; i < numberOfScreenshots; i++) {
        const takeScreenshotPath: string = `${takeScreenshotPathName}-${i}.png`;
        const baselinePath: string = `${baselinePathName}-${i}.png`;
        const diffPath = `${diffPathName}-${i}.png`;

        if (!fs.existsSync(baselinePath)) {
            console.log(`New screenshot: ${baselinePath}`);
            fs.copyFile(takeScreenshotPath, baselinePath, (err) => {
                if (err) console.error('Failed copying file! ' + err);
            });
        } else {
            const difference = compareScreenshots(takeScreenshotPath, baselinePath, diffPath);

            if (difference > getConfig().diffTresholdPct)
                console.error(`Difference in ${screen.name}: ${difference}%`);
        }
    }
}