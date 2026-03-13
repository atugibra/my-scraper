// STANDALONE ENHANCEMENT: Excel Download with Save Dialog
// This file adds a "saveAs" dialog option without modifying the original excel_generator.js

/**
 * Enhanced download function that shows a save dialog
 * Drop-in replacement for the original downloadExcelViaExtension function
 */
async function downloadExcelWithDialog(blob, filename = 'Football_Data.xlsx') {
    // Convert blob to data URL
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result;

            // Use Chrome downloads API with saveAs: true
            chrome.downloads.download({
                url: dataUrl,
                filename: filename,  // Suggested filename
                saveAs: true,        // ⭐ THIS SHOWS THE SAVE DIALOG! ⭐
                conflictAction: 'uniquify'  // Auto-rename if file exists
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    console.log(`✅ Download initiated: ${downloadId}`);
                    resolve(downloadId);
                }
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Original download function (for comparison/backup)
 * This one auto-downloads to Downloads folder without asking
 */
async function downloadExcelAuto(blob, filename = 'Football_Data.xlsx', folder = 'football_data') {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result;

            chrome.downloads.download({
                url: dataUrl,
                filename: `${folder}/${filename}`,
                saveAs: false,  // Auto-download without dialog
                conflictAction: 'overwrite'
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(downloadId);
                }
            });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Export enhanced version
if (typeof window !== 'undefined') {
    window.ExcelDownloadEnhanced = {
        downloadExcelWithDialog,
        downloadExcelAuto
    };
}
