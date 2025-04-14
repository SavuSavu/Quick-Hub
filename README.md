# Quick-Hub

A centralized dashboard for accessing various web-based utilities and tools, built with vanilla HTML, CSS, and JavaScript.

## Features

*   **Unified Interface:** Provides a consistent look and feel across different tools.
*   **Dynamic Tool Loading:** Loads available tools and categories from `tools.json`.
*   **Tool Integration:** Supports embedding tools via iframes or linking to external URLs.
*   **Search Functionality:** Quickly find tools or categories.
*   **Responsive Design:** Adapts to different screen sizes.
*   **Dark Theme:** Uses a dark color scheme for comfortable viewing.

## Included Tools (Examples)

*   **BOMStorm:** Analyzes CycloneDX XML Software Bill of Materials (SBOMs).
*   **NetScan Pro (Simulation):** Simulates network tests like Ping, Latency, Trace Route, and DNS lookups.
*   **(Placeholders):** JSON Analyzer, Binary Analyzer, Network Scanner.

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
│ ├── index.html
│ └── scripts.js
├── NOT-PING/
│ ├── index.html
│ └── scripts.js
└── Binary-Analyzer/
└── index.html

## Running Locally

1.  Clone or download this repository.
2.  Open the main `index.html` file in your web browser.
    *   For full functionality (especially fetching `tools.json`), it's recommended to serve the files using a simple local web server (e.g., Python's `http.server`, Node.js's `serve` or `live-server`).
      *   Using Python: `python -m http.server` (Python 3) or `python -m SimpleHTTPServer` (Python 2) in the project root directory.
      *   Using Node.js/npm: `npx serve` or `npx live-server`.
3.  Navigate to the server address (e.g., `http://localhost:8000` or `http://127.0.0.1:8080`).

## Customization

Modify the `tools.json` file to add, remove, or update categories and tools. Ensure the `url` points to the correct path (for local iframe tools) or external website (for links). Icons use Bootstrap Icon class names (e.g., `bi-globe`).