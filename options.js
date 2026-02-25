document.addEventListener('DOMContentLoaded', () => {
  const displayCountInput = document.getElementById('display-count');
  const saveBtn = document.getElementById('save-btn');
  const statusMsg = document.getElementById('save-status');

  // Load existing setting
  chrome.storage.sync.get({ displayCount: 25 }, (items) => {
    displayCountInput.value = items.displayCount;
  });

  // Save changes
  saveBtn.addEventListener('click', () => {
    let count = parseInt(displayCountInput.value, 10);
    
    // Validate value max sessions is 25 theoretically
    if (isNaN(count) || count < 1) {
      count = 25;
    } else if (count > 25) {
      count = 25;
    }
    
    displayCountInput.value = count; // reset UI if over max

    chrome.storage.sync.set({ displayCount: count }, () => {
      // Show saved message
      statusMsg.textContent = 'Settings saved.';
      statusMsg.classList.add('show');
      
      setTimeout(() => {
        statusMsg.classList.remove('show');
      }, 2000);
    });
  });
});
