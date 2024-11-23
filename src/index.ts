import fs from 'fs';
import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

import { getConfig, setConfig } from './config.js';
import { closeBrowsers, processPages } from './pageProcessor.js';
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

    console.info('PageSnapGuard started...');

    prepareOutputDirectories();

    try {
        await Promise.all(processPages());

        closeBrowsers();

        console.info('PageSnapGuard finished succesfully!');

    } catch (error) {
        console.error("PageSnapGuard error:", error);
    }
})();