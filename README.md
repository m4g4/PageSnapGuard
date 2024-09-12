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
    git clone https://github.com/your-username/PageSnapGuard.git
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
    npm run start
    ```

### Configuration

Before running the tool, you need to create a JSON configuration file to define which pages to capture and compare. Here's an example configuration file (`config.json`):

```json
{
    "headless": true, 
    "baseUrl": "https://www.wordpress.org/",
    "globalSelector": ".page",
    "screenshotDir": "./screenshots/current/",
    "baselineDir": "./screenshots/baseline/",
    "diffDir": "./screenshots/diffs/",
    "diffTresholdPct": 1,
    "viewPort": { "width": 1280, "height": 840 },
    "staticPages": [
        "", 
        "news"
    ]
}
