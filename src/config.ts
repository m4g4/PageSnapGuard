import path from "path";
import { ConfigType } from "./types";

let config: ConfigType | undefined = undefined;

export function setConfig(cfg: ConfigType) {
    config = prepareConfig(cfg);
}

export function getConfig(): ConfigType {
    if (config === undefined)
        throw new Error('Config not defined!');

    return config;
}

const defaultConfig: Partial<ConfigType> = ({
    browser: 'chrome',
    browserPoolCount: 3,
    updateBaseline: false,
    verbose: false,
    browserArgs: [],
    navigationTimeoutMs: 60000,
    gotoWaitUntil: 'domcontentloaded',
    globalSelectorTimeoutMs: 10000,
    crawlMaxPages: 500,
    crawlRequestTimeoutMs: 15000,
    reportMode: 'changed',
    saveDiffs: 'changed',
    retryFailedPages: 3,
    failedSleepTimeMs: 0,
    pageTimeoutMs: 300000,
    captureFailedPage: false,
    failedScreenshotDir: './screenshots/failed/'
})

export function prepareConfig(cfg: ConfigType): ConfigType {
    const mergedConfig = {
        ...defaultConfig,
        ...cfg
    };

    return {
        ...mergedConfig,
        baselineDir: path.resolve(mergedConfig.baselineDir),
        screenshotDir: path.resolve(mergedConfig.screenshotDir),
        diffDir: path.resolve(mergedConfig.diffDir),
        failedScreenshotDir: path.resolve(mergedConfig.failedScreenshotDir ?? './screenshots/failed/')
    }
}
