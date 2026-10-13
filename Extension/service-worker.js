// Set up context menu on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-savereason",
    title: "Save to SaveReason",
    contexts: ["page", "selection", "link"]
  });
});

// Capture page + selected text via right-click context menu
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-savereason") {
    chrome.storage.local.set({
      savedPage: {
        title: tab.title,
        url: tab.url,
        selectedText: info.selectionText || ""
      }
    });
  }
});
