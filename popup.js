document.addEventListener("DOMContentLoaded", function () {
    const expandToggle = document.querySelector(".expand-toggle");
    const moreActions = document.querySelector(".more-actions");
    const expandArrow = expandToggle.querySelector(".arrow");

    expandToggle.addEventListener("click", function () {
        moreActions.classList.toggle("open");
        if (moreActions.classList.contains("open")) {
            expandArrow.textContent = "▲ Show Less";
        } else {
            expandArrow.textContent = "▼ Show More";
        }
    });

    const keypressArrow = document.querySelector(".right-arrow[data-action='keypress']");
    const keypressSubcategories = document.querySelector(".keypress-subcategories");

    keypressArrow.addEventListener("click", function () {
        keypressSubcategories.classList.toggle("open");
        this.textContent = keypressSubcategories.classList.contains("open") ? "▼" : "▶";
    });

    document.querySelectorAll(".right-arrow").forEach(arrow => {
        arrow.addEventListener("click", function () {
            const action = this.getAttribute("data-action");
            const sliderContainer = document.getElementById(`slider-container-${action}`);

            if (!sliderContainer || action === "keypress") return;

            sliderContainer.classList.toggle("open");
            this.textContent = sliderContainer.classList.contains("open") ? "▼" : "▶";
        });
    });

    chrome.storage.local.get(["volumes"], (data) => {
        const volumes = data.volumes || {};

        document.querySelectorAll(".volume-slider input").forEach(slider => {
            const action = slider.closest(".volume-slider").getAttribute("data-action");
            slider.value = volumes[action] !== undefined ? volumes[action] : 50;
        });
    });

    document.querySelectorAll(".volume-slider input").forEach(slider => {
        slider.addEventListener("input", function () {
            const action = this.closest(".volume-slider").getAttribute("data-action");
            const volume = this.value;

            chrome.storage.local.get(["volumes"], (data) => {
                const volumes = data.volumes || {};
                volumes[action] = volume;

                chrome.storage.local.set({ volumes }, () => {
                    console.log(`🔊 Saved volume for ${action}: ${volume}`);

                    chrome.runtime.sendMessage({ action: "updateVolume", volumes });
                });
            });
        });
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "playSound") {
            let audio = new Audio(chrome.runtime.getURL(`sounds/${message.sound}.mp3`));
            audio.volume = 1.0;

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    document.addEventListener("click", () => audio.play(), { once: true });
                    document.addEventListener("keydown", () => audio.play(), { once: true });
                });
            }
        }
    });
});
