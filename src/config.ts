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
    reportMode: 'all'
})

export function prepareConfig(cfg: ConfigType): ConfigType {
    return {
        ...defaultConfig,
        ...cfg,
        baselineDir: path.resolve(cfg.baselineDir),
        screenshotDir: path.resolve(cfg.screenshotDir),
        diffDir: path.resolve(cfg.diffDir)
    }
}
