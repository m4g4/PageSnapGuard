import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

import { all } from './batches/all.js';
import { getConfig, setConfig } from './config.js';
import { runBatches } from './batchRunner.js';
import { ConfigType } from './types.js';
import { prepareOutputDir, removeDirFiles } from './utils.js';

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
    }).parseSync();

    try {
        setConfig(loadConfig(argv.config));
    
    } catch (error) {
        console.error('Error loading config:', error);
        return;
    }

    const browser = await puppeteer.launch({ headless: getConfig().headless });
    const page = await browser.newPage();

    prepareOutputDirectories();

    try {
        await runBatches(page, all);
        console.log('Finished!');

    } catch (error) {
        console.error("Error during automation:", error);
    } finally {
        await browser.close();
    }
})();