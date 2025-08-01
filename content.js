if (!chrome.runtime?.id) {
    console.warn("Extension context invalidated. Content script won't run.");
} else {

    let audio = document.createElement("audio");
    audio.style.display = "none";

    const bd = document.body || document.documentElement;
    if (bd) {
        bd.appendChild(audio);
    } else {
        console.warn("Document body not found, audio element might not be appended.");
    }

    let scrollCooldown = false;
    let lastScrollTime = 0;
    const SCROLL_DELAY = 300;

    let currentVolumes = {};
    let currentSoundPaths = {};

    function fetchAndUpdateVolumes() {
        if (chrome.runtime?.id) {
            chrome.storage.local.get(["volumes"], (data) => {
                currentVolumes = data.volumes || {};
            });
        }
    }

    function fetchAndUpdateSoundPaths() {
        if (chrome.runtime?.id) {
            chrome.storage.local.get(["soundPaths"], (data) => {
                currentSoundPaths = data.soundPaths || {};
                console.log("Content script loaded with sound paths:", currentSoundPaths);
            });
        }
    }

    fetchAndUpdateVolumes();
    fetchAndUpdateSoundPaths();

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "volumeChanged") {
            currentVolumes[message.soundName] = message.volume;
            if (currentSoundPaths[message.soundName] && audio.src.includes(currentSoundPaths[message.soundName])) {
                audio.volume = message.volume / 100;
            }
        }
        if (message.action === "downloadFailed") {
        }
        if (message.action === "themeChanged") {
            currentSoundPaths = message.soundPaths;
            console.log("Content script updated with new sound paths:", currentSoundPaths);
        }
    });

    function playSound(soundName) {
        let now = Date.now();
        if (soundName === "scroll" && (scrollCooldown || now - lastScrollTime < SCROLL_DELAY)) {
            return;
        }

        lastScrollTime = now;

        if (chrome.runtime?.id) {
            const volume = currentVolumes[soundName] !== undefined ? currentVolumes[soundName] / 100 : 0.5;
            const soundPath = currentSoundPaths[soundName];

            if (!soundPath) {
                console.warn(`No sound path found for sound: ${soundName}`);
                return;
            }

            audio.src = chrome.runtime.getURL(soundPath);
            audio.volume = volume;

            audio.play().catch((e) => {
            });
        }

        if (soundName === "scroll") {
            scrollCooldown = true;
            setTimeout(() => (scrollCooldown = false), SCROLL_DELAY);
        }
    }

    window.addEventListener("wheel", () => playSound("scroll"), { passive: true });
    window.addEventListener("touchmove", () => playSound("scroll"), { passive: true });
    document.addEventListener("scroll", () => playSound("scroll"), { passive: true });
    window.addEventListener("keydown", (event) => {
        if (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(event.key)) {
            playSound("scroll");
        }
    });

    document.addEventListener("click", () => playSound("click"));
    document.addEventListener("contextmenu", (event) => {
    });
}