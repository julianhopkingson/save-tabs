# Save Tabs

> Chrome extension for securely saving and recovering tab sessions

A modern, lightweight, and blazing-fast Chrome extension built with Vanilla JS & CSS. It allows you to effortlessly manage your browser sessions by viewing recently closed tabs, and securely saving or recovering your entire window's tab state.

## Features

- 🕒 **Recently Closed Tabs**: Instantly view and reopen your recently closed tabs from a sleek, scrollable list.
- 💾 **Save Current Session**: One-click save your entire current window's tabs, including their grouped states and pinned statuses.
- 🔄 **Crash-Safe Recovery**: Seamlessly restore your saved session. Our secure recovery engine ensures your new tabs and groups are fully reconstructed before safely closing the old ones, preventing browser crashes.
- 🎨 **Modern Glassmorphism UI**: Beautifully designed popup with a frosted glass dock and auto-adapting Light/Dark mode.
- 🪶 **Zero Dependencies**: Built entirely with native web APIs—no heavy frameworks, resulting in instant load times and a tiny footprint.

## Installation

1. Clone this repository or download the source code:
   ```bash
   git clone https://github.com/julianhopkingson/save-tabs.git
   ```
2. Open your Google Chrome browser and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click on **Load unpacked** in the top left corner.
5. Select the `save-tabs` directory.

## Usage

- **Options**: Right-click the extension icon and select "Options" to configure the maximum number of recent sessions displayed in the popup.
- **Popup Dock**:
  - `History`: Opens the native Chrome History page.
  - `Save`: Takes a snapshot of your current tabs and groups.
  - `Recover`: Replaces your current window with the previously saved snapshot (prompts for confirmation).

## Technical Architecture

This extension follows the KISS (Keep It Simple, Stupid) principle.
- Uses `chrome.sessions` to retrieve recently closed items.
- Uses `chrome.storage.local` to store the large JSON snapshot of the session.
- Uses `chrome.storage.sync` for lightweight user preferences.
- Uses native `chrome.tabs` and `chrome.tabGroups` APIs with a fail-safe asynchronous execution flow for session restoration.
