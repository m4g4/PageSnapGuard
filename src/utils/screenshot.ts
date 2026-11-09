import sharp from 'sharp';
import fs from 'fs';
import { Page } from 'puppeteer';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { waitForAnimationsToEnd, waitForTimeout } from './utils.js';
import { ViewPortType } from '../types.js';

const SCROLL_SETTLE_TIMEOUT_MS = 1000;
const SCROLL_POLL_INTERVAL_MS = 25;
const SCROLL_STEP_DELAY_MS = 50;
const SCROLL_MAX_PASSES = 10;
const SCROLL_MAX_STEPS = 200;

const getScrollHeight = async (page: Page): Promise<number> => {
    return page.evaluate(() => Math.max(document.body.scrollHeight, document.documentElement.scrollHeight));
}

const readScrollPosition = async (page: Page): Promise<number> => {
    return page.evaluate(() => window.scrollY);
}

async function disableSmoothScrolling(page: Page): Promise<void> {
    await page.evaluate(() => {
        const styleId = '__page_snap_guard_scroll_style__';
        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = 'html, body, * { scroll-behavior: auto !important; }';
        document.head.appendChild(style);
    });
}

async function waitForScrollToSettle(page: Page): Promise<void> {
    // Poll from Node instead of relying on requestAnimationFrame: in headful
    // mode Chrome throttles/pauses rAF when the window is occluded or
    // backgrounded, which would otherwise hang forever.
    const deadline = Date.now() + SCROLL_SETTLE_TIMEOUT_MS;
    let lastY = await readScrollPosition(page);
    let stableReads = 0;

    while (Date.now() < deadline) {
        await waitForTimeout(SCROLL_POLL_INTERVAL_MS);
        const currentY = await readScrollPosition(page);

        if (currentY === lastY) {
            stableReads++;
            if (stableReads >= 2) {
                return;
            }
        } else {
            stableReads = 0;
            lastY = currentY;
        }
    }
}

async function scrollTo(page: Page, top: number): Promise<void> {
    await page.evaluate((top) => {
        window.scrollTo({ top, left: 0, behavior: 'auto' });
    }, top);
    await waitForScrollToSettle(page);
}

async function waitForImagesToLoad(page: Page, timeoutMs = 3000): Promise<void> {
    await page.evaluate((timeoutMs) => Promise.race([
        Promise.all(
            Array.from(document.images)
                .filter((img) => !img.complete)
                .map((img) => new Promise<void>((resolve) => {
                    img.addEventListener('load', () => resolve(), { once: true });
                    img.addEventListener('error', () => resolve(), { once: true });
                }))
        ),
        new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
    ]), timeoutMs);
}

async function scrollThroughPage(page: Page, viewPort: ViewPortType): Promise<void> {
    const step = Math.max(1, viewPort.height);

    for (let pass = 0; pass < SCROLL_MAX_PASSES; pass++) {
        const heightBefore = await getScrollHeight(page);
        let steps = 0;

        while (steps++ < SCROLL_MAX_STEPS) {
            const metrics = await page.evaluate(() => ({
                scrollTop: window.scrollY,
                scrollHeight: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight),
                viewportHeight: window.innerHeight
            }));

            if (metrics.scrollTop + metrics.viewportHeight >= metrics.scrollHeight - 1) {
                break;
            }

            const nextTop = Math.min(metrics.scrollTop + step, metrics.scrollHeight - metrics.viewportHeight);
            await scrollTo(page, nextTop);

            // If the window cannot scroll (e.g. content lives in a custom
            // scroll container), stop instead of looping over the same position.
            if (await readScrollPosition(page) <= metrics.scrollTop) {
                break;
            }

            await waitForTimeout(SCROLL_STEP_DELAY_MS);
        }

        const heightAfter = await getScrollHeight(page);
        if (heightAfter <= heightBefore) {
            break;
        }
    }
}

export async function takeScreenshot(page: Page, fileName: string, viewPort: ViewPortType): Promise<void> {
    await page.setViewport({ width: viewPort.width, height: viewPort.height });

    // Smooth scrolling and lazy content make a stitched screenshot non-deterministic.
    // Capture a single native full-page image instead so the layout is identical
    // between runs regardless of scroll timing.
    await disableSmoothScrolling(page);
    await waitForAnimationsToEnd(page);

    // Walk the whole page first to trigger lazy-loaded content, then return to the top.
    await scrollThroughPage(page, viewPort);
    await waitForImagesToLoad(page);
    await waitForAnimationsToEnd(page);
    await scrollTo(page, 0);

    await page.screenshot({ path: `${fileName}.png`, fullPage: true });
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

export type CompareScreenshotsResult = {
    differencePct: number,
    diffPng?: Buffer
}

function padToSize(image: PNG, width: number, height: number): PNG {
    if (image.width === width && image.height === height) {
        return image;
    }

    const padded = new PNG({ width, height });
    padded.data.fill(255);
    PNG.bitblt(image, padded, 0, 0, image.width, image.height, 0, 0);
    return padded;
}

export function compareScreenshots(newImagePath: string, baselineImagePath: string): CompareScreenshotsResult {
    const img1 = PNG.sync.read(fs.readFileSync(newImagePath));
    const img2 = PNG.sync.read(fs.readFileSync(baselineImagePath));

    // Pad both images to the same size so height/width changes are reported as
    // differences instead of being silently ignored.
    const width = Math.max(img1.width, img2.width);
    const height = Math.max(img1.height, img2.height);
    const a = padToSize(img1, width, height);
    const b = padToSize(img2, width, height);

    const diff = new PNG({ width, height });
    const numDiffPixels = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.1 });
    
    const diffPng = PNG.sync.write(diff);
    return {
        differencePct: (numDiffPixels / (width * height)) * 100,
        diffPng
    };
}
