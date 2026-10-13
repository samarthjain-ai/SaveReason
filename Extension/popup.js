// ── State ────────────────────────────────────────────────────
let selectedReason = "";

// ── Reason buttons ───────────────────────────────────────────
const reasonButtons = document.querySelectorAll(".reason");
reasonButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    reasonButtons.forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedReason = btn.dataset.reason || btn.textContent.trim();
    document.getElementById("customReason").value = "";
  });
});

// ── Capture selected text from the active tab via scripting ──
// chrome.scripting.executeScript injects into the real page DOM,
// so window.getSelection() returns the user's actual text selection.
function getSelectedTextFromTab(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: () => (window.getSelection() || "").toString().trim(),
      },
      (results) => {
        if (chrome.runtime.lastError || !results || !results[0]) {
          resolve("");
        } else {
          resolve(results[0].result || "");
        }
      }
    );
  });
}

// ── Load page info on popup open ─────────────────────────────
chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
  const tab = tabs && tabs[0];

  if (
    tab &&
    tab.url &&
    !tab.url.startsWith("chrome://") &&
    !tab.url.startsWith("chrome-extension://") &&
    !tab.url.startsWith("about:")
  ) {
    // Inject into the page to get live selection
    let liveSelection = "";
    try {
      liveSelection = await getSelectedTextFromTab(tab.id);
    } catch (_) {
      // Scripting may fail on some pages (e.g. chrome store) — fall back gracefully
    }

    // If no live selection, check if context menu stored one for this URL
    if (!liveSelection) {
      const stored = await chromeGet("savedPage");
      if (stored && stored.url === tab.url) {
        liveSelection = stored.selectedText || "";
      }
    }

    const page = {
      title: tab.title || "Untitled page",
      url: tab.url,
      selectedText: liveSelection,
    };

    await chromeSet({ savedPage: page });
    showPage(page);

  } else {
    // Fallback: load context-menu stored page
    const stored = await chromeGet("savedPage");
    if (stored) {
      showPage(stored);
    } else {
      document.getElementById("pageTitle").textContent = "No page selected";
      document.getElementById("pageUrl").textContent   = "Open a webpage first";
      document.getElementById("selectedTextDisplay").textContent = "No text selected — your reason will be used to create the memory.";
    }
  }
});

// ── Display helpers ───────────────────────────────────────────
function showPage(page) {
  document.getElementById("pageTitle").textContent = page.title || "Untitled page";
  document.getElementById("pageUrl").textContent   = getDomain(page.url) || page.url;

  const sel = (page.selectedText || "").trim();
  const selDisplay = document.getElementById("selectedTextDisplay");
  if (sel) {
    selDisplay.textContent = `"${sel.length > 140 ? sel.substring(0, 140) + "…" : sel}"`;
    selDisplay.classList.add("has-text");
  } else {
    selDisplay.textContent = "No text selected — your reason will be used to create the memory.";
    selDisplay.classList.remove("has-text");
  }
}

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url || ""; }
}

// ── Chrome storage promise wrappers ──────────────────────────
function chromeGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (r) => resolve(r[key] || null));
  });
}
function chromeSet(obj) {
  return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
}

// ── Save button ───────────────────────────────────────────────
document.getElementById("saveButton").addEventListener("click", async () => {
  const saveButton = document.getElementById("saveButton");

  const customReason = document.getElementById("customReason").value.trim();
  const reason       = customReason || selectedReason;

  setStatus("", "");

  if (!reason) {
    setStatus("Please choose or enter a reason.", "error");
    return;
  }

  const savedPage = await chromeGet("savedPage");

  if (!savedPage || !savedPage.url) {
    setStatus("No page found. Open a webpage and try again.", "error");
    return;
  }

  setStatus("Creating your memory…", "loading");
  saveButton.disabled = true;

  try {
    const response = await fetch("http://localhost:5000/api/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:        savedPage.title || "Untitled page",
        url:          savedPage.url,
        reason:       reason,
        selectedText: savedPage.selectedText || "",
      }),
    });

    const raw = await response.text();
    let data  = {};
    try { data = raw ? JSON.parse(raw) : {}; }
    catch { throw new Error("Server returned an unreadable response."); }

    if (!response.ok) {
      throw new Error(data.details || data.error || `Server error ${response.status}`);
    }

    setStatus("✓ Memory saved!", "success");
    document.getElementById("customReason").value = "";
    reasonButtons.forEach((b) => b.classList.remove("selected"));
    selectedReason = "";

  } catch (err) {
    if (err instanceof TypeError) {
      setStatus("Cannot reach backend. Is server.js running?", "error");
    } else {
      setStatus("Error: " + err.message, "error");
    }
    console.error("[SaveReason]", err);
  } finally {
    saveButton.disabled = false;
  }
});

function setStatus(msg, type) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className   = "status" + (type ? " " + type : "");
}
