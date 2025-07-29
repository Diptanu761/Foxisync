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

    function fetchAndUpdateVolumes() {
        if (chrome.runtime?.id) {
            chrome.storage.local.get(["volumes"], (data) => {
                currentVolumes = data.volumes || {};
            });
        }
    }

    fetchAndUpdateVolumes();

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "volumeChanged") {
            currentVolumes[message.soundName] = message.volume;
            if (audio.src.includes(`sounds/${message.soundName}.mp3`)) {
                audio.volume = message.volume / 100;
            }
        }
        if (message.action === "downloadFailed") {
            playSound("error");
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

            audio.src = chrome.runtime.getURL(`sounds/${soundName}.mp3`);
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

    document.addEventListener("submit", () => {
        chrome.runtime.sendMessage({ action: "playSound", sound: "form_submit" })
    });

    document.addEventListener("click", () => playSound("click"));
    document.addEventListener("click", (event) => {
        const element = event.target;
        if (
            (element.tagName === "INPUT" && (element.type === "text" || element.type === "search")) ||
            element.tagName === "TEXTAREA" ||
            element.isContentEditable
        ) {
            playSound("search_focus");
        }
    });
    document.addEventListener("click", (event) => {
        if (event.target.tagName === "BUTTON" && event.target.disabled) {
            playSound("error");
        }
    });

    document.addEventListener("mouseover", (event) => {
        const element = event.target;

        if (
            element.tagName === "A" ||
            element.tagName === "BUTTON" ||
            (element.hasAttribute("role") && element.getAttribute("role") === "button") ||
            element.hasAttribute("data-clickable")
        ) {
            playSound("hover");
        }
    });
    document.addEventListener("contextmenu", (event) => {
    });

    document.addEventListener("keydown", (event) => {
        const blockedShortcuts = ["s", "u", "i", "j"];
        if (event.ctrlKey && blockedShortcuts.includes(event.key.toLowerCase())) {
            event.preventDefault();
            playSound("error");
        }
    });

    document.addEventListener("invalid", (event) => {
        playSound("error");
    }, true);
}

