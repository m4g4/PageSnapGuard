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
    pages: PageConfigurationType[],
    viewPort: ViewPortType,
    browserPoolCount: number
}

export type TakeScreenshotFunction = (page: Page, filePath: string) => Promise<void>

export type UrlPathType = string;

export type DynamicPageConfigType = {
    path: string,
    actions: ActionType[]
}

export type PageConfigurationType  = DynamicPageConfigType | UrlPathType;

export function isUrlPathType(config: PageConfigurationType): config is UrlPathType {
    return typeof config === 'string';
}

export type ScreenshotIdType = string;
export type CssSelectorType = string;

export type ActionType = {
    name: ActionNameType,
    value: ClickActionValueType | WaitActionValueType | TypeActionValueType | ScreenshotActionValueType;
};

export type ActionNameType = 'click' | 'wait' | 'type' | 'screenshot';

export type ClickActionValueType = CssSelectorType;
export type WaitActionValueType = CssSelectorType;
export type ScreenshotActionValueType = ScreenshotIdType; 
export type TypeActionValueType = {
    selector: string,
    what: string
};