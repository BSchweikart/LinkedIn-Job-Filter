// console.log("Content script is running!"); // Keep original log if desired

let extensionEnabled = false; // Default to false
let debounceTimeoutId = null;
const debounceDelay = 200; // Adjust as needed
let hasLoggedInfo = false;
let currentUrl = null;

// --- Helper function to get extensionEnabled state ---
function isExtensionEnabled(callback) {
    chrome.storage.local.get('extensionEnabled', (data) => {
        const enabled = data.extensionEnabled === true;
        callback(enabled);
    });
}

function logExtensionInfo() {
    chrome.storage.local.get('extensionEnabled', (data) => {
        const shouldHide = data.extensionEnabled === true;
        console.log("Extension state:", shouldHide ? "On" : "Off");
        console.log("Current Webpage:", window.location.href);

        if (window.location.href.startsWith('https://www.linkedin.com/jobs/search') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
            console.log("Current Function:", "processSearchPageJobs"); // Update log
        } else if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
             console.log("Current Function:", "processHomePageJobs"); // Update log
        } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
            console.log("Current Function:", "processFeed");
        }
    });
}

function initialize() {
    setupGlobalObserver();
    // Initial processing will be done by the event listeners
}

// --- Home Page Feed Logic ---
function hidePromotedFeedItem(feedPost) {
    const promotedMeta = feedPost.querySelector('.update-components-actor__meta');
    if (promotedMeta) {
        const promotedSpan = promotedMeta.querySelector('.update-components-actor__sub-description > span[aria-hidden="true"]');
        if (promotedSpan && promotedSpan.textContent.trim() === 'Promoted') {
            if (feedPost && feedPost.style.display !== 'none') {
                 // LAW 1 Adherence: Using display: none for hiding promoted feed items
                feedPost.style.display = 'none';
                return true;
            }
        }
    }
    return false;
}

function processFeed() {
    const feedItems = document.querySelectorAll('.feed-shared-update-v2');
    isExtensionEnabled(enabled => {
        if (enabled) {
            feedItems.forEach(item => {
                hidePromotedFeedItem(item); // LAW 1
            });
        }
    });
}

// --- Promoted Job Hiding Logic (Handles Promoted and Manual Hide/Delay - Laws 1, 2, 3) ---
// This function is called by both processSearchPageJobs and processHomePageJobs
function hidePromotedJobCard(jobCardLi) {
    // Keep the existing logic for hiding promoted job cards
     const promotedFooterItems = jobCardLi.querySelectorAll('.job-card-container__footer-item');
    if (promotedFooterItems) {
        for (const footerItem of promotedFooterItems) {
            const promotedSpan = footerItem.querySelector('span[dir="ltr"]');
            if (promotedSpan && promotedSpan.textContent.trim().toLowerCase() === 'promoted') {
                if (jobCardLi && jobCardLi.style.display !== 'none') {
                    jobCardLi.dataset.originalDisplay = jobCardLi.style.display || '';
                    jobCardLi.style.display = 'none'; // LAW 1 Adherence
                    return true;
                }
            }
        }
    }

    const hiddenByUserFooter = jobCardLi.querySelector('.job-card-container__footer-item--highlighted');
    const isBeingDelayed = jobCardLi.dataset.delayHide === 'true';

    if (hiddenByUserFooter && hiddenByUserFooter.textContent.trim() === 'We won’t show you this job again.') {
        if (!isBeingDelayed && jobCardLi.style.display !== 'none') {
            chrome.storage.local.get('delayUserHiddenEnabled', (data) => {
                const shouldDelay = data.delayUserHiddenEnabled === true;
                if (shouldDelay) {
                    jobCardLi.dataset.delayHide = 'true';
                    setTimeout(() => {
                        if (jobCardLi && jobCardLi.dataset.delayHide === 'true') {
                             // LAW 2 Adherence: Hiding after delay
                            jobCardLi.dataset.originalDisplay = jobCardLi.style.display || '';
                            jobCardLi.style.display = 'none';
                        }
                        delete jobCardLi.dataset.delayHide;
                    }, 5000);
                } else {
                    // LAW 2 Adherence: Hiding immediately if no delay
                    jobCardLi.dataset.originalDisplay = jobCardLi.style.display || '';
                    jobCardLi.style.display = 'none';
                }
            });
            return true; // Still mark as found
        }
        return true; // Still mark as found even if already hidden or delaying
    } else if (isBeingDelayed) {
        // The "We won’t show you this job again." message is gone, but we were delaying.
        // This means it was likely unhidden. Cancel the hide.
         // LAW 3 Adherence: Handling manual unhiding during delay
        delete jobCardLi.dataset.delayHide;
        if (jobCardLi.dataset.originalDisplay) {
            jobCardLi.style.display = jobCardLi.dataset.originalDisplay || '';
            delete jobCardLi.dataset.originalDisplay;
        } else if (jobCardLi.style.display === 'none') {
            jobCardLi.style.display = ''; // Try to restore if no original display was set
        }
    } else if (jobCardLi && jobCardLi.dataset.originalDisplay && jobCardLi.style.display === 'none' && !jobCardLi.classList.contains('linkedin-job-filter-hidden')) {
         // If it was hidden by this function previously and the message is gone, ensure it's visible UNLESS it's hidden by our custom filter
        jobCardLi.style.display = jobCardLi.dataset.originalDisplay || '';
        delete jobCardLi.dataset.originalDisplay;
    }

    return false; // Not a promoted or manually hidden job handled by this function
}

// --- Dedicated Function for Search/Collections Pages ---
function processSearchPageJobs(filterData) {
	const jobListContainer = document.querySelector('div.scaffold-layout__list');
	if (!jobListContainer) return;
	const jobItems = jobListContainer.querySelectorAll('li.scaffold-layout__list-item');
	if (!jobItems || jobItems.length === 0) return;

	const shouldEnableFilters = filterData.enableJobFilters;
	const excludedTitles = filterData.excludedTitles.map(s => s.toLowerCase());
	const excludedLocationsState = filterData.excludedLocationsState.map(s => s.toLowerCase());
	const excludedLocationsCity = filterData.excludedLocationsCity.map(s => s.toLowerCase());
	const excludedCompanies = filterData.excludedCompanies.map(s => s.toLowerCase());

	const statesTriggeringRule2Hide = new Set(); // To collect states where Rule 2 hide part was triggered

	// --- First Pass (Search Page): Determine initial hide/show based on rules (excluding Rule 2's show part) ---
	jobItems.forEach(item => {
		hidePromotedJobCard(item); // Keep existing promoted job hiding (LAW 1, handles manual hide/delay Laws 2/3)

		if (shouldEnableFilters) {
			// --- Get job details from the DOM (Search Page Specific Extraction) ---
			const jobTitleElement = item.querySelector('a.job-card-list__title--link strong');
			const jobLocationElement = item.querySelector('ul.job-card-container__metadata-wrapper li span');
			const jobCompanyElement = item.querySelector('div.artdeco-entity-lockup__subtitle span');
			const jobCardContainer = item.querySelector('div.job-card-container');

			const jobTitle = jobTitleElement ? jobTitleElement.textContent.trim().toLowerCase() : '';
			const originalJobLocationText = jobLocationElement ? jobLocationElement.textContent.trim() : ''; // Capture original text for flexible matching
			const jobCompany = jobCompanyElement ? jobCompanyElement.textContent.trim().toLowerCase() : '';


			// Parse location string for city and state with improved robustness for various formats
			let cityFromLocation = '';
			let stateFromLocation = '';
            let countryFromLocation = ''; // Also capture country

			if (originalJobLocationText) {
				const parts = originalJobLocationText.split(',').map(part => part.trim().toLowerCase());

                if (parts.length === 1) {
                    // Case: "State Name" or "City Name" - Ambiguous, prioritize state match if possible
                    const singlePart = parts[0];
                     // We'll rely on the enhanced isStateExcluded check below to handle single-part state names
                    cityFromLocation = singlePart; // Assume it's a city for parsing baseline
                    stateFromLocation = singlePart; // Also treat as state for potential match
                } else if (parts.length === 2) {
                    // Case: "City, State" or "State, Country"
                    const part1 = parts[0];
                    const part2 = parts[1];

                    // Assume "City, State" is most common
                    cityFromLocation = part1;
                    stateFromLocation = part2; // Could be state name or abbr

                    // If part2 looks like a country, then part1 is likely the state
                    // Using a simple list of common countries for this check
                    if (['united states', 'usa', 'canada', 'uk', 'united kingdom'].includes(part2)) {
                         stateFromLocation = part1; // Re-assign state
                         cityFromLocation = ''; // No city in this format
                         countryFromLocation = part2;
                    }

                } else if (parts.length > 2) {
                    // Case: "City, State, Country" or other complex formats
                    // Assume last part is country, second to last is state, rest is city
                    countryFromLocation = parts[parts.length - 1];
                    stateFromLocation = parts[parts.length - 2];
                    cityFromLocation = parts.slice(0, parts.length - 2).join(', ').trim(); // Join city parts if multiple
                }
			}


			let shouldHideByFilter = false;

			// State Exclusion Check (Enhanced for Search Page to handle full names and variations)
            const isStateExcluded = excludedLocationsState.some(excludedState => {
                const excludedStateLower = excludedState.toLowerCase();
                // Check if the parsed state matches the excluded state exactly (abbr or full name)
                if (stateFromLocation === excludedStateLower) return true;

                // Check if the original job location string includes the excluded state (full name or abbr)
                 if (originalJobLocationText && originalJobLocationText.toLowerCase().includes(excludedStateLower)) return true;

                 // Check if the parsed city (in the case of single-part locations) matches an excluded state
                 // This prevents hiding unrelated cities that share names with states unless they are the *parsed city* AND match an excluded state
                 const locationParts = originalJobLocationText ? originalJobLocationText.split(',').map(part => part.trim()) : [];
                 if (locationParts.length === 1) {
                     if (excludedLocationsState.includes(locationParts[0].toLowerCase())) return true;
                 }

                return false; // Not excluded by state
            });


			const isCityExcluded = excludedLocationsCity.some(city => {
                const cityLower = city.trim().toLowerCase();
                // Check if the parsed city includes the excluded city
                 if (cityFromLocation.includes(cityLower)) return true;
                // Check if the original job location string includes the excluded city
                 if (originalJobLocationText && originalJobLocationText.toLowerCase().includes(cityLower)) return true;
                 return false;
            });


			let shouldHideByLocation = false;

			// --- Apply Location Filtering Rules (Revised Order for First Pass) ---

			// Rule 2 Hide Part: If state is excluded AND city is excluded, hide
			if (isStateExcluded && isCityExcluded) {
				shouldHideByLocation = true;
				// Add parsed state or attempt to find state from original text for Rule 2 set
                if(stateFromLocation) {
                    statesTriggeringRule2Hide.add(stateFromLocation); // Use parsed state if available
                } else if (originalJobLocationText && isStateExcluded) { // Fallback if parsed state empty but check passed
                    const matchedState = excludedLocationsState.find(es => originalJobLocationText.toLowerCase().includes(es));
                    if(matchedState) statesTriggeringRule2Hide.add(matchedState); // Add the state that caused the exclusion
                }
			}
			// Rule 3: If city is excluded AND state is NOT excluded, show
			else if (isCityExcluded && !isStateExcluded) {
				shouldHideByLocation = false; // Explicitly show
			}
			// Rule 1 & Implicit Rule: If state is excluded AND city is NOT excluded
			else if (isStateExcluded && !isCityExcluded) {
				// Check if the excluded city list is empty for Rule 1 fallback
				if (excludedLocationsCity.length === 0) {
					shouldHideByLocation = true; // Rule 1: Hide
				} else {
					shouldHideByLocation = false; // Implicit Rule: Show
				}
			}
			// If neither state nor city is excluded, it will default to shouldHideByLocation = false (show)


			// Apply Title and Company Filters
			const isTitleExcluded = excludedTitles.some(title => jobTitle.includes(title));
			const isCompanyExcluded = excludedCompanies.some(company => jobCompany.includes(company));

			// Combine location and other filters for the initial hide/show decision
			if (shouldHideByLocation === true) { // If location rule explicitly says hide
				shouldHideByFilter = true;
			} else if (shouldHideByLocation === false) { // If location rule explicitly says show (Rule 3 or Implicit Rule)
				// Ensure shouldHideByFilter is false unless title/company overrides
				if (!isTitleExcluded && !isCompanyExcluded) {
					shouldHideByFilter = false;
				} else {
					shouldHideByFilter = true; // Title or company exclusion overrides showing based on location
				}
			} else { // If location rules didn't explicitly say hide or show (neither state nor city excluded)
				// Base hide solely on title/company
				if (!isTitleExcluded && !isCompanyExcluded) {
					shouldHideByFilter = false;
				} else {
					shouldHideByFilter = true;
				}
			}


			// Apply initial hide/show based on shouldHideByFilter
			const itemToModify = item;
			const jobCardContainerToModify = jobCardContainer;

			if (shouldHideByFilter) {
				if (itemToModify && itemToModify.style.display !== 'none') {
					itemToModify.dataset.originalDisplay = itemToModify.style.display || '';
					itemToModify.style.display = 'none'; // LAW 1 Adherence: Using display: none for hiding
					itemToModify.classList.add('linkedin-job-filter-hidden'); // LAW 1 Adherence: Using the designated class
				}
				if (jobCardContainerToModify && jobCardContainerToModify.style.display !== 'none') {
					jobCardContainerToModify.dataset.originalDisplay = jobCardContainerToModify.dataset.originalDisplay || '';
					jobCardContainerToModify.style.display = 'none'; // LAW 1 Adherence: Using display: none for hiding
					jobCardContainerToModify.classList.add('linkedin-job-filter-hidden'); // LAW 1 Adherence: Using the designated class
				}
			} else {
				// Ensure it's visible if not filtered in this pass (and not manually hidden/delayed)
				const isBeingDelayed = itemToModify.dataset.delayHide === 'true';
				const hiddenByUserFooter = itemToModify.querySelector('.job-card-container__footer-item--highlighted');
				const isManuallyHidden = hiddenByUserFooter && hiddenByUserFooter.textContent.trim() === 'We won’t show you this job again.';

				if (!isBeingDelayed && !isManuallyHidden) { // Only ensure visible if not manually hidden or being delayed
					if (itemToModify && itemToModify.classList.contains('linkedin-job-filter-hidden')) { // LAW 1 Adherence: Checking for the designated class to determine hidden state
						itemToModify.style.display = itemToModify.dataset.originalDisplay || '';
						itemToModify.classList.remove('linkedin-job-filter-hidden'); // LAW 1 Adherence: Removing designated class for showing
						delete itemToModify.dataset.originalDisplay;
					}
					if (jobCardContainerToModify && jobCardContainerToModify.classList.contains('linkedin-job-filter-hidden')) { // LAW 1 Adherence: Checking for the designated class
						jobCardContainerToModify.style.display = jobCardContainerToModify.dataset.originalDisplay || '';
						jobCardContainerToModify.classList.remove('linkedin-job-filter-hidden'); // LAW 1 Adherence: Removing designated class
						delete jobCardContainerToModify.dataset.originalDisplay;
					}
				}
			}
		}
	});

	// --- Second Pass (Search Page): Implement Rule 2's "show others in state" based on statesTriggeringRule2Hide ---
	if (shouldEnableFilters && statesTriggeringRule2Hide.size > 0 && jobItems.length > 0) {
		jobItems.forEach(item => {
			// --- Get job details from the DOM (Search Page Specific Extraction - Redundant but safe) ---
			const jobLocationElement = item.querySelector('ul.job-card-container__metadata-wrapper li span'); // Get location element again
            const jobTitleElement = item.querySelector('a.job-card-list__title--link strong'); // Get title element again
            const jobCompanyElement = item.querySelector('div.artdeco-entity-lockup__subtitle span'); // Get company element again


			const jobCardContainer = item.querySelector('div.job-card-container'); // Get container again

			const originalJobLocationText = jobLocationElement ? jobLocationElement.textContent.trim() : ''; // Capture original text
            const jobTitle = jobTitleElement ? jobTitleElement.textContent.trim().toLowerCase() : ''; // Re-extract title
            const jobCompany = jobCompanyElement ? jobCompanyElement.textContent.trim().toLowerCase() : ''; // Re-extract company


			// Parse location string for city and state with improved robustness for various formats
			let cityFromLocation = '';
			let stateFromLocation = '';
            let countryFromLocation = ''; // Also capture country

			if (originalJobLocationText) {
				const parts = originalJobLocationText.split(',').map(part => part.trim().toLowerCase());

                if (parts.length === 1) {
                    // Case: "State Name" or "City Name" - Ambiguous, prioritize state match if possible
                    const singlePart = parts[0];
                     // We'll rely on the enhanced isStateExcluded check below to handle single-part state names
                    cityFromLocation = singlePart; // Assume it's a city for parsing baseline
                    stateFromLocation = singlePart; // Also treat as state for potential match
                } else if (parts.length === 2) {
                    // Case: "City, State" or "State, Country"
                    const part1 = parts[0];
                    const part2 = parts[1];

                    // Assume "City, State" is most common
                    cityFromLocation = part1;
                    stateFromLocation = part2; // Could be state name or abbr

                    // If part2 looks like a country, then part1 is likely the state
                    // Using a simple list of common countries for this check
                    if (['united states', 'usa', 'canada', 'uk', 'united kingdom'].includes(part2)) {
                         stateFromLocation = part1; // Re-assign state
                         cityFromLocation = ''; // No city in this format
                         countryFromLocation = part2;
                    }

                } else if (parts.length > 2) {
                    // Case: "City, State, Country" or other complex formats
                    // Assume last part is country, second to last is state, rest is city
                    countryFromLocation = parts[parts.length - 1];
                    stateFromLocation = parts[parts.length - 2];
                    cityFromLocation = parts.slice(0, parts.length - 2).join(', ').trim(); // Join city parts if multiple
                }
			}


			// State Exclusion Check (Enhanced for Search Page - same as first pass)
            const isStateExcluded = excludedLocationsState.some(excludedState => {
                const excludedStateLower = excludedState.toLowerCase();
                // Check if the parsed state matches the excluded state exactly (abbr or full name)
                if (stateFromLocation === excludedStateLower) return true;

                // Check if the original job location string includes the excluded state (full name or abbr)
                 if (originalJobLocationText && originalJobLocationText.toLowerCase().includes(excludedStateLower)) return true;

                 // Check if the parsed city (in the case of single-part locations) matches an excluded state
                 // This prevents hiding unrelated cities that share names with states unless they are the *parsed city* AND match an excluded state
                 const locationParts = originalJobLocationText ? originalJobLocationText.split(',').map(part => part.trim()) : [];
                 if (locationParts.length === 1) {
                     if (excludedLocationsState.includes(locationParts[0].toLowerCase())) return true;
                 }

                return false; // Not excluded by state
            });


			const isCityExcluded = excludedLocationsCity.some(city => {
                const cityLower = city.trim().toLowerCase();
                // Check if the parsed city includes the excluded city
                 if (cityFromLocation.includes(cityLower)) return true;
                // Check if the original job location string includes(the excluded city
                 if (originalJobLocationText && originalJobLocationText.toLowerCase().includes(cityLower)) return true;
                 return false;
            });


            // Re-check Title and Company Exclusion for the second pass
            const isTitleExcluded = excludedTitles.some(title => jobTitle.includes(title));
            const isCompanyExcluded = excludedCompanies.some(company => jobCompany.includes(company));


			// Check if manually hidden to avoid showing
			const isBeingDelayed = item.dataset.delayHide === 'true';
			const hiddenByUserFooter = item.querySelector('.job-card-container__footer-item--highlighted');
			const isManuallyHidden = hiddenByUserFooter && hiddenByUserFooter.textContent.trim() === 'We won’t show you this job again.';


			// Rule 2 Show Part: If the job is in a state where Rule 2 hide was triggered
			// AND the job's city is NOT excluded
			// AND the job is currently hidden by our custom filter (check the class)
			// AND the job is NOT manually hidden by the user (check for manual hide indicator or delay flag)
			// AND the job is NOT excluded by title or company (NEW CHECK - FIX)
			// Note: Using parsedStateFromLocation for the statesTriggeringRule2Hide check
			if (statesTriggeringRule2Hide.has(stateFromLocation) && !isCityExcluded && item.classList.contains('linkedin-job-filter-hidden') && !isBeingDelayed && !isManuallyHidden && !isTitleExcluded && !isCompanyExcluded) {
				// Ensure the job is visible
				const itemToModify = item;
				const jobCardContainerToModify = jobCardContainer;

				if (itemToModify) { // Check if element exists
					itemToModify.style.display = itemToModify.dataset.originalDisplay || ''; // LAW 1 Adherence: Restoring display
					itemToModify.classList.remove('linkedin-job-filter-hidden'); // LAW 1 Adherence: Removing designated class
					delete itemToModify.dataset.originalDisplay;
				}
				if (jobCardContainerToModify) { // Check if element exists
					jobCardContainerToModify.style.display = jobCardContainerToModify.dataset.originalDisplay || ''; // LAW 1 Adherence: Restoring display
					jobCardContainerToModify.classList.remove('linkedin-job-filter-hidden'); // LAW 1 Adherence: Removing designated class
					delete jobCardContainerToModify.dataset.originalDisplay;
				}
			}
		});
	}
}

// --- Dedicated Function for Jobs Home Page / Other Jobs Pages ---
function processHomePageJobs(filterData) {
  const jobItems = document.querySelectorAll('li.discovery-templates-entity-item');
  if (!jobItems || jobItems.length === 0) return;

  const shouldEnableFilters = filterData.enableJobFilters;
  const excludedTitles = filterData.excludedTitles.map(s => s.toLowerCase());
  const excludedLocationsState = filterData.excludedLocationsState.map(s => s.toLowerCase());
  const excludedLocationsCity = filterData.excludedLocationsCity.map(s => s.toLowerCase());
  const excludedCompanies = filterData.excludedCompanies.map(s => s.toLowerCase());

  const statesTriggeringRule2Hide = new Set(); // To collect states where Rule 2 hide part was triggered

   // --- First Pass (Home Page): Determine initial hide/show based on rules (excluding Rule 2's show part) ---
   jobItems.forEach(item => {
       // KEEPING THIS CALL - IT HANDLES PROMOTED AND MANUAL HIDE/DELAY
       hidePromotedJobCard(item);

       if (shouldEnableFilters) {
           // --- Get job details from the DOM (Home Page Specific Extraction) ---
           const jobTitleElement = item.querySelector('a.job-card-list__title--link strong');
           const companyAndLocationElement = item.querySelector('div.artdeco-entity-lockup__subtitle span');
           const jobCardContainer = item.querySelector('div.job-card-container'); // Get container

           const jobTitle = jobTitleElement ? jobTitleElement.textContent.trim().toLowerCase() : '';
           const companyAndLocationText = companyAndLocationElement ? companyAndLocationElement.textContent.trim() : '';

           let jobCompany = '';
           let jobLocation = '';
           const parts = companyAndLocationText.split(' · ');
           if (parts.length >= 1) {
               jobCompany = parts[0].toLowerCase();
               if (parts.length > 1) {
                   jobLocation = parts[1].toLowerCase();
               }
           }

           // Parse location string for city and state with improved robustness
           let cityFromLocation = '';
           let stateFromLocation = '';

           if (jobLocation) { // Ensure jobLocation string is not null, undefined, or empty
               const locationParts = jobLocation.split(',').map(part => part.trim());

               if (locationParts.length > 0) {
                   cityFromLocation = locationParts[0]; // Get city (first part)
               }

               if (locationParts.length > 1) {
                   const stateAndMaybeMore = locationParts[1].trim();
                    if (stateAndMaybeMore) { // Ensure the state part is not empty after trimming
                      // Attempt to extract a two-letter state abbreviation using regex
                      const stateMatch = stateAndMaybeMore.match(/^(\w{2})($|\s)/);
                      if (stateMatch && stateMatch[1]) {
                          stateFromLocation = stateMatch[1]; // Found a two-letter abbreviation
                      } else {
                          // If not a standard abbreviation format, take the first word as a fallback
                          const firstWord = stateAndMaybeMore.split(' ')[0];
                          if(firstWord) { // Added check for empty firstWord
                              stateFromLocation = firstWord.toLowerCase(); // Ensure lowercase here too
                          }
                       }
                   }
               }
           }
          // Ensure city and state are in lowercase for consistent comparison (redundant if done above, but safe)
           cityFromLocation = cityFromLocation.toLowerCase();
           stateFromLocation = stateFromLocation.toLowerCase();


           let shouldHideByFilter = false;

           // State Exclusion Check (Use the simpler check from the more stable version)
           const isStateExcluded = excludedLocationsState.some(state => stateFromLocation === state);

           // City Exclusion Check (Use the simpler check from the more stable version)
           const isCityExcluded = excludedLocationsCity.some(city => cityFromLocation.includes(city.trim().toLowerCase()));


           let shouldHideByLocation = false;

           // --- Apply Location Filtering Rules (Revised Order for First Pass) ---

           // Rule 2 Hide Part: If state is excluded AND city is excluded, hide
           if (isStateExcluded && isCityExcluded) {
               shouldHideByLocation = true;
               statesTriggeringRule2Hide.add(stateFromLocation); // Mark this state for Rule 2's show part
           }
           // Rule 3: If city is excluded AND state is NOT excluded, show
           else if (isCityExcluded && !isStateExcluded) {
               shouldHideByLocation = false; // Explicitly show
           }
           // Rule 1 & Implicit Rule: If state is excluded AND city is NOT excluded
           else if (isStateExcluded && !isCityExcluded) {
               // Check if the excluded city list is empty for Rule 1 fallback
               if (excludedLocationsCity.length === 0) {
                   shouldHideByLocation = true; // Rule 1: Hide
               } else {
                   shouldHideByLocation = false; // Implicit Rule: Show
               }
           }
           // If neither state nor city is excluded, it will default to shouldHideByLocation = false (show)


           // Apply Title and Company Filters
           const isTitleExcluded = excludedTitles.some(title => jobTitle.includes(title));
           const isCompanyExcluded = excludedCompanies.some(company => jobCompany.includes(company));


           // Combine location and other filters for the initial hide/show decision
           if (shouldHideByLocation === true) { // If location rule explicitly says hide
               shouldHideByFilter = true;
           } else if (shouldHideByLocation === false) { // If location rule explicitly says show (Rule 3 or Implicit Rule)
               // Ensure shouldHideByFilter is false unless title/company overrides
               if (!isTitleExcluded && !isCompanyExcluded) {
                    shouldHideByFilter = false;
               } else {
                   shouldHideByFilter = true; // Title or company exclusion overrides showing based on location
               }
           } else { // If location rules didn't explicitly say hide or show (neither state nor city excluded)
                // Base hide solely on title/company
                 if (!isTitleExcluded && !isCompanyExcluded) {
                     shouldHideByFilter = false;
                 } else {
                     shouldHideByFilter = true;
                 }
           }

          // --- Add this conditional console.log block (from previous attempt, slightly refined) ---
          // We only want to log details for jobs that are in the excluded state (Rule 1 condition)
          // and are NOT being hidden by the filter (shouldHideByFilter is false),
          // and are also not promoted or manually hidden jobs (handled separately by hidePromotedJobCard).

          // We need to check if hidePromotedJobCard already marked it as hidden or delaying
          const isBeingDelayed = item.dataset.delayHide === 'true';
          const hiddenByUserFooter = item.querySelector('.job-card-container__footer-item--highlighted');
          const isManuallyHidden = hiddenByUserFooter && hiddenByUserFooter.textContent.trim() === 'We won’t show you this job again.';

           // Log details ONLY for non-promoted, non-manually hidden jobs that meet Rule 1 location criteria
           // but are NOT being hidden by the filter
           // Note: Check if item is already hidden by hidePromotedJobCard before logging as a potential failure
          if (isStateExcluded && excludedLocationsCity.length === 0 && shouldHideByFilter === false && !isBeingDelayed && !isManuallyHidden) {
               // Re-check if it has our custom filter class, as hidePromotedJobCard might use display:none without it immediately
               const isHiddenByOurClass = item.classList.contains('linkedin-job-filter-hidden');
               const isHiddenByDisplayNone = item.style.display === 'none'; // Check display style too

               // Only log if shouldHideByFilter is false BUT the job *should* have been hidden by Rule 1,
               // AND it's not already hidden by our class OR display:none (meaning it's visible when it shouldn't be by Rule 1)
               if (shouldHideByLocation === true && shouldHideByFilter === false && !isHiddenByOurClass && isHiddenByDisplayNone !== true) {

                   console.log('--- Potential Rule 1 Failure (Home Page) - Job NOT Hidden ---');
                   console.log('Title:', jobTitle);
                   console.log('Company:', jobCompany);
                   // Safely get the original location text element reference again if needed for logging original text
                   const originalLocationElement = item.querySelector('ul.job-card-container__metadata-wrapper li span') || item.querySelector('div.artdeco-entity-lockup__subtitle span'); // Try both selectors
                   console.log('Location Text (Original):', originalLocationElement ? originalLocationElement.textContent.trim() : 'N/A'); // Log original text

                   console.log('Parsed City:', cityFromLocation); // Log the parsed city
                   console.log('Parsed State:', stateFromLocation); // Log the parsed state (using the simpler parsing)

                   console.log('isStateExcluded:', isStateExcluded); // Should be true for Rule 1
                   console.log('isCityExcluded:', isCityExcluded); // Should be false for Rule 1
                   console.log('isTitleExcluded:', isTitleExcluded); // What are title/company states?
                   console.log('isCompanyExcluded:', isCompanyExcluded);
                   console.log('Excluded Cities List Empty:', excludedLocationsCity.length === 0); // Should be true for Rule 1
                   console.log('shouldHideByLocation (before combine):', shouldHideByLocation); // Expected true for Rule 1
                   console.log('shouldHideByFilter (after combine):', shouldHideByFilter); // Expected true for Hide, but is false

                   console.log('Item has hidden class before hide/show attempt:', item.classList.contains('linkedin-job-filter-hidden'));
                   console.log('Item display style before hide/show attempt:', item.style.display);


                   console.log('-----------------------------------------');
               }
          }
          // --- End conditional console.log block ---


          // Apply initial hide/show based on shouldHideByFilter
           const itemToModify = item; // Keep itemToModify declaration here
           const jobCardContainerToModify = jobCardContainer; // jobCardContainer declared above


           if (shouldHideByFilter) {
             if (itemToModify && itemToModify.style.display !== 'none') {
               itemToModify.dataset.originalDisplay = itemToModify.style.display || '';
               itemToModify.style.display = 'none'; // LAW 1 Adherence: Using display: none for hiding
               itemToModify.classList.add('linkedin-job-filter-hidden'); // LAW 1 Adherence: Using the designated class
             }
             if (jobCardContainerToModify && jobCardContainerToModify.style.display !== 'none') {
               jobCardContainerToModify.dataset.originalDisplay = jobCardContainerToModify.dataset.originalDisplay || '';
               jobCardContainerToModify.style.display = 'none'; // LAW 1 Adherence: Using display: none for hiding
               jobCardContainerToModify.classList.add('linkedin-job-filter-hidden'); // LAW 1 Adherence: Using the designated class
             }
          } else {
             // Ensure it's visible if not filtered in this pass (and not manually hidden/delayed)
             // Re-check manual hide/delay status here as hidePromotedJobCard might have updated it
              const isBeingDelayed = itemToModify.dataset.delayHide === 'true';
              const hiddenByUserFooter = itemToModify.querySelector('.job-card-container__footer-item--highlighted');
              const isManuallyHidden = hiddenByUserFooter && hiddenByUserFooter.textContent.trim() === 'We won’t show you this job again.';


              if (!isBeingDelayed && !isManuallyHidden) { // Only ensure visible if not manually hidden or being delayed
                 if (itemToModify && itemToModify.classList.contains('linkedin-job-filter-hidden')) { // LAW 1 Adherence: Checking for the designated class to determine hidden state
                   itemToModify.style.display = itemToModify.dataset.originalDisplay || '';
                   itemToModify.classList.remove('linkedin-job-filter-hidden'); // LAW 1 Adherence: Removing designated class for showing
                   delete itemToModify.dataset.originalDisplay;
                 }
                 if (jobCardContainerToModify && jobCardContainerToModify.classList.contains('linkedin-job-filter-hidden')) { // LAW 1 Adherence: Checking for the designated class
                   jobCardContainerToModify.style.display = jobCardContainerToModify.dataset.originalDisplay || '';
                   jobCardContainerToModify.classList.remove('linkedin-job-filter-hidden'); // LAW 1 Adherence: Removing designated class
                   delete jobCardContainerToModify.dataset.originalDisplay;
                 }
              }
           }
       }
   });

   // --- Second Pass (Home Page): Implement Rule 2's "show others in state" based on statesTriggeringRule2Hide ---
   if (shouldEnableFilters && statesTriggeringRule2Hide.size > 0 && jobItems.length > 0) {
       jobItems.forEach(item => {
            // --- Get job details from the DOM (Home Page Specific Extraction - Redundant but safe) ---
           const companyAndLocationElement = item.querySelector('div.artdeco-entity-lockup__subtitle span');
            const jobTitleElement = item.querySelector('a.job-card-list__title--link strong'); // Need to re-extract title

            const jobCardContainer = item.querySelector('div.job-card-container'); // Get container again

            const companyAndLocationText = companyAndLocationElement ? companyAndLocationElement.textContent.trim() : '';
            const jobTitle = jobTitleElement ? jobTitleElement.textContent.trim().toLowerCase() : ''; // Re-extracted title

            let jobCompany = ''; // Need to re-extract company if needed for exclusion check
             const parts = companyAndLocationText.split(' · ');
             if (parts.length >= 1) {
                 jobCompany = parts[0].toLowerCase(); // Re-extracted company
             }


            let jobLocation = ''; // Original location text from element
            if (parts.length >= 1 && parts.length > 1) {
                jobLocation = parts[1].trim(); // Capture original location string
            } else {
                 // Fallback or handle cases without '·'
            }


           // Parse location string for city and state (using the simpler parsing that was here before)
           let parsedCityFromLocation = '';
           let parsedStateFromLocation = '';

           if (jobLocation) { // Ensure jobLocation string is not null, undefined, or empty
               const locationParts = jobLocation.split(',').map(part => part.trim());

               if (locationParts.length > 0) {
                   parsedCityFromLocation = locationParts[0].toLowerCase(); // Get city (first part)
               }

               if (locationParts.length > 1) {
                   const stateAndMaybeMore = locationParts[1].trim();
                    if (stateAndMaybeMore) {
                       // Attempt to extract a two-letter state abbreviation
                       const stateMatch = stateAndMaybeMore.match(/^(\w{2})($|\s)/);
                       if (stateMatch && stateMatch[1]) {
                           parsedStateFromLocation = stateMatch[1].toLowerCase(); // Found abbreviation
                       } else {
                          const firstWord = stateAndMaybeMore.split(' ')[0];
                          if(firstWord) { // Added check for empty firstWord
                              parsedStateFromLocation = firstWord.toLowerCase(); // Fallback to first word
                          }
                       }
                   }
               }
           }


           // State Exclusion Check (Use the simpler check from the more stable version)
           const isStateExcluded = excludedLocationsState.some(state => parsedStateFromLocation === state);

           // City Exclusion Check (Use the simpler check from the more stable version)
           const isCityExcluded = excludedLocationsCity.some(city => parsedCityFromLocation.includes(city.trim().toLowerCase()));


           const isTitleExcluded = excludedTitles.some(title => jobTitle.includes(title)); // Re-check title exclusion
           const isCompanyExcluded = excludedCompanies.some(company => jobCompany.includes(company)); // Re-check company exclusion


            // Check if manually hidden to avoid showing
            const isBeingDelayed = item.dataset.delayHide === 'true';
            const hiddenByUserFooter = item.querySelector('.job-card-container__footer-card'); // Corrected selector based on common structure
            const isManuallyHidden = hiddenByUserFooter && hiddenByUserFooter.textContent.trim() === 'We won’t show you this job again.';


           // Rule 2 Show Part: If the job is in a state where Rule 2 hide was triggered
           // AND the job's city is NOT excluded
           // AND the job is currently hidden by our custom filter (check the class)
           // AND the job is NOT manually hidden by the user (check for manual hide indicator or delay flag)
           // AND the job is NOT excluded by title or company (NEW CHECK)
           // Note: Using parsedStateFromLocation for the statesTriggeringRule2Hide check
           if (statesTriggeringRule2Hide.has(parsedStateFromLocation) && !isCityExcluded && item.classList.contains('linkedin-job-filter-hidden') && !isBeingDelayed && !isManuallyHidden && !isTitleExcluded && !isCompanyExcluded) {
               // Ensure the job is visible
               const itemToModify = item;
               const jobCardContainerToModify = jobCardContainer;

               if (itemToModify) { // Check if element exists
                   itemToModify.style.display = itemToModify.dataset.originalDisplay || ''; // LAW 1 Adherence: Restoring display
                   itemToModify.classList.remove('linkedin-job-filter-hidden'); // LAW 1 Adherence: Removing designated class
                   delete itemToModify.dataset.originalDisplay;
               }
               if (jobCardContainerToModify) { // Check if element exists
                   jobCardContainerToModify.style.display = jobCardContainerToModify.dataset.originalDisplay || ''; // LAW 1 Adherence: Restoring display
                   jobCardContainerToModify.classList.remove('linkedin-job-filter-hidden'); // LAW 1 Adherence: Removing designated class
                   delete jobCardContainerToModify.dataset.originalDisplay;
               }
           }
       });
   }
}

// --- Main processJobs function acts as a router ---
function processJobs() {
    isExtensionEnabled(enabled => {
        if (enabled) {
             chrome.storage.local.get({ // Get filter data here before calling processing function
                 'enableJobFilters': false, 'excludedTitles': [], 'excludedLocationsState': [], 'excludedLocationsCity': [], 'excludedCompanies': []
            }, (filterData) => {
                // Route based on URL
                if (window.location.href.startsWith('https://www.linkedin.com/jobs/search') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
                     processSearchPageJobs(filterData);
                } else if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
                     processHomePageJobs(filterData);
                }
                // Feed processing is handled by debouncedProcessPage routing
            });
        }
    });
}

// --- Observer setup ---
let bodyObserver = null;

function setupGlobalObserver() {
    const body = document.querySelector('body');
    let targetNode = body;
    const observerOptions = { childList: true, subtree: true };

    // Consider more specific targets for the observer if possible and reliable
    // For now, observing the body or main list containers seems necessary to catch all dynamic additions
    // Sticking with body for broader coverage, but could be optimized if performance is an issue.

    // Target the specific list containers if they exist on these pages
     if (window.location.href.startsWith('https://www.linkedin.com/jobs/search') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
         const jobListContainer = document.querySelector('div.scaffold-layout__list');
         if (jobListContainer) {
             targetNode = jobListContainer;
         }
     } else if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
         // For home page, observing the body might be necessary as items appear in different sections,
         // or we might need multiple observers if containers are specific. Let's stick to body for now
         // unless specific containers for discovery-templates-entity-item are found consistently.
         // The current querySelectorAll('li.discovery-templates-entity-item') will find items wherever they are in the document.
         // Observing the body ensures we catch items being added to any part of the page.
         targetNode = body; // Keep observing body for jobs home page
     } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/') {
          targetNode = body; // Keep observing body for feed
     }

    if (targetNode) {
        // Disconnect any existing observer before creating a new one
        if (bodyObserver) {
             bodyObserver.disconnect();
        }

        const observer = new MutationObserver(mutationsList => {
            isExtensionEnabled(enabled => {
                if (enabled) {
                    debouncedProcessPage();
                } else {
                     // If extension is disabled, ensure no filter classes are applied
                     document.querySelectorAll('.linkedin-job-filter-hidden').forEach(el => {
                         el.style.display = el.dataset.originalDisplay || '';
                         el.classList.remove('linkedin-job-filter-hidden'); // Corrected typo
                         delete el.dataset.originalDisplay;
                     });
                     // Also need to ensure promoted/manually hidden items are unhidden if extension turns off
                     // This requires logic to revert changes made by hidePromotedFeedItem/hidePromotedJobCard
                     // This might be more complex and potentially outside the scope of current task
                     // Consider adding a function to unhide all job cards and feed items.
                }
            });
        });
        observer.observe(targetNode, observerOptions);
        bodyObserver = observer; // Assign observer to the global variable
    } else {
         // console.log('Target element not found for MutationObserver.'); // Removed
    }
}

// --- Debounce setup ---
function debouncedProcessPage() {
    if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
    }
    debounceTimeoutId = setTimeout(() => {
        isExtensionEnabled(enabled => {
            if (enabled) {
                // Only log info if URL changes
                if (window.location.href !== currentUrl) {
                    hasLoggedInfo = false; // Reset flag
                }

                if (!hasLoggedInfo) {
                     logExtensionInfo();
                     currentUrl = window.location.href; // Update currentUrl
                     hasLoggedInfo = true; // Set flag after logging
                }

                // Route processing based on URL
                if (window.location.href.startsWith('https://www.linkedin.com/jobs/') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
                    processJobs(); // Call the job router
                } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
                     processFeed(); // Call feed processing
                }
                 // Add other page types here if needed
            } else {
                // If extension is disabled, reset flags
                hasLoggedInfo = false;
                currentUrl = null;
            }
        });
        debounceTimeoutId = null;
    }, debounceDelay);
}

// --- Initialization and Event Listeners ---
window.addEventListener('load', () => {
    initialize(); // Sets up the observer
    isExtensionEnabled(enabled => {
        if (enabled) {
            // Initial process should be debounced to handle late-loading content
             debouncedProcessPage(); // Initial call through debounce
        }
    });
});

// You can add back other event listeners (like popstate for back/forward navigation)
// if they are needed to trigger processing on URL changes that the observer might not catch,
// but ensure they also call debouncedProcessPage(). The MutationObserver on the body
// often catches content changes resulting from URL changes triggered by the SPA.
// window.addEventListener('popstate', debouncedProcessPage);
// window.addEventListener('hashchange', debouncedProcessPage); // Might be needed for some SPAs

// Keep the style injection
const style = document.createElement('style');
style.textContent = `
  .linkedin-job-filter-hidden {
    display: none !important;
  }
`;
document.head.appendChild(style);
