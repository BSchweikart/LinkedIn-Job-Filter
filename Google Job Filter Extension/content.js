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

// --- Promoted Job Hiding Logic (ONLY handles Promoted jobs - Law 1) ---
// This function is called by both processSearchPageJobs and processHomePageJobs
function hidePromotedJobCard(jobCardLi, hidePromotedContentEnabled) { // Added hidePromotedContentEnabled
    if (!hidePromotedContentEnabled) { // Only hide if enabled
        return false;
    }
    const promotedFooterItems = jobCardLi.querySelectorAll('.job-card-container__footer-item');
    if (promotedFooterItems) {
        for (const footerItem of promotedFooterItems) {
            const promotedSpan = footerItem.querySelector('span[dir="ltr"]');
            if (promotedSpan && promotedSpan.textContent.trim().toLowerCase() === 'promoted') {
                if (jobCardLi && jobCardLi.style.display !== 'none') {
                    jobCardLi.dataset.originalDisplay = jobCardLi.style.display || '';
                    jobCardLi.style.display = 'none'; // LAW 1 Adherence
                    jobCardLi.classList.add('linkedin-promoted-hidden'); // Add specific class for promoted hides
                    return true;
                }
            }
        }
    }
    return false; // Not a promoted job handled by this function
}

// --- Manual Hide and Delay Logic (Reverted to base file logic, decoupled, assigned to checkbox) ---
function handleManualHide(item, delayUserHiddenEnabled) {
    const hiddenByUserFooter = item.querySelector('.job-card-container__footer-item--highlighted');
    const isCurrentlyDelayed = item.dataset.delayHide === 'true';

    // If "We won’t show you this job again." message is present
    if (hiddenByUserFooter && hiddenByUserFooter.textContent.trim() === 'We won’t show you this job again.') {
        // If delay is enabled and it's not already delaying and not already hidden by this function
        if (delayUserHiddenEnabled && !isCurrentlyDelayed && !item.classList.contains('linkedin-manual-hidden')) {
            item.dataset.delayHide = 'true'; // Mark for delay
            setTimeout(() => {
                // Re-check conditions inside timeout in case user un-hid or page reloaded
                if (item && item.dataset.delayHide === 'true') { // Check if still marked for delay (not un-hidden by user)
                    // Only hide if it's not already hidden by something else (e.g. promoted)
                    if (!item.classList.contains('linkedin-promoted-hidden') && item.style.display !== 'none') {
                        item.dataset.originalDisplay = item.style.display || '';
                        item.style.display = 'none';
                        item.classList.add('linkedin-manual-hidden');
                    }
                }
                delete item.dataset.delayHide; // Clear the delay flag regardless
            }, 5000); // 5-second delay
            return true; // Indicate that manual hide (or delay) is being handled
        }
        // If delay is disabled, or already delaying, or already hidden by manual hide, just ensure it's hidden
        if (!delayUserHiddenEnabled && item.style.display !== 'none' && !item.classList.contains('linkedin-manual-hidden')) {
             item.dataset.originalDisplay = item.style.display || '';
             item.style.display = 'none';
             item.classList.add('linkedin-manual-hidden');
             return true;
        }
        // If already hidden by manual hide, or currently delaying, we still consider it handled
        if (item.classList.contains('linkedin-manual-hidden') || isCurrentlyDelayed) {
            return true;
        }
    } else {
        // "We won’t show you this job again." message is NOT present
        // If it was previously marked for delay, clear it
        if (isCurrentlyDelayed) {
            clearTimeout(item.dataset.delayTimeoutId); // Clear any pending timeout
            delete item.dataset.delayHide;
            delete item.dataset.delayTimeoutId; // Clean up timeout ID
        }
        // If it was hidden by our manual hide function, restore its display
        if (item.classList.contains('linkedin-manual-hidden')) {
            if (!item.classList.contains('linkedin-promoted-hidden')) { // Only show if not also promoted hidden
                item.style.display = item.dataset.originalDisplay || '';
            }
            item.classList.remove('linkedin-manual-hidden');
            delete item.dataset.originalDisplay;
            return true; // Indicate that manual hide was unhandled
        }
    }
    return false; // Manual hide not applicable or not currently handled by this function
}


// --- Dedicated Function for Search/Collections Pages ---
function processSearchPageJobs(filterData) {
	const jobListContainer = document.querySelector('div.scaffold-layout__list');
	if (!jobListContainer) return;
	const jobItems = jobListContainer.querySelectorAll('li.scaffold-layout__list-item');
	if (!jobItems || jobItems.length === 0) return;

	const shouldEnableFilters = filterData.enableJobFilters;
    // Arrays are already lowercased by parseToArray in processJobs
	const excludedTitles = filterData.excludedTitles;
	const excludedLocationsState = filterData.excludedLocationsState;
	const excludedLocationsCity = filterData.excludedLocationsCity;
	const excludedCompanies = filterData.excludedCompanies;
    const excludedLocationsHardState = filterData.excludedLocationsHardState;
    const delayUserHiddenEnabled = filterData.delayUserHiddenEnabled;
    const hidePromotedContentEnabled = filterData.hidePromotedContentEnabled;


	const statesTriggeringRule2Hide = new Set(); // To collect states where Rule 2 hide part was triggered

	// --- First Pass (Search Page): Determine initial hide/show based on rules (excluding Rule 2's show part) ---
	jobItems.forEach(item => {
        const jobCardContainer = item.querySelector('div.job-card-container'); // Get container here

        // Reset visibility for this iteration, unless already hidden by promoted/manual from previous run
        // Ensure it's not hidden by us, or if it is, restore it before re-evaluation
        if (item.classList.contains('linkedin-job-filter-hidden') && !item.classList.contains('linkedin-promoted-hidden') && !item.classList.contains('linkedin-manual-hidden')) {
             item.style.display = item.dataset.originalDisplay || '';
             item.classList.remove('linkedin-job-filter-hidden');
             delete item.dataset.originalDisplay;
        }
        if (jobCardContainer && jobCardContainer.classList.contains('linkedin-job-filter-hidden') && !jobCardContainer.classList.contains('linkedin-promoted-hidden') && !jobCardContainer.classList.contains('linkedin-manual-hidden')) {
             jobCardContainer.style.display = jobCardContainer.dataset.originalDisplay || '';
             jobCardContainer.classList.remove('linkedin-job-filter-hidden');
             delete jobCardContainer.dataset.originalDisplay;
        }

		// 1. Handle Promoted Jobs (Highest Priority)
        const isPromotedHidden = hidePromotedJobCard(item, hidePromotedContentEnabled);
        if (isPromotedHidden) {
            return; // If hidden by promoted, stop further processing for this item.
        }

        // 2. Handle Manual User Hides (Next Highest Priority)
        const isManuallyHiddenOrDelaying = handleManualHide(item, delayUserHiddenEnabled);
        if (isManuallyHiddenOrDelaying) {
             // If manual hide is handled (either hidden immediately or delaying), check its current visibility.
             // If it's already display: none, then we skip further filtering.
             // If it's delaying and still visible, then proceed with custom filters.
             if (item.style.display === 'none' || item.classList.contains('linkedin-manual-hidden')) {
                 return; // If manually hidden (immediately or after delay already applied), stop further processing
             }
        }

		if (shouldEnableFilters) {
			// --- Get job details from the DOM (Search Page Specific Extraction) ---
			const jobTitleElement = item.querySelector('a.job-card-list__title--link strong');
			const jobLocationElement = item.querySelector('ul.job-card-container__metadata-wrapper li span');
			const jobCompanyElement = item.querySelector('div.artdeco-entity-lockup__subtitle span');

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
                    const singlePart = parts[0];
                    cityFromLocation = singlePart;
                    stateFromLocation = singlePart;
                } else if (parts.length === 2) {
                    const part1 = parts[0];
                    const part2 = parts[1];
                    cityFromLocation = part1;
                    stateFromLocation = part2;
                    if (['united states', 'usa', 'canada', 'uk', 'united kingdom'].includes(part2)) {
                         stateFromLocation = part1;
                         cityFromLocation = '';
                         countryFromLocation = part2;
                    }
                } else if (parts.length > 2) {
                    countryFromLocation = parts[parts.length - 1];
                    stateFromLocation = parts[parts.length - 2];
                    cityFromLocation = parts.slice(0, parts.length - 2).join(', ').trim();
                }
			}


			let shouldHideByFilter = false;

            // Rule for Hard State Exclusion Filter (Highest Priority, definitive hide for custom filters)
            const isHardStateExcluded = excludedLocationsHardState.some(excludedState =>
                stateFromLocation === excludedState || originalJobLocationText.toLowerCase().includes(excludedState)
            );

            if (isHardStateExcluded) {
                if (item.style.display !== 'none') {
                    item.dataset.originalDisplay = item.style.display || '';
                    item.style.display = 'none';
                    item.classList.add('linkedin-job-filter-hidden');
                }
                if (jobCardContainer && jobCardContainer.style.display !== 'none') {
                    jobCardContainer.dataset.originalDisplay = jobCardContainer.dataset.originalDisplay || '';
                    jobCardContainer.style.display = 'none';
                    jobCardContainer.classList.add('linkedin-job-filter-hidden');
                }
                return; // Stop processing this item, it's definitively hidden by hard state filter
            }


			// State Exclusion Check
            const isStateExcluded = excludedLocationsState.some(excludedState => {
                if (stateFromLocation === excludedState) return true;
                if (originalJobLocationText && originalJobLocationText.toLowerCase().includes(excludedState)) return true;
                 const locationParts = originalJobLocationText ? originalJobLocationText.split(',').map(part => part.trim().toLowerCase()) : [];
                 if (locationParts.length === 1) {
                     if (excludedLocationsState.includes(locationParts[0])) return true;
                 }
                return false;
            });


            // City Exclusion Check
			const isCityExcluded = excludedLocationsCity.some(city => {
                const cityLower = city.trim().toLowerCase();
                 if (cityFromLocation.includes(cityLower)) return true;
                 if (originalJobLocationText && originalJobLocationText.toLowerCase().includes(cityLower)) return true;
                 return false;
            });


			let shouldHideByLocation = false;

			// --- Apply Location Filtering Rules ---
			// Rule 2 Hide Part: If state is excluded AND city is excluded, hide
			if (isStateExcluded && isCityExcluded) {
				shouldHideByLocation = true;
                if(stateFromLocation) {
                    statesTriggeringRule2Hide.add(stateFromLocation);
                } else if (originalJobLocationText && isStateExcluded) {
                    const matchedState = excludedLocationsState.find(es => originalJobLocationText.toLowerCase().includes(es));
                    if(matchedState) statesTriggeringRule2Hide.add(matchedState);
                }
			}
			// Rule 3: If city is excluded AND state is NOT excluded, show
			else if (isCityExcluded && !isStateExcluded) {
				shouldHideByLocation = false;
			}
			// Rule 1 & Implicit Rule: If state is excluded AND city is NOT excluded
			else if (isStateExcluded && !isCityExcluded) {
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
			if (shouldHideByLocation === true) {
				shouldHideByFilter = true;
			} else if (shouldHideByLocation === false) {
				if (!isTitleExcluded && !isCompanyExcluded) {
					shouldHideByFilter = false;
				} else {
					shouldHideByFilter = true;
				}
			} else {
				if (!isTitleExcluded && !isCompanyExcluded) {
					shouldHideByFilter = false;
				} else {
					shouldHideByFilter = true;
				}
			}

            // Apply hide/show based on shouldHideByFilter
            // Only modify if not already hidden by promoted or manual rules
            if (!item.classList.contains('linkedin-promoted-hidden') && !item.classList.contains('linkedin-manual-hidden')) {
                const itemToModify = item;
                if (shouldHideByFilter) {
                    if (itemToModify && itemToModify.style.display !== 'none') {
                        itemToModify.dataset.originalDisplay = itemToModify.style.display || '';
                        itemToModify.style.display = 'none';
                        itemToModify.classList.add('linkedin-job-filter-hidden');
                    }
                    if (jobCardContainer && jobCardContainer.style.display !== 'none') {
                        jobCardContainer.dataset.originalDisplay = jobCardContainer.dataset.originalDisplay || '';
                        jobCardContainer.style.display = 'none';
                        jobCardContainer.classList.add('linkedin-job-filter-hidden');
                    }
                } else {
                    if (itemToModify && itemToModify.classList.contains('linkedin-job-filter-hidden')) {
                        itemToModify.style.display = itemToModify.dataset.originalDisplay || '';
                        itemToModify.classList.remove('linkedin-job-filter-hidden');
                        delete itemToModify.dataset.originalDisplay;
                    }
                    if (jobCardContainer && jobCardContainer.classList.contains('linkedin-job-filter-hidden')) {
                        jobCardContainer.style.display = jobCardContainer.dataset.originalDisplay || '';
                        jobCardContainer.classList.remove('linkedin-job-filter-hidden');
                        delete jobCardContainer.dataset.originalDisplay;
                    }
                }
            }
		} else { // If custom filters are disabled, ensure all custom-filtered jobs are shown
             if (item.classList.contains('linkedin-job-filter-hidden')) {
                item.style.display = item.dataset.originalDisplay || '';
                item.classList.remove('linkedin-job-filter-hidden');
                delete item.dataset.originalDisplay;
            }
            if (jobCardContainer && jobCardContainer.classList.contains('linkedin-job-filter-hidden')) {
                jobCardContainer.style.display = jobCardContainer.dataset.originalDisplay || '';
                jobCardContainer.classList.remove('linkedin-job-filter-hidden');
                delete jobCardContainer.dataset.originalDisplay;
            }
        }
	});

	// --- Second Pass (Search Page): Implement Rule 2's "show others in state" based on statesTriggeringRule2Hide ---
	if (shouldEnableFilters && statesTriggeringRule2Hide.size > 0 && jobItems.length > 0) {
		jobItems.forEach(item => {
			// Check if already hidden by promoted or manual rules. If so, Rule 2 cannot override.
            if (item.classList.contains('linkedin-promoted-hidden') || item.classList.contains('linkedin-manual-hidden')) {
                return;
            }

			// --- Get job details from the DOM (Search Page Specific Extraction - Redundant but safe) ---
			const jobLocationElement = item.querySelector('ul.job-card-container__metadata-wrapper li span');
            const jobTitleElement = item.querySelector('a.job-card-list__title--link strong');
            const jobCompanyElement = item.querySelector('div.artdeco-entity-lockup__subtitle span');
			const jobCardContainer = item.querySelector('div.job-card-container');

			const originalJobLocationText = jobLocationElement ? jobLocationElement.textContent.trim() : '';
            const jobTitle = jobTitleElement ? jobTitleElement.textContent.trim().toLowerCase() : '';
            const jobCompany = jobCompanyElement ? jobCompanyElement.textContent.trim().toLowerCase() : '';

			// Parse location string
			let cityFromLocation = '';
			let stateFromLocation = '';
            let countryFromLocation = '';

			if (originalJobLocationText) {
				const parts = originalJobLocationText.split(',').map(part => part.trim().toLowerCase());
                if (parts.length === 1) {
                    const singlePart = parts[0];
                    cityFromLocation = singlePart;
                    stateFromLocation = singlePart;
                } else if (parts.length === 2) {
                    const part1 = parts[0];
                    const part2 = parts[1];
                    cityFromLocation = part1;
                    stateFromLocation = part2;
                    if (['united states', 'usa', 'canada', 'uk', 'united kingdom'].includes(part2)) {
                         stateFromLocation = part1;
                         cityFromLocation = '';
                         countryFromLocation = part2;
                    }
                } else if (parts.length > 2) {
                    countryFromLocation = parts[parts.length - 1];
                    stateFromLocation = parts[parts.length - 2];
                    cityFromLocation = parts.slice(0, parts.length - 2).join(', ').trim();
                }
			}

            // City Exclusion Check for Rule 2 re-evaluation
			const isCityExcluded = excludedLocationsCity.some(city => {
                const cityLower = city.trim().toLowerCase();
                 if (cityFromLocation.includes(cityLower)) return true;
                 if (originalJobLocationText && originalJobLocationText.toLowerCase().includes(cityLower)) return true;
                 return false;
            });

            // Re-check Title and Company Exclusion for Rule 2 re-evaluation
            const isTitleExcluded = excludedTitles.some(title => jobTitle.includes(title));
            const isCompanyExcluded = excludedCompanies.some(company => jobCompany.includes(company));


			// Rule 2 Show Part: If the job is in a state where Rule 2 hide was triggered
			// AND the job's city is NOT excluded
			// AND the job is currently hidden by our custom filter (check the class)
			// AND the job is NOT excluded by title or company (CRUCIAL: Rule 2 only overrides *location* hides, not others)
			if (statesTriggeringRule2Hide.has(stateFromLocation) &&
                !isCityExcluded &&
                item.classList.contains('linkedin-job-filter-hidden') &&
                !isTitleExcluded &&
                !isCompanyExcluded)
            {
				const itemToModify = item;
				const jobCardContainerToModify = jobCardContainer;

				if (itemToModify) {
					itemToModify.style.display = itemToModify.dataset.originalDisplay || '';
					itemToModify.classList.remove('linkedin-job-filter-hidden');
					delete itemToModify.dataset.originalDisplay;
				}
				if (jobCardContainerToModify) {
					jobCardContainerToModify.style.display = jobCardContainerToModify.dataset.originalDisplay || '';
					jobCardContainerToModify.classList.remove('linkedin-job-filter-hidden');
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
  const excludedTitles = filterData.excludedTitles;
  const excludedLocationsState = filterData.excludedLocationsState;
  const excludedLocationsCity = filterData.excludedLocationsCity;
  const excludedCompanies = filterData.excludedCompanies;
  const excludedLocationsHardState = filterData.excludedLocationsHardState;
  const delayUserHiddenEnabled = filterData.delayUserHiddenEnabled;
  const hidePromotedContentEnabled = filterData.hidePromotedContentEnabled;

  const statesTriggeringRule2Hide = new Set();

   // --- First Pass (Home Page): Determine initial hide/show based on rules (excluding Rule 2's show part) ---
   jobItems.forEach(item => {
       const jobCardContainer = item.querySelector('div.job-card-container');

        // Reset visibility for this iteration
       if (item.classList.contains('linkedin-job-filter-hidden') && !item.classList.contains('linkedin-promoted-hidden') && !item.classList.contains('linkedin-manual-hidden')) {
             item.style.display = item.dataset.originalDisplay || '';
             item.classList.remove('linkedin-job-filter-hidden');
             delete item.dataset.originalDisplay;
        }
        if (jobCardContainer && jobCardContainer.classList.contains('linkedin-job-filter-hidden') && !jobCardContainer.classList.contains('linkedin-promoted-hidden') && !jobCardContainer.classList.contains('linkedin-manual-hidden')) {
             jobCardContainer.style.display = jobCardContainer.dataset.originalDisplay || '';
             jobCardContainer.classList.remove('linkedin-job-filter-hidden');
             delete jobCardContainer.dataset.originalDisplay;
        }

       // 1. Handle Promoted Jobs (Highest Priority)
       const isPromotedHidden = hidePromotedJobCard(item, hidePromotedContentEnabled);
        if (isPromotedHidden) {
            return;
        }

       // 2. Handle Manual User Hides (Next Highest Priority)
       const isManuallyHiddenOrDelaying = handleManualHide(item, delayUserHiddenEnabled);
       if (isManuallyHiddenOrDelaying) {
            if (item.style.display === 'none' || item.classList.contains('linkedin-manual-hidden')) {
                return;
            }
       }

        // Only proceed with custom filtering if not already hidden by promoted or manual rules
        if (item.classList.contains('linkedin-promoted-hidden') || item.classList.contains('linkedin-manual-hidden')) {
            return;
        }

       if (shouldEnableFilters) {
           // --- Get job details from the DOM (Home Page Specific Extraction) ---
           const jobTitleElement = item.querySelector('a.job-card-list__title--link strong');
           const companyAndLocationElement = item.querySelector('div.artdeco-entity-lockup__subtitle span');

           const jobTitle = jobTitleElement ? jobTitleElement.textContent.trim().toLowerCase() : '';
           const companyAndLocationText = companyAndLocationElement ? companyAndLocationElement.textContent.trim() : '';
           let jobCompany = '';
           let jobLocationRaw = '';

           const parts = companyAndLocationText.split(' · ');
           if (parts.length >= 1) {
               jobCompany = parts[0].trim().toLowerCase();
               if (parts.length > 1) {
                   jobLocationRaw = parts[1].trim();
               }
           }

           // Parse location string for city and state with improved robustness
           let cityFromLocation = '';
           let stateFromLocation = '';

           if (jobLocationRaw) {
               const locationParts = jobLocationRaw.split(',').map(part => part.trim());
               if (locationParts.length > 0) {
                   cityFromLocation = locationParts[0];
               }
               if (locationParts.length > 1) {
                   const stateAndMaybeMore = locationParts[1].trim();
                   if (stateAndMaybeMore) {
                       const stateMatch = stateAndMaybeMore.match(/^(\w{2})($|\s)/);
                       if (stateMatch && stateMatch[1]) {
                           stateFromLocation = stateMatch[1].toLowerCase();
                       } else {
                           const firstWord = stateAndMaybeMore.split(' ')[0];
                           if(firstWord) {
                               stateFromLocation = firstWord.toLowerCase();
                           }
                       }
                   }
               }
           }

           cityFromLocation = cityFromLocation.toLowerCase();
           stateFromLocation = stateFromLocation.toLowerCase();


           let shouldHideByFilter = false;

           // Rule for Hard State Exclusion Filter (Highest Priority)
           const isHardStateExcluded = excludedLocationsHardState.some(excludedState =>
               stateFromLocation === excludedState || jobLocationRaw.toLowerCase().includes(excludedState)
           );

           if (isHardStateExcluded) {
               if (item.style.display !== 'none') {
                   item.dataset.originalDisplay = item.style.display || '';
                   item.style.display = 'none';
                   item.classList.add('linkedin-job-filter-hidden');
               }
               if (jobCardContainer && jobCardContainer.style.display !== 'none') {
                   jobCardContainer.dataset.originalDisplay = jobCardContainer.dataset.originalDisplay || '';
                   jobCardContainer.style.display = 'none';
                   jobCardContainer.classList.add('linkedin-job-filter-hidden');
               }
               return;
           }


            // State Exclusion Check
            const isStateExcluded = excludedLocationsState.some(state => stateFromLocation === state || jobLocationRaw.toLowerCase().includes(state));

            // City Exclusion Check
            const isCityExcluded = excludedLocationsCity.some(city => cityFromLocation.includes(city.trim().toLowerCase()) || jobLocationRaw.toLowerCase().includes(city.trim().toLowerCase()));


            let shouldHideByLocation = false;

            // --- Apply Location Filtering Rules ---
            // Rule 2 Hide Part: If state is excluded AND city is excluded, hide
            if (isStateExcluded && isCityExcluded) {
                shouldHideByLocation = true;
                statesTriggeringRule2Hide.add(stateFromLocation);
            }
            // Rule 3: If city is excluded AND state is NOT excluded, show
            else if (isCityExcluded && !isStateExcluded) {
                shouldHideByLocation = false;
            }
            // Rule 1 & Implicit Rule: If state is excluded AND city is NOT excluded
            else if (isStateExcluded && !isCityExcluded) {
                if (excludedLocationsCity.length === 0) {
                    shouldHideByLocation = true;
                } else {
                    shouldHideByLocation = false;
                }
            }


            // Other Filters (Title, Company)
            const isTitleExcluded = excludedTitles.some(title => jobTitle.includes(title));
            const isCompanyExcluded = excludedCompanies.some(company => jobCompany.includes(company));

            // Combine location and other filters
            if (shouldHideByLocation === true) {
                shouldHideByFilter = true;
            } else if (shouldHideByLocation === false) {
                if (!isTitleExcluded && !isCompanyExcluded) {
                    shouldHideByFilter = false;
                } else {
                    shouldHideByFilter = true;
                }
            } else {
                if (!isTitleExcluded && !isCompanyExcluded) {
                    shouldHideByFilter = false;
                } else {
                    shouldHideByFilter = true;
                }
            }


            // Apply initial hide/show
            if (!item.classList.contains('linkedin-promoted-hidden') && !item.classList.contains('linkedin-manual-hidden')) {
                const itemToModify = item;
                if (shouldHideByFilter) {
                    if (itemToModify && itemToModify.style.display !== 'none') {
                        itemToModify.dataset.originalDisplay = itemToModify.style.display || '';
                        itemToModify.style.display = 'none';
                        itemToModify.classList.add('linkedin-job-filter-hidden');
                    }
                    if (jobCardContainer && jobCardContainer.style.display !== 'none') {
                        jobCardContainer.dataset.originalDisplay = jobCardContainer.dataset.originalDisplay || '';
                        jobCardContainer.style.display = 'none';
                        jobCardContainer.classList.add('linkedin-job-filter-hidden');
                    }
                } else {
                    if (itemToModify && itemToModify.classList.contains('linkedin-job-filter-hidden')) {
                        itemToModify.style.display = itemToModify.dataset.originalDisplay || '';
                        itemToModify.classList.remove('linkedin-job-filter-hidden');
                        delete itemToModify.dataset.originalDisplay;
                    }
                    if (jobCardContainer && jobCardContainer.classList.contains('linkedin-job-filter-hidden')) {
                        jobCardContainer.style.display = jobCardContainer.dataset.originalDisplay || '';
                        jobCardContainer.classList.remove('linkedin-job-filter-hidden');
                        delete jobCardContainer.dataset.originalDisplay;
                    }
                }
            }
       } else { // If custom filters are disabled, ensure all custom-filtered jobs are shown
             if (item.classList.contains('linkedin-job-filter-hidden')) {
                item.style.display = item.dataset.originalDisplay || '';
                item.classList.remove('linkedin-job-filter-hidden');
                delete item.dataset.originalDisplay;
            }
            if (jobCardContainer && jobCardContainer.classList.contains('linkedin-job-filter-hidden')) {
                jobCardContainer.style.display = jobCardContainer.dataset.originalDisplay || '';
                jobCardContainer.classList.remove('linkedin-job-filter-hidden');
                delete jobCardContainer.dataset.originalDisplay;
            }
        }
   });

   // Second Pass (Home Page)
   if (shouldEnableFilters && statesTriggeringRule2Hide.size > 0 && jobItems.length > 0) {
       jobItems.forEach(item => {
            // Check if already hidden by promoted or manual rules. If so, Rule 2 cannot override.
            if (item.classList.contains('linkedin-promoted-hidden') || item.classList.contains('linkedin-manual-hidden')) {
                return;
            }

            // Re-extract data for second pass
            const jobTitleElement = item.querySelector('a.job-card-list__title--link strong');
            const companyAndLocationElement = item.querySelector('div.artdeco-entity-lockup__subtitle span');
            const jobCardContainer = item.querySelector('div.job-card-container');

            const jobTitle = jobTitleElement ? jobTitleElement.textContent.trim().toLowerCase() : '';
            const companyAndLocationText = companyAndLocationElement ? companyAndLocationElement.textContent.trim() : '';
            let jobCompany = '';
            let jobLocationRaw = '';

            const parts = companyAndLocationText.split(' · ');
            if (parts.length >= 1) {
                jobCompany = parts[0].trim().toLowerCase();
                if (parts.length > 1) {
                    jobLocationRaw = parts[1].trim();
                }
            }

            let cityFromLocation = '';
            let stateFromLocation = '';
            if (jobLocationRaw) {
               const locationParts = jobLocationRaw.split(',').map(part => part.trim());
               if (locationParts.length > 0) {
                   cityFromLocation = locationParts[0];
               }
               if (locationParts.length > 1) {
                   const stateAndMaybeMore = locationParts[1].trim();
                   if (stateAndMaybeMore) {
                       const stateMatch = stateAndMaybeMore.match(/^(\w{2})($|\s)/);
                       if (stateMatch && stateMatch[1]) {
                           stateFromLocation = stateMatch[1].toLowerCase();
                       } else {
                           const firstWord = stateAndMaybeMore.split(' ')[0];
                           if(firstWord) {
                               stateFromLocation = firstWord.toLowerCase();
                           }
                       }
                   }
               }
           }

           cityFromLocation = cityFromLocation.toLowerCase();
           stateFromLocation = stateFromLocation.toLowerCase();

           const isCityExcludedForRule2Check = excludedLocationsCity.some(city => cityFromLocation.includes(city.trim().toLowerCase()) || jobLocationRaw.toLowerCase().includes(city.trim().toLowerCase()));
           const isTitleExcludedForRule2Check = excludedTitles.some(title => jobTitle.includes(title));
           const isCompanyExcludedForRule2Check = excludedCompanies.some(company => jobCompany.includes(company));

           // Rule 2 Show Part
           if (statesTriggeringRule2Hide.has(stateFromLocation) &&
               !isCityExcludedForRule2Check &&
               item.classList.contains('linkedin-job-filter-hidden') &&
               !isTitleExcludedForRule2Check &&
               !isCompanyExcludedForRule2Check)
           {
               const itemToModify = item;
               const jobCardContainerToModify = jobCardContainer;

               if (itemToModify) {
                   itemToModify.style.display = itemToModify.dataset.originalDisplay || '';
                   itemToModify.classList.remove('linkedin-job-filter-hidden');
                   delete itemToModify.dataset.originalDisplay;
               }
               if (jobCardContainerToModify) {
                   jobCardContainerToModify.style.display = jobCardContainerToModify.dataset.originalDisplay || '';
                   jobCardContainerToModify.classList.remove('linkedin-job-filter-hidden');
                   delete jobCardContainerToModify.dataset.originalDisplay;
               }
           }
       });
   }
}

function parseToArray(input) {
    if (typeof input === 'string') {
        return input.split(',').map(item => item.trim().toLowerCase()).filter(item => item !== '');
    }
    return Array.isArray(input) ? input.map(item => String(item).trim().toLowerCase()).filter(item => item !== '') : [];
}

function processJobs() {
    isExtensionEnabled(enabled => {
        if (enabled) {
             chrome.storage.local.get({
                 'enableJobFilters': true,
                   'hidePromotedContentEnabled': true,
                   'delayUserHiddenEnabled': true,
                 'excludedTitles': [],
                   'excludedLocationsState': [],
                   'excludedLocationsCity': [],
                   'excludedCompanies': [],
                   'excludedLocationsHardState': []
            }, (data) => {
                const filterData = {
                    enableJobFilters: data.enableJobFilters,
                    hidePromotedContentEnabled: data.hidePromotedContentEnabled,
                    delayUserHiddenEnabled: data.delayUserHiddenEnabled,
                    excludedTitles: parseToArray(data.excludedTitles),
                    excludedLocationsState: parseToArray(data.excludedLocationsState),
                    excludedLocationsCity: parseToArray(data.excludedLocationsCity),
                    excludedCompanies: parseToArray(data.excludedCompanies),
                    excludedLocationsHardState: parseToArray(data.excludedLocationsHardState)
                };

                if (window.location.href.startsWith('https://www.linkedin.com/jobs/search') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
                     processSearchPageJobs(filterData);
                } else if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
                     processHomePageJobs(filterData);
                }
            });
        } else {
            // If extension is disabled, ensure all hidden jobs are shown
            document.querySelectorAll('.linkedin-job-filter-hidden, .linkedin-promoted-hidden, .linkedin-manual-hidden').forEach(el => {
                el.style.display = el.dataset.originalDisplay || '';
                el.classList.remove('linkedin-job-filter-hidden');
                el.classList.remove('linkedin-promoted-hidden');
                el.classList.remove('linkedin-manual-hidden');
                delete el.dataset.originalDisplay;
            });
        }
    });
}

let bodyObserver = null;

function setupGlobalObserver() {
    const body = document.querySelector('body');
    let targetNode = body;
    const observerOptions = { childList: true, subtree: true };

     if (window.location.href.startsWith('https://www.linkedin.com/jobs/search') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
         const jobListContainer = document.querySelector('div.scaffold-layout__list');
         if (jobListContainer) {
             targetNode = jobListContainer;
         }
     } else if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
         targetNode = body; // Observe body for changes on job details or similar pages
     } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
          targetNode = body; // Observe body for feed
     }

    if (targetNode) {
        if (bodyObserver) {
             bodyObserver.disconnect();
        }

        const observer = new MutationObserver(mutationsList => {
            isExtensionEnabled(enabled => {
                if (enabled) {
                    debouncedProcessPage();
                } else {
                    // If extension is disabled, ensure all hidden jobs are shown
                    document.querySelectorAll('.linkedin-job-filter-hidden, .linkedin-promoted-hidden, .linkedin-manual-hidden').forEach(el => {
                        el.style.display = el.dataset.originalDisplay || '';
                        el.classList.remove('linkedin-job-filter-hidden');
                        el.classList.remove('linkedin-promoted-hidden');
                        el.classList.remove('linkedin-manual-hidden');
                        delete el.dataset.originalDisplay;
                    });
                }
            });
        });
        observer.observe(targetNode, observerOptions);
        bodyObserver = observer;
    }
}

function debouncedProcessPage() {
    if (debounceTimeoutId) {
        clearTimeout(debounceTimeoutId);
    }
    debounceTimeoutId = setTimeout(() => {
        isExtensionEnabled(enabled => {
            if (enabled) {
                if (window.location.href !== currentUrl) {
                    hasLoggedInfo = false;
                }

                if (!hasLoggedInfo) {
                     logExtensionInfo();
                     currentUrl = window.location.href;
                     hasLoggedInfo = true;
                }

                if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
                    processJobs();
                } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/') {
                    processFeed();
                }
            } else {
                hasLoggedInfo = false;
                currentUrl = null;
                // If extension is disabled, ensure all hidden jobs are shown
                document.querySelectorAll('.linkedin-job-filter-hidden, .linkedin-promoted-hidden, .linkedin-manual-hidden').forEach(el => {
                    el.style.display = el.dataset.originalDisplay || '';
                    el.classList.remove('linkedin-job-filter-hidden');
                    el.classList.remove('linkedin-promoted-hidden');
                    el.classList.remove('linkedin-manual-hidden');
                    delete el.dataset.originalDisplay;
                });
            }
        });
        debounceTimeoutId = null;
    }, debounceDelay);
}

window.addEventListener('load', () => {
    initialize();
    isExtensionEnabled(enabled => {
        if (enabled) {
             debouncedProcessPage();
        } else {
            // On load, if disabled, ensure all are visible
            document.querySelectorAll('.linkedin-job-filter-hidden, .linkedin-promoted-hidden, .linkedin-manual-hidden').forEach(el => {
                el.style.display = el.dataset.originalDisplay || '';
                el.classList.remove('linkedin-job-filter-hidden');
                el.classList.remove('linkedin-promoted-hidden');
                el.classList.remove('linkedin-manual-hidden');
                delete el.dataset.originalDisplay;
            });
        }
    });
});

window.addEventListener('popstate', debouncedProcessPage);
window.addEventListener('hashchange', debouncedProcessPage);

// Add CSS for the hidden classes
// Keep the style injection
const style = document.createElement('style');
style.textContent = `
  .linkedin-job-filter-hidden,
  .linkedin-promoted-hidden,
  .linkedin-manual-hidden {
    display: none !important;
  }
`;
document.head.appendChild(style);
