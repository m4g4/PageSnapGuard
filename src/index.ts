import path from 'path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

import { getConfig, setConfig } from './config.js';
import { closeBrowsers, processPages, PageProcessResult, pruneStaleBaselineFiles } from './pageProcessor.js';
import { prepareOutputDir, removeDirFiles, loadConfig, expandCrawlPages } from './utils/utils.js';

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
    process.exitCode = 1;
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    process.exitCode = 1;
});

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
    }).option('verbose', {
        alias: 'v',
        description: 'Print detailed step-by-step logs',
        type: 'boolean',
    }).option('update-baseline', {
        alias: 'u',
        description: 'Replace baseline screenshots with current screenshots',
        type: 'boolean',
    }).parseSync();

    try {
        const loadedConfig = loadConfig(argv.config);
        const pagesAfterCrawl = await expandCrawlPages(loadedConfig);

        if (pagesAfterCrawl.length !== loadedConfig.pages.length) {
            console.info(`Pages after crawl expansion: ${pagesAfterCrawl.length}`);
        }

        setConfig({
            ...loadedConfig,
            pages: pagesAfterCrawl,
            verbose: argv.verbose ?? loadedConfig.verbose,
            updateBaseline: argv.updateBaseline ?? loadedConfig.updateBaseline
        });
    
    } catch (error) {
        console.error('Error loading config:', error);
        return;
    }

    console.info('PageSnapGuard started...');
    console.info(`Config: ${path.resolve(argv.config)}`);
    if (getConfig().verbose) {
        console.info(`Browser: ${getConfig().browser}, Headless: ${getConfig().headless}, Pages: ${getConfig().pages.length}, Update baseline: ${getConfig().updateBaseline}, Verbose: ${getConfig().verbose}`);
        console.info(`Navigation: waitUntil=${getConfig().gotoWaitUntil}, navTimeout=${getConfig().navigationTimeoutMs}ms, selectorTimeout=${getConfig().globalSelectorTimeoutMs}ms`);
    }

    if (getConfig().pages.length === 0) {
        console.error('No pages configured. Add at least one entry to "pages" in the config file.');
        process.exitCode = 1;
        return;
    }

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
    const succeededPages = results.length - failedPages.length;
    const diffThresholdPct = getConfig().diffTresholdPct ?? 0;
    const reportMode = getConfig().reportMode ?? 'all';
    const visualDiffPages = results.filter(r =>
        r.success &&
        typeof r.differencePct === 'number' &&
        r.differencePct >= diffThresholdPct
    );

    const renderPageResult = (result: PageProcessResult): string | null => {
        if (!result.success) {
            return `- ${result.pageUrl}: failed (${result.error})`;
        }

        if (typeof result.differencePct !== 'number') {
            return `- ${result.pageUrl}: n/a`;
        }

        return `- ${result.pageUrl}: ${result.differencePct.toFixed(2)}%`;
    };

    const renderChangedResult = (result: PageProcessResult): string | null => {
        if (!result.success) {
            return null;
        }

        if (typeof result.differencePct !== 'number') {
            return null;
        }

        if (result.differencePct < diffThresholdPct) {
            return null;
        }

        return `- ${result.pageUrl}: ${result.differencePct.toFixed(2)}%`;
    };

    console.info(`Diff threshold: ${diffThresholdPct.toFixed(2)}%`);

    if (reportMode === 'changed' || reportMode === 'changed-first') {
        console.info(`Changed pages (>= ${diffThresholdPct.toFixed(2)}%):`);
        const changedLines = results.map(renderChangedResult).filter(Boolean) as string[];
        if (changedLines.length === 0) {
            console.info('- none');
        } else {
            for (const line of changedLines) {
                console.info(line);
            }
        }
    }

    if (reportMode === 'all' || reportMode === 'changed-first') {
        console.info('All pages:');
        const allLines = results.map(renderPageResult).filter(Boolean) as string[];
        for (const line of allLines) {
            console.info(line);
        }
    }

    if (failedPages.length > 0) {
        for (const failedPage of failedPages) {
            console.error(`Page failed: ${failedPage.pageUrl} - ${failedPage.error}`);
        }

        console.info(`Page processing summary: success=${succeededPages}, failed=${failedPages.length}, total=${results.length}`);
        console.error(`PageSnapGuard finished with errors. Failed pages: ${failedPages.length}/${results.length}`);
        process.exitCode = 1;
        return;
    }

    if (getConfig().updateBaseline) {
        pruneStaleBaselineFiles();
    }

    if (reportMode === 'all') {
        if (visualDiffPages.length > 0) {
            console.info(`Visual changes >= ${diffThresholdPct.toFixed(2)}%: ${visualDiffPages.length}`);
        } else {
            console.info(`Visual changes >= ${diffThresholdPct.toFixed(2)}%: 0`);
        }
    }

    console.info(`Page processing summary: success=${succeededPages}, failed=${failedPages.length}, total=${results.length}`);
    console.info('PageSnapGuard finished succesfully!');
})();
