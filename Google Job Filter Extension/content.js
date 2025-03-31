console.log("Content script is running!");

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
    let hiddenCount = 0;
    feedItems.forEach(item => {
        if (hidePromotedFeedItem(item)) {
            hiddenCount++;
        }
    });
    // console.log("Processed", feedItems.length, " feed items, attempted to hide", hiddenCount, " promoted items.");
}

// --- Observer setup ---
function setupGlobalObserver() {
    const body = document.querySelector('body');
    if (body) {
        const observer = new MutationObserver(mutationsList => {
            if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
                console.log('URL is jobs, processing jobs.');
                processJobs();
            } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
                console.log('URL is feed, processing feed.');
                processFeed();
            }
        });
        observer.observe(body, { childList: true, subtree: true });
    } else {
        console.log('Body element not found for MutationObserver.');
    }
}

// --- Adapted Jobs Page Logic (based on home page pattern) ---
function hidePromotedJobCard(jobCardLi) {
    const promotedFooterItems = jobCardLi.querySelectorAll('.job-card-container__footer-item');
    if (promotedFooterItems) {
        for (const footerItem of promotedFooterItems) {
            const promotedSpan = footerItem.querySelector('span[dir="ltr"]');
            if (promotedSpan && promotedSpan.textContent.trim().toLowerCase() === 'promoted') {
                if (jobCardLi) {
                    // console.log('Found promoted job card, adding "hidden-promoted" class:', jobCardLi);
                    jobCardLi.classList.add('hidden-promoted');
                    return true;
                }
            }
        }
    }
    return false;
}

function processJobs() {
    if (window.location.href.startsWith('https://www.linkedin.com/jobs/search')) {
        // Logic for jobs search results page (covers both with and without trailing slash)
        const jobItems = document.querySelectorAll('li.scaffold-layout__list-item');
        let hiddenCount = 0;
        jobItems.forEach(item => {
            const promotedFooterItems = item.querySelectorAll('.job-card-container__footer-item');
            if (promotedFooterItems) {
                for (const footerItem of promotedFooterItems) {
                    const promotedSpan = footerItem.querySelector('span[dir="ltr"]');
                    if (promotedSpan && promotedSpan.textContent.trim().toLowerCase() === 'promoted') {
                        item.style.display = 'none';
                        hiddenCount++;
                        break;
                    }
                }
            }
        });
        // console.log("Processed", jobItems.length, " job items, hidden", hiddenCount, " promoted items (search).");
    } else if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
        // Logic for jobs home page (using the selector that worked for you before)
        const jobItems = document.querySelectorAll('li.discovery-templates-entity-item');
        let hiddenCount = 0;
        jobItems.forEach(item => {
            if (hidePromotedJobCard(item)) {
                hiddenCount++;
            }
        });
        // console.log("Processed", jobItems.length, " job items, attempted to hide", hiddenCount, " promoted items (home).");
    }
}

// --- Initialization ---
window.addEventListener('load', () => {
    setupGlobalObserver();
    if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
        processJobs();
    } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
        processFeed();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
        processJobs();
    } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
        processFeed();
    }
});

// Listen for visibility change to re-run processing when the tab becomes visible
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
            processJobs();
        } else if (window.location.href.startsWith('https://www.linkedin.com/feed/') || window.location.href === 'https://www.linkedin.com/' || window.location.href === 'https://www.linkedin.com/feed/') {
            processFeed();
        }
    }
});

// Remove hashchange listener for now as the global observer might be sufficient
// window.addEventListener('hashchange', () => {
//     console.log('Hash changed, checking URL for processing.');
//     runJobsProcessing();
//     runFeedProcessing();
// });
