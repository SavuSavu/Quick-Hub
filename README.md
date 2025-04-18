# Quick-Hub

A centralized dashboard for accessing various web-based utilities and tools, built with vanilla HTML, CSS, and JavaScript.

## Features

*   **Unified Interface:** Provides a consistent look and feel across different tools.
*   **Dynamic Tool Loading:** Loads available tools and categories from `tools.json`.
*   **Tool Integration:** Supports embedding tools via iframes or linking to external URLs.
*   **Auto-Load Vulnerability News:** Automatically displays real-time vulnerability data in a side panel on wider screens.
*   **Responsive Split-View Layout:** Adapts to screen size, showing both the dashboard and vulnerability feed side-by-side when space permits.
*   **Search Functionality:** Quickly find tools or categories.
*   **Dark Theme:** Uses a dark color scheme for comfortable viewing.

## Included Tools

*   **BOMStorm:** Analyzes CycloneDX XML Software Bill of Materials (SBOMs).
*   **NetScan Pro (NOT-PING):** Simulates network tests like Ping, Latency, Trace Route, and DNS lookups.
*   **Vulnews:** Real-time vulnerability intelligence aggregator from NVD and GitHub sources (auto-loads in side panel on wider screens).
*   **XSS Prober:** Test for reflected and DOM-based XSS vulnerabilities by injecting payloads into URLs and fragments.
*   **Quick Edit (QE):** Client-side code editor with Monaco, file/folder management, GitHub/URL import, and workspace ZIP download.

## Project Structure
Quick-Hub/
├── index.html # Main dashboard page
├── styles.css # Unified CSS styles
├── scripts.js # Main dashboard JavaScript
├── tools.json # Data file defining tools and categories
├── README.md # This file
├── ProjectNotes.md # Development notes
└── tools/ # Directory containing individual tools
    ├── BOMStorm/
    │   ├── index.html
    │   └── scripts.js
    ├── NOT-PING/
    │   ├── index.html
    │   └── scripts.js
    ├── NVD_News/
    │   ├── index.html
    │   ├── results-only.html # Streamlined view for side panel display
    │   ├── css/
    │   └── js/
    ├── Maybe_My_XSS/
    │   ├── index.html
    │   └── app.js
    └── QE/
        ├── index.html
        ├── scripts.js
        ├── style.css
        ├── projectNotes.md
        └── tasks.md

## Running Locally

1.  Clone or download this repository.
2.  Open the main `index.html` file in your web browser.

## Customization

Modify the `tools.json` file to add, remove, or update categories and tools. Ensure the `url` points to the correct path (for local iframe tools) or external website (for links). Icons use Bootstrap Icon class names (e.g., `bi-globe`).