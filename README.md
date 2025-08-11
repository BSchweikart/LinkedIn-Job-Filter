# Google Extension Test for LinkedIn

> **TL;DR:**  
> A Chrome extension that improves LinkedIn by dynamically removing promoted content and providing customizable job filtering based on titles, companies, and locations. Features include navigation support, multiple toggles, and plans for expanded filters and cross-browser support. All data processing happens locally with no user data collected.

## Overview
This is a **personal, open-source Chrome extension** aimed at improving the LinkedIn experience by removing promoted content and providing advanced filtering options.  
LinkedIn’s default search tools are limited, and excessive promoted content clutters both the feed and job listings. This extension addresses those issues with dynamic filtering and enhanced navigation handling.

---

## Current Features

### 1. Dynamic Promoted Content Filter
- Detects and removes containers labeled **"Promoted"** from the LinkedIn feed and job listings.  
- Currently ~95–99% effective, with smaller, low-priority subsections intentionally excluded.  
- For remaining edge cases, see **Known Issues**.

---

### 2. Navigation Support
- Works across most LinkedIn pages and navigation events — not just on initial page load.  
- Handles dynamic content loading during browsing.  
- For rare navigation-related edge cases, see **Known Issues**.

---

### 3. User Controls & Toggles
The extension provides **four independent toggle switches**:  
1. **Enable/Disable Extension Entirely** – Quickly turn the extension on or off.  
2. **Hide Promoted Content** – Enable or disable the promoted content filter.  
3. **Delay Hiding Manually Hidden Jobs** – Adds a 5-second delay before hiding manually hidden job posts.  
4. **Enable Custom Filters** – Activates advanced filtering rules for job listings.

---

### 4. Automated Content Filtering (Custom Filters)
When **Custom Filters** are enabled, the extension filters job listings based on exclusion lists for:  
- **Title** – Hide jobs matching excluded keywords in the job title.  
- **Company** – Hide jobs from specific companies.  
- **City** – Hide jobs in excluded cities.  
- **State** – Hide jobs in excluded states.

**Special Case:**  
- **Hard State Exclusion** – Completely hides any job from specified states, bypassing other filtering logic. Implemented to address a scenario where the main logic worked *too* well.

For upcoming improvements to filtering and control options, see **Planned Enhancements**.

---

## Installation (Testing in Chrome)
1. Download or clone this repository.  
2. Open Chrome and go to `chrome://extensions/`.  
3. Enable **Developer Mode** (top right).  
4. Click **Load Unpacked** and select the extension folder.  
5. The extension will now appear in your browser.

---

## Known Issues

- **Promoted Content Detection** – In rare cases, small sub-sections of promoted content are not removed. These sections are intentionally excluded for now as they are not the primary focus of the extension.  
- **Navigation Edge Cases** – Occasionally, when starting a new search, the extension does not fire, causing promoted content or unfiltered jobs to appear. This issue is random, only occurs at the *start* of a search (not when navigating results), and is resolved by reloading the page. Attempts to fix it have caused timing conflicts, so there are no current plans to address it.  
- **Performance Disclaimer** – While developed on a slower computer, performance impact has been minimal. Filtering may be slightly slower on older CPUs or low-RAM systems during rapid scrolling or heavy navigation, but multiple optimizations have already been implemented.  
- **LinkedIn Structure Changes** – Any major change in LinkedIn’s HTML/CSS structure could temporarily break promoted content detection until the extension is updated.

---

## Development & Updates

- **Incremental Development:** Features are developed, tested, and refined individually to ensure stability before release.  
- **Batch Releases:** Updates are released in batches, with new versions published once specific features reach near-completion.  
- **Prioritization:** Development priorities may shift based on testing results, user feedback, emerging challenges, and available free time.  
- **Public Repository:** The project is public to maintain transparency and reassure users that no data is collected or sent externally; all processing and storage happen locally on the user’s machine.  
- **Issue Resolution:** Known issues are documented and addressed based on their impact and feasibility.  
- **Future Plans:** Major enhancements and expansions will be outlined in the **Planned Enhancements** section as development progresses.

---

## Planned Enhancements

- **User Interface Improvements:** Develop a more intuitive UI for easier control and configuration of filters and toggles.  
- **Expanded Filtering:** The next major update will introduce new filtering logic based on job location type — **On-Site, Hybrid, and Remote**. For example, users may exclude on-site or hybrid jobs in a location but remain open to remote jobs there. This feature will include a toggle to bypass the hard state exclusion filter during testing to optimize effectiveness.  
- **Cross-Browser Support:** Extend compatibility to **Safari, Firefox, Brave**, and explore support for other browsers once core Chrome functionality is stable and well-tested.  
- **Performance Optimization:** Continue refining the extension to improve speed and efficiency, especially on older or lower-spec systems.  
- **Robust Error Handling:** Implement better detection and recovery mechanisms for LinkedIn structure changes to minimize downtime after site updates.  
- **Documentation:** Provide detailed user guides and example configurations as features mature.

---

## License
This project is public but currently **unlicensed**. License details will be added if that changes.

---

Once core features are complete, a more detailed README and user guide will be added.
