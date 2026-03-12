import { Page } from "puppeteer"

export type ViewPortType = { width: number, height: number }
export type BrowserType = 'chrome' | 'firefox' | 'firefox-esr';
export type GotoWaitUntilType = 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';

export type ConfigType = {
    browser?: BrowserType,
    browserExecutablePath?: string,
    browserArgs?: string[],
    verbose?: boolean,
    navigationTimeoutMs?: number,
    gotoWaitUntil?: GotoWaitUntilType,
    globalSelectorTimeoutMs?: number,
    crawlMaxPages?: number,
    crawlRequestTimeoutMs?: number,
    headless: boolean,
    baseUrl: string,
    globalSelector: string,
    screenshotDir: string,
    baselineDir: string,
    diffDir: string,
    updateBaseline?: boolean,
    diffTresholdPct: number,
    reportMode?: 'all' | 'changed' | 'changed-first',
    saveDiffs?: 'all' | 'changed' | 'none',
    pages: PageConfigurationType[],
    viewPort: ViewPortType,
    browserPoolCount: number
}

export type TakeScreenshotFunction = (page: Page, filePath: string) => Promise<void>

export type UrlPathType = string;

export type DynamicPageConfigType = {
    path: string,
    name?: string,
    actions: ActionType[]
}

export type CrawlPageConfigType = {
    path: string,
    name?: string,
    crawl: boolean
}

export type PageConfigurationType  = DynamicPageConfigType | CrawlPageConfigType | UrlPathType;

export function isUrlPathType(config: PageConfigurationType): config is UrlPathType {
    return typeof config === 'string';
}

export function isCrawlPageConfigType(config: PageConfigurationType): config is CrawlPageConfigType {
    return typeof config === 'object' && config !== null && 'crawl' in config && config.crawl === true;
}

export type TimeMillisValueType = number;
export type ScreenshotIdType = string;
export type CssSelectorType = string;

export type ActionType = {
    name: ActionNameType,
    value: ClickActionValueType | WaitActionValueType | TypeActionValueType | ScreenshotActionValueType;
};

export type ActionNameType = 'click' | 'wait' | 'type' | 'screenshot';

export type ClickActionValueType = CssSelectorType;
export type WaitActionValueType = CssSelectorType | TimeMillisValueType;
export type ScreenshotActionValueType = ScreenshotIdType; 
export type TypeActionValueType = {
    selector: string,
    what: string
};

export function isTimeWait(value: WaitActionValueType): value is TimeMillisValueType {
    return typeof value === 'number';
}

export function isSelectorWait(value: WaitActionValueType): value is CssSelectorType {
    return typeof value === 'string';
}
