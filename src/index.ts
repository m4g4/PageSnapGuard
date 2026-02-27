import fs from 'fs';
import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

import { getConfig, setConfig } from './config.js';
import { closeBrowsers, processPages, PageProcessResult, pruneStaleBaselineFiles } from './pageProcessor.js';
import { ConfigType } from './types.js';
import { prepareOutputDir, removeDirFiles } from './utils/utils.js';

function loadConfig(filePath: string): ConfigType {
    const configFilePath = path.resolve(filePath);
    if (!fs.existsSync(configFilePath)) {
      throw new Error(`Configuration file not found: ${configFilePath}`);
    }
  
    const rawConfig = fs.readFileSync(configFilePath, 'utf-8');
    const config: ConfigType = JSON.parse(rawConfig);
  
    return config;
}

function prepareOutputDirectories() {
    prepareOutputDir(getConfig().baselineDir);
    prepareOutputDir(getConfig().screenshotDir);
    prepareOutputDir(getConfig().diffDir);

    removeDirFiles(getConfig().screenshotDir);
    removeDirFiles(getConfig().diffDir);
}

(async () => {
    
    const argv = yargs(hideBin(process.argv)).option('config', {
        alias: 'c',
        description: 'Path to configuration JSON file',
        type: 'string',
        demandOption: true,
    }).option('update-baseline', {
        alias: 'u',
        description: 'Replace baseline screenshots with current screenshots',
        type: 'boolean',
    }).parseSync();

    try {
        const loadedConfig = loadConfig(argv.config);

        setConfig({
            ...loadedConfig,
            updateBaseline: argv.updateBaseline ?? loadedConfig.updateBaseline
        });
    
    } catch (error) {
        console.error('Error loading config:', error);
        return;
    }

    console.info('PageSnapGuard started...');

    prepareOutputDirectories();

    let results: PageProcessResult[] = [];

    try {
        results = await Promise.all(processPages());
    } catch (error) {
        console.error("PageSnapGuard error:", error);
    } finally {
        try {
            closeBrowsers();
        } catch (error) {
            console.error("Failed closing browsers:", error);
        }
    }

    const failedPages = results.filter(r => !r.success);

    if (failedPages.length > 0) {
        for (const failedPage of failedPages) {
            console.error(`Page failed: ${failedPage.pageUrl} - ${failedPage.error}`);
        }

        console.error(`PageSnapGuard finished with errors. Failed pages: ${failedPages.length}/${results.length}`);
        process.exitCode = 1;
        return;
    }

    if (getConfig().updateBaseline) {
        pruneStaleBaselineFiles();
    }

    console.info('PageSnapGuard finished succesfully!');
})();
