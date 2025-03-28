console.log("Content script is running!");

// Function to hide promoted feed items
function hidePromotedFeedItem(feedPost) {
  const promotedMeta = feedPost.querySelector('.update-components-actor__meta');
  if (promotedMeta) {
    const promotedSpan = promotedMeta.querySelector('.update-components-actor__sub-description > span[aria-hidden="true"]');
    if (promotedSpan && promotedSpan.textContent.trim() === 'Promoted') {
      if (feedPost && feedPost.style.display !== 'none') {
        console.log('Found and hiding feed promoted post:', feedPost);
        feedPost.style.display = 'none';
        return true;
      }
    }
  }
  return false;
}

// Function to process feed items
function processFeed() {
  const feedItems = document.querySelectorAll('.feed-shared-update-v2');
  let hiddenCount = 0;
  feedItems.forEach(item => {
    if (hidePromotedFeedItem(item)) {
      hiddenCount++;
    }
  });
  console.log("Processed", feedItems.length, " feed items, attempted to hide", hiddenCount, " promoted items.");
}

// Run feed processing on page load
processFeed();

// Set up MutationObserver for dynamically loaded feed content
const feedContainer = document.querySelector('.scaffold-finite-scroll');
if (feedContainer) {
  const observer = new MutationObserver(mutationsList => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        console.log('New items added to the feed, re-filtering.');
        processFeed();
      }
    }
  });
  observer.observe(feedContainer, { childList: true, subtree: true });
} else {
  console.log('Feed container not found for MutationObserver.');
}

// Function to hide promoted job listings
function hidePromotedJobs() {
  const jobCards = document.querySelectorAll('.job-card-container');
  let hiddenCount = 0;
  jobCards.forEach(card => {
    const promotedLabelContainer = card.querySelector('.job-card-container__footer-item');
    if (promotedLabelContainer && promotedLabelContainer.textContent.trim() === 'Promoted') {
      console.log('Found and hiding promoted job card:', card);
      const listItem = card.closest('li.discovery-templates-entity-item');
      if (listItem) {
        listItem.style.display = 'none';
        hiddenCount++;
      } else {
        card.style.display = 'none'; // Fallback if li is not found
      }
    }
  });
  console.log('Attempted to hide', hiddenCount, 'promoted job listings on the jobs page.');
}

// Run job hiding after the entire page has loaded
if (window.location.href.startsWith('https://www.linkedin.com/jobs/')) {
  window.addEventListener('load', hidePromotedJobs);

  // Set up an observer for dynamic content on the jobs page
  const jobsContainer = document.querySelector('.scaffold-finite-scroll__content');
  if (jobsContainer) {
    const observerJobs = new MutationObserver(mutationsList => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          console.log('New job listings added, re-filtering for promoted jobs.');
          hidePromotedJobs();
        }
      }
    });
    observerJobs.observe(jobsContainer, { childList: true, subtree: true });
  } else {
    console.log('Jobs content container not found for MutationObserver.');
  }
}
