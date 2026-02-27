import path from "path";
import fs from 'fs';
import { Page } from 'puppeteer';
import { ConfigType, isCrawlPageConfigType, isUrlPathType, PageConfigurationType } from '../types.js';
import { isHttpUrl, toAbsoluteHttpUrl, urlToPagePath } from './url.js';

const blockedAssetExtensions = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tif', 'tiff', 'avif',
    'mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v',
    'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
    'pdf', 'zip', 'rar', '7z', 'tar', 'gz', 'bz2',
    'woff', 'woff2', 'ttf', 'otf', 'eot',
    'css', 'js', 'map', 'json', 'xml', 'txt', 'csv'
]);

function isAssetOrFilePath(pagePath: string): boolean {
    const pathWithoutQuery = pagePath.split('?')[0];
    const fileName = pathWithoutQuery.split('/').pop() ?? '';
    const dotIndex = fileName.lastIndexOf('.');

    if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
        return false;
    }

    const extension = fileName.slice(dotIndex + 1).toLowerCase();
    return blockedAssetExtensions.has(extension);
}

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

export function loadConfig(filePath: string): ConfigType {
    const configFilePath = path.resolve(filePath);
    if (!fs.existsSync(configFilePath)) {
      throw new Error(`Configuration file not found: ${configFilePath}`);
    }
  
    const rawConfig = fs.readFileSync(configFilePath, 'utf-8');
    const config: ConfigType = JSON.parse(rawConfig);
  
    return config;
}

function decodeXmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function extractHrefValues(htmlContent: string): string[] {
    const matches = [...htmlContent.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)];
    return matches.map(match => decodeXmlEntities(match[1].trim())).filter(Boolean);
}

async function fetchTextWithTimeout(targetUrl: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(targetUrl, { signal: controller.signal });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.text();
    } finally {
        clearTimeout(timeoutId);
    }
}

async function crawlPagesFromSeed(baseUrl: URL, seedPath: string, maxPages: number, requestTimeoutMs: number): Promise<string[]> {
    const seedUrlRaw = isHttpUrl(seedPath) ? seedPath : new URL(seedPath, baseUrl).toString();
    const seedUrl = new URL(seedUrlRaw);
    const seedPagePath = urlToPagePath(baseUrl, seedUrl.toString());
    if (seedPagePath === null) {
        return [];
    }

    const visited = new Set<string>();
    const queue: string[] = [seedUrl.toString()];
    const discoveredPaths = new Set<string>([seedPagePath]);

    while (queue.length > 0 && visited.size < maxPages) {
        const currentUrlRaw = queue.shift()!;
        const currentUrl = new URL(currentUrlRaw);
        currentUrl.hash = '';
        const normalizedCurrentUrl = currentUrl.toString();

        if (visited.has(normalizedCurrentUrl)) {
            continue;
        }

        visited.add(normalizedCurrentUrl);

        let htmlContent: string;
        try {
            htmlContent = await fetchTextWithTimeout(normalizedCurrentUrl, requestTimeoutMs);
        } catch {
            continue;
        }

        const hrefs = extractHrefValues(htmlContent);
        for (const href of hrefs) {
            const absoluteUrl = toAbsoluteHttpUrl(href, normalizedCurrentUrl);
            if (!absoluteUrl) {
                continue;
            }

            const pagePath = urlToPagePath(baseUrl, absoluteUrl);
            if (pagePath === null) {
                continue;
            }
            if (isAssetOrFilePath(pagePath)) {
                continue;
            }

            discoveredPaths.add(pagePath);

            const normalizedAbsolute = new URL(absoluteUrl);
            normalizedAbsolute.hash = '';
            const normalizedAbsoluteRaw = normalizedAbsolute.toString();

            if (!visited.has(normalizedAbsoluteRaw)) {
                queue.push(normalizedAbsoluteRaw);
            }
        }
    }

    return [...discoveredPaths];
}

export async function expandCrawlPages(config: ConfigType): Promise<PageConfigurationType[]> {
    const configPages = config.pages ?? [];
    const baseUrl = new URL(config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`);
    const crawlMaxPages = config.crawlMaxPages ?? 500;
    const crawlRequestTimeoutMs = config.crawlRequestTimeoutMs ?? 15000;

    const expandedPages: PageConfigurationType[] = [];
    const existingPathPages = new Set<string>();

    for (const page of configPages) {
        if (!isCrawlPageConfigType(page)) {
            expandedPages.push(page);

            if (isUrlPathType(page)) {
                const normalizedPath = isHttpUrl(page) ? urlToPagePath(baseUrl, page) ?? page : page;
                existingPathPages.add(normalizedPath);
            } else {
                existingPathPages.add(page.path);
            }

            continue;
        }

        const crawledPages = await crawlPagesFromSeed(baseUrl, page.path, crawlMaxPages, crawlRequestTimeoutMs);
        console.info(`Crawl loaded from '${page.path}': ${crawledPages.length} page(s)`);

        for (const crawledPage of crawledPages) {
            if (existingPathPages.has(crawledPage)) {
                continue;
            }

            expandedPages.push(crawledPage);
            existingPathPages.add(crawledPage);
        }
    }

    return expandedPages;
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
