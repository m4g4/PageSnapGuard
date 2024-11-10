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
    browserPoolCount: 3
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