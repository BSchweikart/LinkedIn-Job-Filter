console.log("Content script is running!");

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

        if (window.location.href.startsWith('https://www.linkedin.com/jobs/search')) {
            console.log("Current Function:", "processJobs (search)");
        } else if (window.location.href.startsWith('https://www.linkedin.com/jobs/') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
            console.log("Current Function:", "processJobs (home/other)");
        } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
            console.log("Current Function:", "processFeed");
        }
    });
}

function initialize() {
    setupGlobalObserver();
    // Initial processing will be done by the event listeners
}

// --- Home Page Logic ---
function hidePromotedFeedItem(feedPost) {
    const promotedMeta = feedPost.querySelector('.update-components-actor__meta');
    if (promotedMeta) {
        const promotedSpan = promotedMeta.querySelector('.update-components-actor__sub-description > span[aria-hidden="true"]');
        if (promotedSpan && promotedSpan.textContent.trim() === 'Promoted') {
            if (feedPost && feedPost.style.display !== 'none') {
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
                hidePromotedFeedItem(item);
            });
        }
    });
}

// --- Observer setup ---
let bodyObserver = null; // Declare observer outside the function

function setupGlobalObserver() {
    const body = document.querySelector('body');
    let targetNode = body;
    const observerOptions = { childList: true, subtree: true };

    if (window.location.href.startsWith('https://www.linkedin.com/jobs/search') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
        const jobListContainer = document.querySelector('div.scaffold-layout__list');
        if (jobListContainer) {
            targetNode = jobListContainer;
        }
    }

    if (targetNode) {
        const observer = new MutationObserver(mutationsList => {
            isExtensionEnabled(enabled => {
                if (enabled) {
                    debouncedProcessPage();
                }
            });
        });
        observer.observe(targetNode, observerOptions);
        bodyObserver = observer; // Assign observer to the global variable
    } else {
        // console.log('Target element not found for MutationObserver.'); // Removed
    }
}

// --- Adapted Jobs Page Logic (based on home page pattern) ---
function hidePromotedJobCard(jobCardLi) {
    const promotedFooterItems = jobCardLi.querySelectorAll('.job-card-container__footer-item');
    if (promotedFooterItems) {
        for (const footerItem of promotedFooterItems) {
            const promotedSpan = footerItem.querySelector('span[dir="ltr"]');
            if (promotedSpan && promotedSpan.textContent.trim().toLowerCase() === 'promoted') {
                if (jobCardLi && jobCardLi.style.display !== 'none') {
                    jobCardLi.dataset.originalDisplay = jobCardLi.style.display || '';
                    jobCardLi.style.display = 'none';
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
                            jobCardLi.dataset.originalDisplay = jobCardLi.style.display || '';
                            jobCardLi.style.display = 'none';
                        }
                        delete jobCardLi.dataset.delayHide;
                    }, 5000);
                } else {
                    jobCardLi.dataset.originalDisplay = jobCardLi.style.display || '';
                    jobCardLi.style.display = 'none';
                }
            });
            return true;
        }
        return true; // Still mark as found
    } else if (isBeingDelayed) {
        // The "We won’t show you this job again." message is gone, but we were delaying.
        // This means it was likely unhidden. Cancel the hide.
        delete jobCardLi.dataset.delayHide;
        if (jobCardLi.dataset.originalDisplay) {
            jobCardLi.style.display = jobCardLi.dataset.originalDisplay || '';
            delete jobCardLi.dataset.originalDisplay;
        } else if (jobCardLi.style.display === 'none') {
            jobCardLi.style.display = ''; // Try to restore if no original display was set
        }
    } else if (jobCardLi && jobCardLi.dataset.originalDisplay && jobCardLi.style.display === 'none') {
        // If we previously hid it and the message is gone, ensure it's visible
        jobCardLi.style.display = jobCardLi.dataset.originalDisplay || '';
        delete jobCardLi.dataset.originalDisplay;
    }

    return false;
}

function processJobs() {
    isExtensionEnabled(enabled => {
        if (enabled) {
            chrome.storage.local.get({
                'enableJobFilters': false,
                'excludedTitles': [],
                'excludedLocationsState': [],
                'excludedLocationsCity': [],
                'excludedCompanies': []
            }, (filterData) => {
                //console.log("Filter Data Retrieved:", filterData); // ADDED LOGGING

                const shouldEnableFilters = filterData.enableJobFilters;
                const excludedTitles = filterData.excludedTitles.map(s => s.toLowerCase());
                const excludedLocationsState = filterData.excludedLocationsState.map(s => s.toLowerCase());
                const excludedLocationsCity = filterData.excludedLocationsCity.map(s => s.toLowerCase());
                const excludedCompanies = filterData.excludedCompanies.map(s => s.toLowerCase());

                //console.log("Should Enable Filters:", shouldEnableFilters); // ADDED LOGGING
                //console.log("Excluded Titles:", excludedTitles); // ADDED LOGGING
                //console.log("Excluded Locations (State/Region):", excludedLocationsState); // ADDED LOGGING
                //console.log("Excluded Locations (City):", excludedLocationsCity); // ADDED LOGGING
                //console.log("Excluded Companies:", excludedCompanies); // ADDED LOGGING

                let jobListContainer;
                let jobItems;

                if (window.location.href.startsWith('https://www.linkedin.com/jobs/search') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
                    jobListContainer = document.querySelector('div.scaffold-layout__list');
                    if (jobListContainer) {
                        jobItems = jobListContainer.querySelectorAll('li.scaffold-layout__list-item');
                    }
                } else if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
                    jobItems = document.querySelectorAll('li.discovery-templates-entity-item');
                }

                if (jobItems) {
                    jobItems.forEach(item => {
                        hidePromotedJobCard(item); // Keep existing promoted job hiding

                        if (shouldEnableFilters) {
                            // --- Get job details from the DOM ---
                            const jobTitleElement = item.querySelector('a.job-card-list__title--link strong');
                            const jobLocationElement = item.querySelector('ul.job-card-container__metadata-wrapper li span');
                            const jobCompanyElement = item.querySelector('div.artdeco-entity-lockup__subtitle span');
                            const jobCardContainer = item.querySelector('div.job-card-container'); // Target the job-card-container

                            const jobTitle = jobTitleElement ? jobTitleElement.textContent.trim().toLowerCase() : '';
                            const jobLocation = jobLocationElement ? jobLocationElement.textContent.trim().toLowerCase() : '';
                            const jobCompany = jobCompanyElement ? jobCompanyElement.textContent.trim().toLowerCase() : '';

                            //console.log("Job Title:", jobTitle); // ADDED LOGGING
                            //console.log("Job Location Found:", jobLocation); // ADDED LOGGING
                            const locationParts = jobLocation.split(',').map(part => part.trim());
                            const cityFromLocation = locationParts[0] || '';
                            const stateFromLocation = locationParts[1] ? locationParts[1].trim().split(' ')[0] : ''; // Take only the state abbreviation

                            //console.log("City from Location:", cityFromLocation); // ADDED LOGGING
                            //console.log("State from Location:", stateFromLocation); // ADDED LOGGING

                            let shouldHideByFilter = false;

                            if (excludedTitles.some(title => jobTitle.includes(title))) {
                                shouldHideByFilter = true;
                            }

                            // --- State/Region Filtering ---
                            const isStateExcluded = excludedLocationsState.some(state => stateFromLocation === state);

                            // --- City Filtering ---
                            const isCityExcluded = excludedLocationsCity.some(city => cityFromLocation.includes(city.trim().toLowerCase()));

                            let shouldHideByLocation = false;

                            // If the state is excluded
                            if (isStateExcluded) {
                                // But the city is NOT excluded, then show
                                if (!isCityExcluded) {
                                    shouldHideByLocation = false;
                                } else {
                                    shouldHideByLocation = true; // State is excluded AND city is excluded, so hide
                                }
                            }
                            // If the state is NOT excluded, but the city IS excluded
                            else if (isCityExcluded) {
                                shouldHideByLocation = false; // Show
                            }

                            if (shouldHideByLocation) {
                                shouldHideByFilter = true;
                            }

                            if (excludedCompanies.some(company => jobCompany.includes(company))) {
                                shouldHideByFilter = true;
                            }

                            //console.log("shouldHideByFilter for", jobLocation, "is", shouldHideByFilter); // ADDED LOGGING
                            if (shouldHideByFilter) {
                                if (item.style.display !== 'none') {
                                    item.dataset.originalDisplay = item.style.display || '';
                                    item.style.display = 'none';
                                    item.classList.add('linkedin-job-filter-hidden');
                                }
                                if (jobCardContainer && jobCardContainer.style.display !== 'none') {
                                    jobCardContainer.dataset.originalDisplay = jobCardContainer.style.display || '';
                                    jobCardContainer.style.display = 'none';
                                    jobCardContainer.classList.add('linkedin-job-filter-hidden');
                                }
                            } else {
                                // If shouldHideByFilter is false, ensure it's visible in case it was previously hidden
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
                        }
                    });
                }
            });
        }
    });
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
                    logExtensionInfo();
                    currentUrl = window.location.href;
                    hasLoggedInfo = true;
                }
                if (window.location.href.startsWith('https://www.linkedin.com/jobs/') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
                    processJobs();
                } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
                    processFeed();
                }
            } else {
                hasLoggedInfo = false;
                currentUrl = null;
            }
        });
        debounceTimeoutId = null;
    }, debounceDelay);
}

// --- Initialization and Event Listeners ---
window.addEventListener('load', () => {
    initialize();
    isExtensionEnabled(enabled => {
        if (enabled) {
            logExtensionInfo();
            currentUrl = window.location.href; // Initialize currentUrl
            if (window.location.href.startsWith('https://www.linkedin.com/jobs/') || window.location.href.startsWith('https://www.linkedin.com/jobs/collections')) {
                // Introduce a small delay on initial load
                setTimeout(processJobs, 500);
            } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
                processFeed();
            }
            hasLoggedInfo = true;
        }
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // Removed runProcessing();
});

document.addEventListener('visibilitychange', () => {
    // Removed runProcessing();
});

window.addEventListener('popstate', () => {
    // Removed runProcessing();
});

window.addEventListener('hashchange', () => {
    // Removed runProcessing();
});

const style = document.createElement('style');
style.textContent = `
  .linkedin-job-filter-hidden {
    display: none !important;
  }
`;
document.head.appendChild(style);
