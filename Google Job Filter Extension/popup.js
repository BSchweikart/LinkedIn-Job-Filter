document.addEventListener('DOMContentLoaded', () => {
    const extensionToggle = document.getElementById('extensionToggle');
  
    chrome.storage.local.get('extensionEnabled', (data) => {
      const enabled = data.extensionEnabled === true;
      extensionToggle.checked = enabled;
    });
  
    extensionToggle.addEventListener('change', () => {
      const newState = extensionToggle.checked;
      chrome.storage.local.set({ 'extensionEnabled': newState }, () => {
        // No need to update button text anymore
      });
    });
  });
