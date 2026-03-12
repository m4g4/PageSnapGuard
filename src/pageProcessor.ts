import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { compareScreenshots, takeScreenshot } from './utils/screenshot.js';
import { ClickActionValueType, CssSelectorType, DynamicPageConfigType, isCrawlPageConfigType, isSelectorWait, isTimeWait, isUrlPathType, PageConfigurationType, ScreenshotActionValueType, TimeMillisValueType, TypeActionValueType, UrlPathType, WaitActionValueType } from './types.js';
import { getConfig } from './config.js';
import { url } from './utils/url.js';
import { waitForTimeout } from './utils/utils.js';

export type PageUrlType = string | 'url';

export type PageProcessResult = {
    pageUrl: PageUrlType,
    success: boolean,
    differencePct?: number,
    error?: string
}

let launchedBrowserCount: number = 0;
const browserPool: Array<Browser> = [];
const waitingQueue: Array<{ resolve: () => void }> = [];
const processedBaselineFiles = new Set<string>();

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

const toScreenshotFileName = (rawName: string): string => {
    const normalized = rawName
        .trim()
        // Normalize common HTML entities that can leak into URLs (e.g. &amp;)
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Drop template-style placeholders if they somehow leak into the path
        .replace(/\{\{[^}]+\}\}/g, '')
        .replace(/^\/+|\/+$/g, '')
        // Replace path separators to keep screenshots in a single folder
        .replace(/\//g, '_')
        .replace(/[?#]/g, '_')
        .replace(/[&=]/g, '_')
        .replace(/[<>:"\\|*]+/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_');

    return normalized || 'root';
}

const logVerbose = (message: string) => {
    if (getConfig().verbose) {
        console.info(`[verbose] ${message}`);
    }
}

const resolveLaunchBrowser = (): 'chrome' | 'firefox' => {
    const browser = getConfig().browser;

    if (browser === 'firefox' || browser === 'firefox-esr') {
        return 'firefox';
    }

    return 'chrome';
}

const resolveExecutablePath = (): string | undefined => {
    if (getConfig().browserExecutablePath) {
        return getConfig().browserExecutablePath;
    }

    if (getConfig().browser === 'firefox-esr') {
        return '/usr/bin/firefox-esr';
    }

    return undefined;
}

export const getBrowser = async () => {
    
    if (launchedBrowserCount < getConfig().browserPoolCount) {
        launchedBrowserCount++;

        const browser = resolveLaunchBrowser();
        const executablePath = resolveExecutablePath();
        logVerbose(`Launching browser #${launchedBrowserCount}/${getConfig().browserPoolCount} (${browser})${executablePath ? ` with executable ${executablePath}` : ''}`);

        try {
            return await puppeteer.launch({
                browser,
                executablePath,
                args: getConfig().browserArgs,
                headless: getConfig().headless
            });
        } catch (error) {
            launchedBrowserCount--;
            logVerbose('Browser launch failed, releasing launch slot.');
            throw error;
        }
    }

    logVerbose(`Browser pool exhausted (${getConfig().browserPoolCount}). Waiting for a free browser...`);

    return new Promise<Browser>((resolve) => {
        waitingQueue.push({
            resolve: () => {
                const browser = browserPool.pop();
                if (browser === undefined) {
                    throw new Error('Error retrieving free browser!');
                }
                logVerbose('Reusing browser from pool.');
                resolve(browser);
            },
        });
    });
}

export const returnBrowserToPool = (browser: Browser) => {
    browserPool.push(browser);
    logVerbose(`Browser returned to pool. Pool size: ${browserPool.length}`);
    
    if (waitingQueue.length > 0) {
        const nextTask = waitingQueue.shift();
        if (nextTask) nextTask.resolve();
    }
}

export const closeBrowsers = () => {
    if (browserPool.length !== launchedBrowserCount)
        throw new Error(`Cannot close working browsers! Free browser count: ${browserPool.length}, Launched browser count: ${launchedBrowserCount}`);

    logVerbose(`Closing ${browserPool.length} browser instance(s).`);
    browserPool.forEach(b => b.close());
} 

const toPageLabel = (config: PageConfigurationType): PageUrlType => {
    if (isUrlPathType(config)) {
        return config || 'root';
    }

    const pathLabel = config.path || 'root';
    const name = 'name' in config ? config.name : undefined;
    if (typeof name === 'string' && name.trim().length > 0) {
        return `${name.trim()} (${pathLabel})`;
    }

    return pathLabel;
}

const toErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
}

const processPageSafely = async (config: PageConfigurationType): Promise<PageProcessResult> => {
    const pageUrl = toPageLabel(config);
    logVerbose(`Page started: ${pageUrl}`);

    try {
        let differencePct: number | undefined;
        if (isUrlPathType(config)) {
            differencePct = await processUrlPathPage(config);
        } else if (isCrawlPageConfigType(config)) {
            differencePct = await processUrlPathPage(config.path);
        } else {
            differencePct = await processDynamicPage(config);
        }

        logVerbose(`Page finished: ${pageUrl}`);
        return { pageUrl, success: true, differencePct };
    } catch (error) {
        logVerbose(`Page failed: ${pageUrl} - ${toErrorMessage(error)}`);
        return {
            pageUrl,
            success: false,
            error: toErrorMessage(error)
        };
    }
}

export const processPages = (): Promise<PageProcessResult>[] => {
    const pageConfig = getConfig().pages;
    logVerbose(`Preparing ${pageConfig.length} page task(s).`);

    const pagePromises: Promise<PageProcessResult>[] = [];
    for (let i = 0; i < getConfig().pages.length; i++) {
        pagePromises.push(processPageSafely(pageConfig[i]));
    }

    return pagePromises;
}

export const pruneStaleBaselineFiles = () => {
    const baselineDir = getConfig().baselineDir;

    const walk = (dirPath: string): string[] => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const files: string[] = [];

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);

            if (entry.isDirectory()) {
                files.push(...walk(fullPath));
                continue;
            }

            files.push(fullPath);
        }

        return files;
    };

    if (!fs.existsSync(baselineDir)) {
        return;
    }

    const baselineFiles = walk(baselineDir);
    for (const filePath of baselineFiles) {
        if (!filePath.endsWith('.png')) {
            continue;
        }

        const relativePath = path.relative(baselineDir, filePath).split(path.sep).join('/');
        if (!processedBaselineFiles.has(relativePath)) {
            fs.unlinkSync(filePath);
            console.info(`Removed stale baseline: ${filePath}`);
        }
    }
}

export const processUrlPathPage = async (pageConfig: UrlPathType): Promise<number | undefined> => {
    const browser = await getBrowser();

    try {
        const page = await browser.newPage();
        const targetUrl = url(getConfig().baseUrl, pageConfig);
        logVerbose(`Opening page: ${targetUrl}`);

        logVerbose(`Navigating with waitUntil=${getConfig().gotoWaitUntil}, timeout=${getConfig().navigationTimeoutMs}ms`);
        await page.goto(targetUrl, { waitUntil: getConfig().gotoWaitUntil, timeout: getConfig().navigationTimeoutMs });
        logVerbose(`Waiting for global selector (${getConfig().globalSelector}) on: ${targetUrl}, timeout=${getConfig().globalSelectorTimeoutMs}ms`);
        await page.waitForSelector(getConfig().globalSelector, { timeout: getConfig().globalSelectorTimeoutMs });

        const screenshotId = isHttpUrl(pageConfig)
            ? `${new URL(targetUrl).pathname}${new URL(targetUrl).search}`
                .replace(/^\/+/, '')
                .replace(/[^\w.-]+/g, '_') || 'root'
            : pageConfig;

        logVerbose(`Taking root screenshot for: ${screenshotId || 'root'}`);
        return await processScreenshot(page, screenshotId);

    } finally {
        returnBrowserToPool(browser);
    }
}

export const processDynamicPage = async (pageConfig: DynamicPageConfigType): Promise<number | undefined> => {
    const browser = await getBrowser();
    let maxDifferencePct: number | undefined;
    
    try {
        const page = await browser.newPage();
        const targetUrl = url(getConfig().baseUrl, pageConfig.path);
        logVerbose(`Opening dynamic page: ${targetUrl}`);

        logVerbose(`Navigating with waitUntil=${getConfig().gotoWaitUntil}, timeout=${getConfig().navigationTimeoutMs}ms`);
        await page.goto(targetUrl, { waitUntil: getConfig().gotoWaitUntil, timeout: getConfig().navigationTimeoutMs });
        logVerbose(`Waiting for global selector (${getConfig().globalSelector}) on: ${targetUrl}, timeout=${getConfig().globalSelectorTimeoutMs}ms`);
        await page.waitForSelector(getConfig().globalSelector, { timeout: getConfig().globalSelectorTimeoutMs });

        for (const action of pageConfig.actions) {
            logVerbose(`Action '${action.name}' on '${pageConfig.path}'`);
            switch (action.name) {
                case 'click':
                    await page.$eval(action.value as ClickActionValueType, el => (el as HTMLElement).click())
                    logVerbose(`Clicked on element: ${action.value}`);
                    break;

                case 'wait':
                    const value = action.value;
                    if (isTimeWait(value as WaitActionValueType)) {
                        await waitForTimeout(value as TimeMillisValueType);
                        logVerbose(`Waited ${value}ms`);
                    } else if (isSelectorWait(value as WaitActionValueType)) {
                        await page.waitForSelector(value as CssSelectorType, { timeout: 10000 });
                        logVerbose(`Waited for element: ${value}`);
                    }
                    break;

                case 'type':
                    const { selector, what } = action.value as TypeActionValueType;
                    await page.type(selector, what);
                    logVerbose(`Typed '${what}' into: ${selector}`);
                    break;

                case 'screenshot':
                    const screenshotId = action.value as ScreenshotActionValueType;
                    const screenshotDiff = await processScreenshot(page, `${pageConfig.path}_${screenshotId}`);
                    if (typeof screenshotDiff === 'number' && (maxDifferencePct === undefined || screenshotDiff > maxDifferencePct)) {
                        maxDifferencePct = screenshotDiff;
                    }
                    logVerbose(`Screenshot saved to: ${action.value}`);
                    break;

                default:
                    console.error(`Unknown action: ${action.name}`);
            }
        }
        return maxDifferencePct;
    } finally {
        returnBrowserToPool(browser);
    }
}
    
export const processScreenshot = async (page: Page, fileName: string): Promise<number | undefined> => {

    const screenshotFileName = toScreenshotFileName(fileName);
    const takeScreenshotPathName: string = getConfig().screenshotDir+'/'+screenshotFileName;
    const baselinePathName: string = getConfig().baselineDir+'/'+screenshotFileName;
    const diffPathName = getConfig().diffDir+'/'+screenshotFileName;
    fs.mkdirSync(path.dirname(takeScreenshotPathName), { recursive: true });
    fs.mkdirSync(path.dirname(baselinePathName), { recursive: true });
    fs.mkdirSync(path.dirname(diffPathName), { recursive: true });

    await takeScreenshot(page, takeScreenshotPathName, getConfig().viewPort);

    const takeScreenshotPath: string = `${takeScreenshotPathName}.png`;
    const baselinePath: string = `${baselinePathName}.png`;
    const diffPath = `${diffPathName}.png`;
    processedBaselineFiles.add(`${screenshotFileName}.png`);
    logVerbose(`Capturing screenshot: ${takeScreenshotPath}`);

    if (!fs.existsSync(baselinePath)) {
        logVerbose(`Baseline missing. Creating: ${baselinePath}`);
        fs.copyFileSync(takeScreenshotPath, baselinePath);
        return undefined;
    } else {
        logVerbose(`Comparing ${takeScreenshotPath} against baseline ${baselinePath}`);
        const { differencePct, diffPng } = compareScreenshots(takeScreenshotPath, baselinePath);
        logVerbose(`Diff for ${screenshotFileName}: ${differencePct.toFixed(2)}%`);

        const diffThresholdPct = getConfig().diffTresholdPct ?? 0;
        const saveDiffs = getConfig().saveDiffs ?? 'all';
        const isChanged = differencePct >= diffThresholdPct;
        const shouldWriteDiff = saveDiffs === 'all' || (saveDiffs === 'changed' && isChanged);

        if (diffPng && shouldWriteDiff) {
            fs.writeFileSync(diffPath, diffPng);
        }

        if (getConfig().updateBaseline) {
            fs.copyFileSync(takeScreenshotPath, baselinePath);
            logVerbose(`Baseline updated: ${baselinePath}`);
        }

        return differencePct;
    }
}
