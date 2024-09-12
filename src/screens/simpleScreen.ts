import { Page } from 'puppeteer';
import { takeScreenshot } from '../utils/screenshot.js';
import { url } from '../utils/url.js';
import { getConfig } from '../config.js';

export function createSimpleScreenshot(urlPath: string, selector = getConfig().globalSelector): (page: Page, filePath: string) => Promise<number> {
    return async (page: Page, filePath: string) => {
        await page.goto(url(getConfig().baseUrl, urlPath), { waitUntil: 'networkidle2' });
        
        await page.waitForSelector(selector, { timeout: 5000 });
        return await takeScreenshot(page, filePath, getConfig().viewPort);
    }
}