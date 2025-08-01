let currentSoundPaths = {};

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

    const soundFile = currentSoundPaths[action];
    if (!soundFile) {
        console.warn(`No sound file found for action: ${action}`);
        return;
    }

    chrome.storage.local.get(["volumes"], (data) => {
        const volumes = data.volumes || {};
        const volume = volumes[action] !== undefined ? volumes[action] / 100 : 0.5;

        chrome.runtime.sendMessage({
            action: "playSoundOffscreen",
            sound: soundFile,
            volume: volume
        });
    });
}

async function initializeSoundPaths() {
    return new Promise((resolve) => {
        chrome.storage.local.get(["soundPaths"], (data) => {
            if (data.soundPaths) {
                currentSoundPaths = data.soundPaths;
            } else {
                const defaultSoundPaths = {
                    "tab_open": "sounds/minecraft_sounds/tab_open.mp3",
                    "tab_close": "sounds/minecraft_sounds/tab_close.mp3",
                    "tab_dragging": "sounds/minecraft_sounds/tab_dragging.mp3",
                    "tab_muted": "sounds/minecraft_sounds/tab_muted.mp3",
                    "tab_unmuted": "sounds/minecraft_sounds/tab_unmuted.mp3",
                    "download_start": "sounds/minecraft_sounds/download_start.mp3",
                    "download_complete": "sounds/minecraft_sounds/download_complete.mp3",
                    "bookmark_added": "sounds/minecraft_sounds/bookmark_added.mp3",
                    "error": "sounds/minecraft_sounds/error.mp3"
                };
                chrome.storage.local.set({ soundPaths: defaultSoundPaths }, () => {
                    currentSoundPaths = defaultSoundPaths;
                });
            }
            resolve();
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

async function setupExtension() {
    await initializeSoundPaths();
    injectContentScripts();
}

chrome.runtime.onInstalled.addListener(() => setupExtension());
chrome.runtime.onStartup.addListener(() => setupExtension());

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

    if (message.action === "themeChanged") {
        currentSoundPaths = message.soundPaths;
        
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    action: "themeChanged",
                    soundPaths: message.soundPaths
                }).catch(err => {
                    if (!err.message.includes("Receiving end does not exist")) {
                        console.warn("Could not send theme change to tab:", tab.id, err);
                    }
                });
            });
        });
    }
});

setupExtension();