import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import { compareScreenshots, takeScreenshot } from './utils/screenshot.js';
import { ClickActionValueType, DynamicPageConfigType, isUrlPathType, PageConfigurationType, ScreenshotActionValueType, TypeActionValueType, UrlPathType, WaitActionValueType } from './types.js';
import { getConfig } from './config.js';
import { url } from './utils/url.js';


export const processPages = (): Promise<void>[] => {
    const pageConfig = getConfig().pages;

    const pagePromises: Promise<void>[] = [];
    for (let i = 0; i < getConfig().pages.length; i++) {
        const config = pageConfig[i];
     
        if (isUrlPathType(config)) {
            pagePromises.push(processUrlPathPage(pageConfig[i] as UrlPathType))
        } else {
            pagePromises.push(processDynamicPage(pageConfig[i] as DynamicPageConfigType))
        }
    }

    return pagePromises;
}

export const processUrlPathPage = async (pageConfig: UrlPathType) => {
    const browser = await puppeteer.launch({ headless: getConfig().headless });

    try {
        const page = await browser.newPage();

        await page.goto(url(getConfig().baseUrl, pageConfig), { waitUntil: 'networkidle0' });
        await page.waitForSelector(getConfig().globalSelector, { timeout: 5000 });

        await processScreenshot(page, pageConfig);

    } finally {
        await browser.close();
    }
}

export const processDynamicPage = async (pageConfig: DynamicPageConfigType) => {
    const browser = await puppeteer.launch({ headless: getConfig().headless });
    
    try {
        const page = await browser.newPage();

        await page.goto(url(getConfig().baseUrl, pageConfig.path), { waitUntil: 'networkidle0' });
        await page.waitForSelector(getConfig().globalSelector, { timeout: 5000 });

        for (const action of pageConfig.actions) {
            switch (action.name) {
                case 'click':
                    await page.click(action.value as ClickActionValueType);
                    console.debug(`Clicked on element: ${action.value}`);
                    break;

                case 'wait':
                    await page.waitForSelector(action.value as WaitActionValueType);
                    console.debug(`Waited for element: ${action.value}`);
                    break;

                case 'type':
                    const { selector, what } = action.value as TypeActionValueType;
                    await page.type(selector, what);
                    console.debug(`Typed '${what}' into: ${selector}`);
                    break;

                case 'screenshot':
                    const screenshotId = action.value as ScreenshotActionValueType;
                    await processScreenshot(page, `${pageConfig.path}_${screenshotId}`)
                    console.debug(`Screenshot saved to: ${action.value}`);
                    break;

                default:
                    console.error(`Unknown action: ${action.name}`);
            }
        }
    } finally {
        await browser.close();
    }
}
    
export const processScreenshot = async (page: Page, fileName: string) => {

    const takeScreenshotPathName: string = getConfig().screenshotDir+'/'+fileName;
    const baselinePathName: string = getConfig().baselineDir+'/'+fileName;
    const diffPathName = getConfig().diffDir+'/'+fileName;

    await takeScreenshot(page, takeScreenshotPathName, getConfig().viewPort);

    const takeScreenshotPath: string = `${takeScreenshotPathName}.png`;
    const baselinePath: string = `${baselinePathName}.png`;
    const diffPath = `${diffPathName}.png`;

    if (!fs.existsSync(baselinePath)) {
        console.debug(`New screenshot: ${baselinePath}`);
        fs.copyFile(takeScreenshotPath, baselinePath, (err) => {
            if (err) console.error('Failed copying file! ' + err);
        });
    } else {
        const difference = compareScreenshots(takeScreenshotPath, baselinePath, diffPath);

        if (difference > getConfig().diffTresholdPct)
            console.error(`Difference in ${fileName}: ${difference.toFixed(2)}%`);
    }
}