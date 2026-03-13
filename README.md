# PageSnapGuard
PageSnapGuard is a visual regression and integration testing tool designed to protect the visual integrity of web applications. It allows you to capture, compare, and validate web pages over time, ensuring that unexpected UI changes are detected early.

## Features

- **Headless Browser Automation**: Automatically capture screenshots of web pages using Puppeteer, with or without a visible browser window.
- **Visual Regression Testing**: Compare the current state of a page to a baseline image to detect visual changes.
- **Customizable Viewport**: Set specific viewport dimensions to simulate different screen sizes for consistent testing.
- **Scroll-Based Screenshotting**: Capture long or dynamic web pages by scrolling and taking multiple screenshots.
- **Threshold-based Image Comparison**: Define a threshold to tolerate minor visual changes and avoid unnecessary test failures.
- **Flexible Configuration**: Easily configure the base URL, page paths, screenshot directories, and more via a JSON configuration file.
- **Baseline Update Mode**: Optionally overwrite baseline screenshots with newly captured screenshots.

## Technical Requirements

To use **PageSnapGuard**, you'll need the following:

### Prerequisites

1. **Node.js** (version 14 or higher)
    - Install from [nodejs.org](https://nodejs.org/)
2. **npm** (Node Package Manager)
    - npm comes bundled with Node.js. You can check the version using the command: `npm -v`
3. **Puppeteer** 
    - Puppeteer is required for browser automation. It will be automatically installed as part of the project’s dependencies.

### Installation

After you have Node.js and npm installed, follow these steps to set up **PageSnapGuard**:

1. **Clone the Repository**: 
    - Clone the GitHub repository to your local machine.
    ```bash
    git clone https://github.com/m4g4/PageSnapGuard.git
    ```

2. **Navigate to the Project Directory**:
    - Move into the project folder:
    ```bash
    cd PageSnapGuard
    ```

3. **Install Dependencies**:
    - Install the necessary Node.js packages:
    ```bash
    npm install
    ```

4. **Building PageSnapGuard**:
    - Compile and prepare the project for use:
    ```bash
    npm run build
    ```

4. **Running PageSnapGuard**:
    ```bash
    npm run capture -- --config config.json
    ```

   Enable detailed logs:
    ```bash
    npm run capture -- --config config.json --verbose
    ```

   Run multiple configurations one after another:
    ```bash
    npm run capture -- --config config.site-a.json
    npm run capture -- --config config.site-b.json
    ```


## Configuration

PageSnapGuard uses a JSON-based configuration to define the actions that should be executed in sequence. The following actions are supported:

### Supported Actions

1. **`click`**: Clicks on an element on the page based on the provided CSS selector.
   
2. **`wait`**: Waits for an element to appear on the page before continuing, based on the provided CSS selector.

3. **`type`**: Types a string into an input field specified by the CSS selector.

4. **`screenshot`**: Captures a screenshot and saves it using a unique screenshot ID.

### Action Types

- **`ClickActionValueType`**: A string representing a CSS selector. The action will click on the element matching the CSS selector.
- **`WaitActionValueType`**: A string representing a CSS selector. The action will wait for this element to appear before continuing.
- **`TypeActionValueType`**: An object containing:
  - `selector`: A string representing a CSS selector to target the input field.
  - `what`: A string representing the text to type into the input field.
- **`ScreenshotActionValueType`**: A string representing a screenshot ID. This will save the screenshot with this ID.
- **Crawl Page Entry**: An object with `path` and `"crawl": true` that discovers linked pages under `baseUrl`.
- **Optional `name`**: For object entries, you can add `"name"` to label the run output (useful when testing the same path with different actions).

### Example Configuration

Here's an example of how to set up a sequence of actions in the configuration file:

```json
{
  "browser": "chrome",
  "browserExecutablePath": "",
  "browserArgs": [],
  "verbose": false,
  "navigationTimeoutMs": 60000,
  "gotoWaitUntil": "domcontentloaded",
  "globalSelectorTimeoutMs": 10000,
  "crawlMaxPages": 500,
  "crawlRequestTimeoutMs": 15000,
  "headless": true,
  "baseUrl": "https://www.example.com",
  "globalSelector": ".main-content",
  "screenshotDir": "./screenshots/current/",
  "baselineDir": "./screenshots/baseline/",
  "diffDir": "./screenshots/diffs/",
  "updateBaseline": false,
  "diffTresholdPct": 1,
  "reportMode": "changed-first",
  "saveDiffs": "changed",
  "retryFailedPages": 3,
  "viewPort": { "width": 1280, "height": 840 },
  "pages": [
    {
      "name": "Login flow - variant A",
      "path": "login_page",
      "actions": [
        { "name": "wait", "value": "#login-form" }, 
        { "name": "type", "value": { "selector": "#username", "what": "testuser" } },
        { "name": "type", "value": { "selector": "#password", "what": "password123" } },
        { "name": "click", "value": "#login-button" },
        { "name": "wait", "value": "#dashboard" },
        { "name": "screenshot", "value": "dashboard-screenshot" }
      ]
    },
    {
      "path": "",
      "crawl": true,
      "includePathPattern": "contact/*",
      "excludePathPattern": "contact/version/*"
    }
  ]
}
```

`diffTresholdPct` controls which pages are considered "changed" (visually changed). Pages with a difference percentage below the threshold are treated as OK. Set it to `0` to treat any difference as changed.

`reportMode` controls what gets printed:
- `all`: print every tested page.
- `changed`: print only pages with diff >= `diffTresholdPct`.
- `changed-first`: print changed pages first, then all pages.

`saveDiffs` controls which diff images are written:
- `all`: save a diff image for every compared page.
- `changed`: save diffs only for pages with diff >= `diffTresholdPct`.
- `none`: never save diff images.

`retryFailedPages` controls how many attempts are made for a failing page. Minimum is `1` (no retries).

### Browser Configuration

- `"browser"`: `"chrome"` (default), `"firefox"`, or `"firefox-esr"`.
- `"browserExecutablePath"`: optional path to browser binary (for example `/usr/bin/firefox` or `/usr/bin/firefox-esr`).
- `"browserArgs"`: optional launch arguments array passed to Puppeteer.
- For `firefox`, use:
  - `"browser": "firefox"`
  - `"browserExecutablePath": "/usr/bin/firefox"`
- For `firefox-esr`, use:
  - `"browser": "firefox-esr"`
  - `"browserExecutablePath": "/usr/bin/firefox-esr"` (optional, used by default when omitted)

### Verbose Logging

- Set `"verbose": true` in config, or pass `--verbose` / `-v` in CLI.
- Verbose mode prints every processing step (page start/end, actions, comparisons, and baseline updates).

### Navigation Tuning

- `"navigationTimeoutMs"`: timeout for `page.goto(...)` in milliseconds (default `60000`).
- `"gotoWaitUntil"`: Puppeteer wait strategy for navigation. Allowed: `"load"`, `"domcontentloaded"`, `"networkidle0"`, `"networkidle2"` (default `"domcontentloaded"`).
- `"globalSelectorTimeoutMs"`: timeout for waiting on `globalSelector` after navigation (default `10000`).
- If you see frequent `Navigation timeout ... exceeded`, start with:
  - `"gotoWaitUntil": "domcontentloaded"`
  - `"navigationTimeoutMs": 90000` or higher
  - lower `"browserPoolCount"` to reduce concurrent load

### Crawl Configuration

- In `pages`, you can add crawl entries:
  - `{ "path": "", "crawl": true }` to crawl from root.
  - `{ "path": "blog", "crawl": true }` to crawl from `/blog`.
- Crawler follows only links under your configured `baseUrl`.
- `"crawlMaxPages"`: maximum pages discovered per crawl seed (default `500`).
- `"crawlRequestTimeoutMs"`: timeout per crawled page request (default `15000`).
- Crawl entries in `pages` can optionally define:
- `"includePathPattern"`: string or array of glob patterns to include when expanding that crawl seed.
- `"excludePathPattern"`: string or array of glob patterns to exclude for that crawl seed.
- Glob patterns support `*` (any characters) and `?` (single character). Examples: `"blog/*"`, `"docs/??/intro"`, `"*utm=*"`

### Baseline Update

- Set `"updateBaseline": true` in your config file to overwrite baseline images with current screenshots during a run.
- You can also enable it from CLI with `--update-baseline` (or `-u`), which overrides the config value for that run only.
