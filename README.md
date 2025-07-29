# Google Extension Test for LinkedIn

## Overview
This repository may switch between public and private at any time. This is a personal project designed to explore the capabilities and limitations of the extension.

LinkedIn's basic search functions are underwhelming, and I got tired of relying on Boolean searches while dealing with excessive promoted content in both the feed and job listings.

This extension is being developed to handle all of that.

Currently, promoted content is blocked by targeting containers labeled with **"Promoted"**, but I need to optimize performance, especially for users with older CPUs and limited RAM.

For now, please don't follow the project, as my focus may shift to other things.

Once again, this is just a personal project to test boundaries and see what’s possible.

---

## Project Goals & Stages
* **Dynamic Promoted Content Filter** – Implemented to dynamically detect and remove containers labeled **"Promoted."** This feature is largely complete (approx. 95-99%), with minor edge cases still under observation.
* **Navigation Support** – Achieved. The extension now functions consistently across various LinkedIn navigation events, not just on direct page load.
* **Toggle Switch** – Implemented and fully functional, including the main extension toggle, promoted content toggle, delay for manually hidden jobs, and custom filters toggle.
* **Automated Content Filtering (formerly "Automatic Boolean Searches" and "Dynamic Filtering")** – This feature now provides robust filtering based on custom exclusion lists for job titles, company names, and locations (city, state, and a new 'hard state' exclusion). Future enhancements will focus on expanding and refining these filtering capabilities to provide more granular control and potentially automate more complex search parameters beyond simple exclusions.

---

## Installation (For Testing Purposes) Chrome
1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer Mode** (toggle in the top right).
4. Click **Load Unpacked** and select the extension folder.
5. The extension should now appear in your browser.

---

## Known Issues & Limitations
- Filtering might not catch all promoted content if LinkedIn changes its ad structure.
- Performance optimization is still in progress for older systems.
- Boolean search automation is planned but not yet implemented.

---

## Update Process
Updates will be released in batches, with each section being worked on individually. New versions will only be published as specific features near completion.

---

## Planned Enhancements
- UI improvements for better user control.
- Expansion to support Safari and Firefox is planned for future stages, after more core functionalities are thoroughly completed and tested to minimize errors.

---

## License
This is a personal project and does not currently have a formal license. If that changes, the license details will be updated.

---

Once more features are completed, a more robust README and/or instruction file will be added.
