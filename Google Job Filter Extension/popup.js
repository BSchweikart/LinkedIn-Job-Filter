document.addEventListener('DOMContentLoaded', () => {
    const extensionToggle = document.getElementById('extensionToggle');
    const delayUserHiddenCheckboxPopup = document.getElementById('delayUserHiddenPopup');
    const openOptionsPageLink = document.getElementById('openOptionsPage');

    // Load the saved state of the main extension toggle
    chrome.storage.local.get('extensionEnabled', (data) => {
        extensionToggle.checked = data.extensionEnabled === true;
    });

    // Save the state of the main extension toggle when it changes
    extensionToggle.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'extensionEnabled': event.target.checked });
    });

    // Load the saved state for the delay setting and set the popup checkbox
    chrome.storage.local.get('delayUserHiddenEnabled', (data) => {
        delayUserHiddenCheckboxPopup.checked = data.delayUserHiddenEnabled === true;
    });

    // Save the state for the delay setting when the popup checkbox changes
    delayUserHiddenCheckboxPopup.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'delayUserHiddenEnabled': event.target.checked });
    });

    // Add event listener to open the options page
    if (openOptionsPageLink) {
        openOptionsPageLink.addEventListener('click', (event) => {
            event.preventDefault(); // Prevent the link from navigating
            chrome.runtime.openOptionsPage();
        });
    }
});
