// Background script for Football League Auto Saver
let autoSaveEnabled = false;
let downloadFolder = 'data1';
let downloadCount = 0;
let totalExpected = 0;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startAutoSave') {
    autoSaveEnabled = true;
    downloadFolder = request.folder || 'data1';
    downloadCount = 0; // Reset counter
    totalExpected = 0;
    sendResponse({ success: true });
  } else if (request.action === 'stopAutoSave') {
    autoSaveEnabled = false;
    downloadCount = 0;
    totalExpected = 0;
    sendResponse({ success: true });
  } else if (request.action === 'getStatus') {
    sendResponse({
      enabled: autoSaveEnabled,
      folder: downloadFolder,
      count: downloadCount,
      total: totalExpected
    });
  } else if (request.action === 'setExpected') {
    totalExpected = request.total || 28;
    sendResponse({ success: true });
  }
});

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only proceed if auto-save is enabled and page is fully loaded
  if (!autoSaveEnabled || changeInfo.status !== 'complete') {
    return;
  }

  // Check if it's an FBref page
  if (tab.url && tab.url.includes('fbref.com')) {
    // Wait a moment for page to fully render
    setTimeout(() => {
      savePage(tabId, tab.url);
    }, 2000);
  }
});

async function savePage(tabId, url) {
  try {
    // Extract filename from URL
    const filename = generateFilename(url);

    // Execute script to get page HTML
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        return document.documentElement.outerHTML;
      }
    });

    if (results && results[0]) {
      const html = results[0].result;

      // Convert HTML to base64 data URL (works in service workers!)
      const base64 = btoa(unescape(encodeURIComponent(html)));
      const dataUrl = `data:text/html;base64,${base64}`;

      // Download the file
      chrome.downloads.download({
        url: dataUrl,
        filename: `${downloadFolder}/${filename}`,
        saveAs: false,
        conflictAction: 'overwrite'
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError);
        } else {
          downloadCount++;
          console.log(`Saved (${downloadCount}/${totalExpected}):`, filename);

          // Show notification with progress
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon48.png',
            title: `Saved ${downloadCount}/${totalExpected}`,
            message: filename,
            priority: 0
          });

          // Check if all files are downloaded
          if (totalExpected > 0 && downloadCount >= totalExpected) {
            // Show completion notification
            setTimeout(() => {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon128.png',
                title: '✅ ALL FILES SAVED!',
                message: `All ${downloadCount} files saved to Downloads/${downloadFolder}/`,
                priority: 2
              });
            }, 2000);
          }

          // Close the tab after saving
          setTimeout(() => {
            chrome.tabs.remove(tabId);
          }, 1000);
        }

      });
    }
  } catch (error) {
    console.error('Error saving page:', error);
  }
}

function generateFilename(url) {
  // Map URLs to your exact filenames
  const urlMap = {
    'fbref.com/en/comps/20/schedule/Bundesliga-Scores-and-Fixtures': 'Bundesliga Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/20/Bundesliga-Stats': 'Bundesliga Stats_ _FBref.com',
    'fbref.com/en/comps/33/schedule/2-Bundesliga-Scores-and-Fixtures': '2. Bundesliga Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/33/2-Bundesliga-Stats': '2. Bundesliga Stats_ _FBref.com',
    'fbref.com/en/comps/37/schedule/Belgian-Pro-League-Scores-and-Fixtures': 'Belgian Pro League Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/37/Belgian-Pro-League-Stats': 'Belgian Pro League Stats_ _FBref.com',
    'fbref.com/en/comps/10/schedule/Championship-Scores-and-Fixtures': 'Championship Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/10/Championship-Stats': 'Championship Stats_ _FBref.com',
    'fbref.com/en/comps/23/schedule/Eredivisie-Scores-and-Fixtures': 'Eredivisie Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/23/Eredivisie-Stats': 'Eredivisie Stats_ _FBref.com',
    'fbref.com/en/comps/12/schedule/La-Liga-Scores-and-Fixtures': 'La Liga Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/12/La-Liga-Stats': 'La Liga Stats_ _FBref.com',
    'fbref.com/en/comps/15/schedule/League-One-Scores-and-Fixtures': 'League One Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/15/League-One-Stats': 'League One Stats_ _FBref.com',
    'fbref.com/en/comps/16/schedule/League-Two-Scores-and-Fixtures': 'League Two Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/16/League-Two-Stats': 'League Two Stats_ _FBref.com',
    'fbref.com/en/comps/13/schedule/Ligue-1-Scores-and-Fixtures': 'Ligue 1 Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/60/schedule/Ligue-2-Scores-and-Fixtures': 'Ligue 2 Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/9/schedule/Premier-League-Scores-and-Fixtures': 'Premier League Score & Fixtures_ _FBref.com',
    'fbref.com/en/comps/9/Premier-League-Stats': 'Premier League Stats_ _FBref.com',
    'fbref.com/en/comps/17/schedule/Segunda-Division-Scores-and-Fixtures': 'Segunda Division Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/17/Segunda-Division-Stats': 'Segunda Division Stats_ _FBref.com',
    'fbref.com/en/comps/11/schedule/Serie-A-Scores-and-Fixtures': 'Serie A Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/11/Serie-A-Stats': 'Serie A Stats_ _FBref.com',
    'fbref.com/en/comps/18/schedule/Serie-B-Scores-and-Fixtures': 'Serie B Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/18/Serie-B-Stats': 'Serie B Stats_ _FBref.com',
    'fbref.com/en/comps/26/schedule/Super-Lig-Scores-and-Fixtures': 'Super Lig Scores & Fixtures_ _FBref.com',
    'fbref.com/en/comps/26/Super-Lig-Stats': 'Super Lig Stats_ _FBref.com'
  };

  // Find matching filename
  for (const [pattern, filename] of Object.entries(urlMap)) {
    if (url.includes(pattern)) {
      return filename + '.html';
    }
  }

  // Fallback to URL-based filename
  return 'FBref_Page.html';
}
