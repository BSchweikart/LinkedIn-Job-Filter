document.addEventListener('DOMContentLoaded', () => {
    const delayUserHiddenCheckbox = document.getElementById('delayUserHidden');

    // Load the saved state from storage
    chrome.storage.local.get('delayUserHiddenEnabled', (data) => {
        delayUserHiddenCheckbox.checked = data.delayUserHiddenEnabled === true;
    });

    // Save the state when the checkbox changes
    delayUserHiddenCheckbox.addEventListener('change', (event) => {
        chrome.storage.local.set({ 'delayUserHiddenEnabled': event.target.checked });
    });
});