
import { getConfig } from '../config.js';
import { BatchType } from '../types.js';
import { createSimpleScreen } from './batchHelper.js';

export const staticPagesBatch: BatchType = {
    name: 'static',
    screens: () => getConfig().staticPages.map(path => createSimpleScreen(path))
}