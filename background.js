async function ensureOffscreen() {
    const hasDocument = await chrome.offscreen.hasDocument();

    if (!hasDocument) {
        try {
            await chrome.offscreen.createDocument({
                url: "offscreen.html",
                reasons: ["AUDIO_PLAYBACK"],
                justification: "Play sound effects in the background."
            });
        } catch (err) {
            console.error("Failed to create offscreen document:", err);
        }
    }
}

async function playSound(action) {
    await ensureOffscreen();

    chrome.storage.local.get(["volumes"], (data) => {
        const volumes = data.volumes || {};
        const volume = volumes[action] !== undefined ? volumes[action] / 100 : 0.5;

        chrome.runtime.sendMessage({
            action: "playSoundOffscreen",
            sound: action,
            volume: volume
        });
    });
}

chrome.tabs.onCreated.addListener(() => playSound("tab_open"));
chrome.tabs.onRemoved.addListener(() => playSound("tab_close"));

chrome.tabs.onMoved.addListener(() => playSound("tab_dragging"));

chrome.downloads.onCreated.addListener(() => playSound("download_start"));
chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state?.current === "complete") playSound("download_complete");
    if (delta.state?.current === "interrupted") playSound("download_failed");
});

chrome.bookmarks.onCreated.addListener(() => playSound("bookmark_added"));

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.mutedInfo) {
        const soundName = changeInfo.mutedInfo.muted ? "tab_muted" : "tab_unmuted";
        playSound(soundName);
    }
});

chrome.runtime.onInstalled.addListener(() => injectContentScripts());
chrome.runtime.onStartup.addListener(() => injectContentScripts());

function injectContentScripts() {
    chrome.tabs.query({ url: ["https://*/*", "HTTPS://*/*"] }, (tabs) => {
        for (let tab of tabs) {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ["content.js"]
            }).catch(err => {
                if (!err.message.includes("Cannot access a chrome:// URL")) {
                    console.error("Failed to inject content script into tab:", tab.url, err);
                }
            });
        }
    });
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === "complete" && (tab.url.startsWith("http://") || tab.url.startsWith("https://"))) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content.js"]
        }).catch(err => {
            if (!err.message.includes("Cannot access a chrome:// URL")) {
                console.error("Failed to re-inject content script into tab on update:", tab.url, err);
            }
        });
    }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === "updateVolume") {

        chrome.tabs.query({ url: ["http://*/*", "https://*/*"] }, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: "volumeChanged",
                    soundName: message.soundName,
                    volume: message.volume
                }).catch(err => {
                    if (!err.message.includes("Receiving end does not exist")) {
                        console.warn("Could not send volume update to tab:", tab.id, err);
                    }
                });
            });
        });

    }

    if (message.action === "playSound") {
        await playSound(message.sound);
    }

    if (message.action === "playSoundOffScreen") {
    }
});
