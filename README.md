# PageSnapGuard
PageSnapGuard is a visual regression and integration testing tool designed to protect the visual integrity of web applications. It allows you to capture, compare, and validate web pages over time, ensuring that unexpected UI changes are detected early.

## Features

- **Headless Browser Automation**: Automatically capture screenshots of web pages using Puppeteer, with or without a visible browser window.
- **Visual Regression Testing**: Compare the current state of a page to a baseline image to detect visual changes.
- **Customizable Viewport**: Set specific viewport dimensions to simulate different screen sizes for consistent testing.
- **Scroll-Based Screenshotting**: Capture long or dynamic web pages by scrolling and taking multiple screenshots.
- **Threshold-based Image Comparison**: Define a threshold to tolerate minor visual changes and avoid unnecessary test failures.
- **Flexible Configuration**: Easily configure the base URL, page paths, screenshot directories, and more via a JSON configuration file.

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

4. **Running PageSnapGuard**:
    ```bash
    npm run capture
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

### Example Configuration

Here's an example of how to set up a sequence of actions in the configuration file:

```json
{
  "headless": true,
  "baseUrl": "https://www.example.com",
  "globalSelector": ".main-content",
  "screenshotDir": "./screenshots/current/",
  "baselineDir": "./screenshots/baseline/",
  "diffDir": "./screenshots/diffs/",
  "diffTresholdPct": 1,
  "viewPort": { "width": 1280, "height": 840 },
  "pages": [
    {
      "path": "login_page",
      "actions": [
        { "name": "wait", "value": "#login-form" }, 
        { "name": "type", "value": { "selector": "#username", "what": "testuser" } },
        { "name": "type", "value": { "selector": "#password", "what": "password123" } },
        { "name": "click", "value": "#login-button" },
        { "name": "wait", "value": "#dashboard" },
        { "name": "screenshot", "value": "dashboard-screenshot" }
      ]
    }
  ]
}
```