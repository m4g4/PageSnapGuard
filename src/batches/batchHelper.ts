import { createSimpleScreenshot } from "../screens/simpleScreen.js";
import { BatchType, ScreenType } from "../types.js";

export function createSimpleBatch(path: string): BatchType {
    return {
        name: path,
        screens: () => [createSimpleScreen(path)]
    }
}

export function createSimpleScreen(path: string): ScreenType {
    return {
        name: path,
        takeScreenshot: createSimpleScreenshot(path)
    }
}