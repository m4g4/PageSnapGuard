import { Page } from "puppeteer"

export type ViewPortType = { width: number, height: number }

export type ConfigType = {
    headless: boolean,
    baseUrl: string,
    globalSelector: string,
    screenshotDir: string,
    baselineDir: string,
    diffDir: string,
    diffTresholdPct: number,
    staticPages: string[],
    viewPort: ViewPortType
}

export type TakeScreenshotFunction = (page: Page, filePath: string) => Promise<number>

export type ScreenType = {
    name: string,
    takeScreenshot: TakeScreenshotFunction
}

export type BatchType = {
    name: string,
    screens: () => ScreenType[]
}