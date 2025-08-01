let activeAudio = {};

chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "playSoundOffscreen") {
        const soundPath = message.sound;
        
        const audio = new Audio(chrome.runtime.getURL(soundPath));
        audio.volume = message.volume !== undefined ? message.volume : 0.5;

        if (activeAudio[soundPath]) {
            activeAudio[soundPath].pause();
            activeAudio[soundPath].currentTime = 0;
        }
        activeAudio[soundPath] = audio;

        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {})
                .catch(err => {
                    if (err.name !== 'AbortError') {
                        console.error("Error playing sound:", err);
                    }
                });
        }
    }
});

const keepAliveAudio = new Audio(chrome.runtime.getURL('sounds/minecraft_sounds/silent.mp3'));
keepAliveAudio.loop = true;
keepAliveAudio.volume = 0;

keepAliveAudio.play().catch(err => console.error('Keep-alive audio playback failed:', err));