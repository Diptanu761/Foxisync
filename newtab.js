document.addEventListener("DOMContentLoaded", () => {
    let editingIndex = null;

    const shortcutsContainer = document.querySelector(".shortcuts");
    const shortcutModal = document.getElementById("shortcutModal");
    const nameInput = document.getElementById("shortcutName");
    const urlInput = document.getElementById("shortcutURL");
    const saveBtn = document.getElementById("saveBtn");
    const deleteBtn = document.getElementById("deleteBtn");
    const modalTitle = document.getElementById("modalTitle");
    const searchInput = document.getElementById("searchInput");
    const searchSuggestions = document.getElementById("searchSuggestions");
    const searchForm = document.querySelector(".search-container form");
    const MAX_RECENT_SEARCHES = 4;

    const settingsModal = document.getElementById("settingsModal");
    const settingsIcon = document.querySelector(".settings-icon");
    const closeSettingsModalBtn = document.getElementById("closeSettingsModalBtn");
    const closeShortcutModalBtn = document.getElementById("closeShortcutModalBtn");

    const soundActions = {
        "generalSound": { option: document.getElementById("generalSoundOption"), slider: document.getElementById("generalVolumeSlider"), soundName: "general" },
        "tab_open": { option: document.getElementById("tabOpenSoundOption"), arrow: document.getElementById("tabOpenSoundArrow"), slider: document.getElementById("tabOpenVolumeSlider"), soundName: "tab_open" },
        "tab_close": { option: document.getElementById("tabCloseSoundOption"), arrow: document.getElementById("tabCloseSoundArrow"), slider: document.getElementById("tabCloseVolumeSlider"), soundName: "tab_close" },
        "tab_dragging": { option: document.getElementById("tabDragSoundOption"), arrow: document.getElementById("tabDragSoundArrow"), slider: document.getElementById("tabDragVolumeSlider"), soundName: "tab_dragging" },
        "tab_muted": { option: document.getElementById("tabMuteSoundOption"), arrow: document.getElementById("tabMuteSoundArrow"), slider: document.getElementById("tabMuteVolumeSlider"), soundName: "tab_muted" },
        "tab_unmuted": { option: document.getElementById("tabUnmuteSoundOption"), arrow: document.getElementById("tabUnmuteSoundArrow"), slider: document.getElementById("tabUnmuteVolumeSlider"), soundName: "tab_unmuted" },
        "download_start": { option: document.getElementById("downloadStartSoundOption"), arrow: document.getElementById("downloadStartSoundArrow"), slider: document.getElementById("downloadStartVolumeSlider"), soundName: "download_start" },
        "download_complete": { option: document.getElementById("downloadCompleteSoundOption"), arrow: document.getElementById("downloadCompleteSoundArrow"), slider: document.getElementById("downloadCompleteVolumeSlider"), soundName: "download_complete" },
        "bookmark_added": { option: document.getElementById("bookmarkPageSoundOption"), arrow: document.getElementById("bookmarkPageSoundArrow"), slider: document.getElementById("bookmarkPageVolumeSlider"), soundName: "bookmark_added" },
        "error": { option: null, arrow: null, slider: null, soundName: "error" },
        "click": { option: document.getElementById("clickSoundOption"), arrow: document.getElementById("clickSoundArrow"), slider: document.getElementById("clickVolumeSlider"), soundName: "click" },
        "scroll": { option: document.getElementById("scrollSoundOption"), arrow: document.getElementById("scrollSoundArrow"), slider: document.getElementById("scrollVolumeSlider"), soundName: "scroll" }
    };

    function setupSoundOption(optionData) {
        const { option, arrow, slider, soundName } = optionData;

        if (!option || !slider) {
            return;
        }

        const toggleOption = () => {
            option.classList.toggle("expanded");
            if (arrow) {
                arrow.classList.toggle("rotated");
            }
        };

        option.addEventListener("click", toggleOption);

        slider.addEventListener("input", (e) => {
            const newVolume = parseInt(e.target.value, 10);
            updateVolumeInStorage(soundName, newVolume);
            if (soundName === "general") {
                backgroundMusic.volume = newVolume / 100;
            }
        });

        chrome.storage.local.get(["volumes"], (data) => {
            const volumes = data.volumes || {};
            const savedValue = volumes[soundName];
            if (savedValue !== undefined) {
                slider.value = savedValue;
                if (soundName === "general") {
                    backgroundMusic.volume = savedValue / 100;
                }
            } else {
                const defaultValue = 50;
                slider.value = defaultValue;
                updateVolumeInStorage(soundName, defaultValue);
                if (soundName === "general") {
                    backgroundMusic.volume = defaultValue / 100;
                }
            }
        });
    }

    function updateVolumeInStorage(soundName, volume) {
        chrome.storage.local.get(["volumes"], (data) => {
            const volumes = data.volumes || {};
            volumes[soundName] = volume;
            chrome.storage.local.set({ volumes: volumes }, () => {
                console.log(`🔊 Volume for ${soundName} set to: ${volume}`);
                chrome.runtime.sendMessage({
                    action: "updateVolume",
                    soundName: soundName,
                    volume: volume
                });

                chrome.tabs.query({}, function (tabs) {
                    tabs.forEach(function (tab) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: "volumeChanged",
                            soundName: soundName,
                            volume: volume
                        }).catch(e => {
                            if (!e.message.includes("Could not establish connection. Receiving end does not exist.")) {
                                console.error("Error sending message to tab:", e);
                            }
                        });
                    });
                });
            });
        });
    }

    for (const key in soundActions) {
        if (soundActions.hasOwnProperty(key)) {
            setupSoundOption(soundActions[key]);
        }
    }

    function getRecentSearches() {
        try {
            return JSON.parse(localStorage.getItem("recentSearches") || "[]");
        } catch (e) {
            console.error("Error parsing recent searches from localStorage:", e);
            return [];
        }
    }

    function saveRecentSearch(query) {
        if (!query || typeof query !== 'string' || query.trim() === '') return;

        let searches = getRecentSearches();
        searches = searches.filter(item => item.toLowerCase() !== query.toLowerCase());
        searches.unshift(query.trim());
        if (searches.length > MAX_RECENT_SEARCHES) {
            searches = searches.slice(0, MAX_RECENT_SEARCHES);
        }
        localStorage.setItem("recentSearches", JSON.stringify(searches));
        renderSearchSuggestions();
    }

    function removeRecentSearch(queryToRemove) {
        let searches = getRecentSearches();
        searches = searches.filter(item => item.toLowerCase() !== queryToRemove.toLowerCase());
        localStorage.setItem("recentSearches", JSON.stringify(searches));
        renderSearchSuggestions();
        if (searches.length === 0) {
            hideSearchSuggestions();
        }
    }

    function renderSearchSuggestions() {
        if (!searchSuggestions) {
            console.warn("searchSuggestions element not found. Cannot render suggestions.");
            return;
        }

        const searches = getRecentSearches();
        searchSuggestions.innerHTML = '';

        if (searches.length === 0) {
            hideSearchSuggestions();
            return;
        }

        searches.forEach(query => {
            const suggestionItem = document.createElement("div");
            suggestionItem.className = "suggestion-item";
            suggestionItem.innerHTML = `
                <i class='bx bx-history'></i>
                <span>${query}</span>
                <i class='bx bx-x' data-query="${query}"></i>
            `;
            searchSuggestions.appendChild(suggestionItem);

            const spanElement = suggestionItem.querySelector('span');
            const removeIcon = suggestionItem.querySelector('.bx-x');

            if (spanElement) {
                spanElement.addEventListener('click', () => {
                    if (searchInput && searchForm) {
                        searchInput.value = query;
                        searchForm.submit();
                        hideSearchSuggestions();
                    }
                });
            }

            if (removeIcon) {
                removeIcon.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeRecentSearch(e.target.dataset.query);
                });
            }
        });
        showSearchSuggestions();
    }

    function showSearchSuggestions() {
        if (searchSuggestions && searchForm) {
            if (getRecentSearches().length > 0) {
                searchSuggestions.classList.add('active');
                searchForm.classList.add('suggestions-active-form');
            }
        }
    }

    function hideSearchSuggestions() {
        if (searchSuggestions && searchForm) {
            searchSuggestions.classList.remove('active');
            searchForm.classList.remove('suggestions-active-form');
        }
    }

    if (searchInput) {
        searchInput.addEventListener('focus', () => {
            renderSearchSuggestions();
        });
    }

    if (searchForm) {
        searchForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                saveRecentSearch(query);
                window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            }
        });
    }

    function openShortcutModal(name = '', url = '', index = null) {
        editingIndex = index;
        if (nameInput) nameInput.value = name;
        if (urlInput) urlInput.value = url;
        if (modalTitle) modalTitle.textContent = index === null ? 'Add Shortcut' : 'Edit Shortcut';
        if (deleteBtn) deleteBtn.style.display = index === null ? 'none' : 'inline-block';
        if (shortcutModal) shortcutModal.style.display = 'flex';
    }

    function closeShortcutModal() {
        if (shortcutModal) shortcutModal.style.display = 'none';
        if (nameInput) nameInput.value = '';
        if (urlInput) urlInput.value = '';
        editingIndex = null;
    }

    function openSettingsModal() {
        if (settingsModal) settingsModal.style.display = 'flex';
    }

    function closeSettingsModal() {
        if (settingsModal) settingsModal.style.display = 'none';
    }

    document.addEventListener('mousedown', (e) => {
        if (searchInput && searchSuggestions && !searchInput.contains(e.target) && !searchSuggestions.contains(e.target)) {
            hideSearchSuggestions();
        }
        if (shortcutModal && shortcutModal.style.display === 'flex' && !shortcutModal.querySelector('.modal-box').contains(e.target)) {
            closeShortcutModal();
        }
        if (settingsModal && settingsModal.style.display === 'flex' && !settingsModal.querySelector('.modal-box').contains(e.target)) {
            closeSettingsModal();
        }
    });

    function saveShortcut() {
        let name = nameInput ? nameInput.value.trim() : '';
        let url = urlInput ? urlInput.value.trim() : '';

        if (!name || !url) {
            alert("Please fill in both fields.");
            return;
        }

        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        let shortcuts = JSON.parse(localStorage.getItem("shortcuts") || "[]");
        if (editingIndex !== null) {
            shortcuts[editingIndex] = { name, url };
        } else {
            shortcuts.push({ name, url });
        }

        localStorage.setItem("shortcuts", JSON.stringify(shortcuts));
        renderShortcuts();
        closeShortcutModal();
    }

    function deleteShortcut() {
        let shortcuts = JSON.parse(localStorage.getItem("shortcuts") || "[]");

        if (editingIndex !== null) {
            shortcuts.splice(editingIndex, 1);
            localStorage.setItem("shortcuts", JSON.stringify(shortcuts));
            renderShortcuts();
            closeShortcutModal();
        }
    }

    function renderShortcuts() {
        const customShortcuts = document.querySelectorAll(".shortcut-wrapper");
        customShortcuts.forEach(s => s.remove());

        const shortcuts = JSON.parse(localStorage.getItem("shortcuts") || "[]");

        if (!shortcutsContainer) {
            console.warn("shortcutsContainer element not found. Cannot render shortcuts.");
            return;
        }

        const addShortcutBtn = document.querySelector(".add-shortcut");
        const addShortcutRow = document.querySelector(".add-shortcut-row");

        if (addShortcutBtn && addShortcutBtn.parentElement) {
            addShortcutBtn.parentElement.removeChild(addShortcutBtn);
        }

        shortcuts.forEach((shortcut, index) => {
            const wrapper = document.createElement("div");
            wrapper.className = "shortcut-wrapper";

            wrapper.innerHTML = `
                <a href="${shortcut.url}" target="_blank">
                    <img src="https://www.google.com/s2/favicons?sz=64&domain_url=${shortcut.url}" alt="${shortcut.name}">
                    <span>${shortcut.name}</span>
                </a>
                <i class='bx bx-dots-vertical-rounded menu-dots' data-index="${index}"></i>
            `;

            shortcutsContainer.appendChild(wrapper);
        });

        if (addShortcutBtn && addShortcutRow) {
            if (shortcuts.length < 8) {
                addShortcutRow.style.display = 'none';
                shortcutsContainer.appendChild(addShortcutBtn);
            } else {
                addShortcutRow.style.display = 'flex';
                addShortcutRow.appendChild(addShortcutBtn);
            }
        }
    }

    const addShortcutElement = document.querySelector(".add-shortcut");
    if (addShortcutElement) {
        addShortcutElement.addEventListener("click", (e) => {
            e.preventDefault();

            const shortcuts = JSON.parse(localStorage.getItem("shortcuts") || "[]");

            if (shortcuts.length >= 8) {
                showLimitNotification();
            } else {
                openShortcutModal();
            }
        });
    }

    function showLimitNotification() {
        const note = document.getElementById("limitNotification");
        if (note) {
            note.style.display = "block";
            setTimeout(() => {
                note.style.display = "none";
            }, 3000);
        }
    }

    if (shortcutsContainer) {
        shortcutsContainer.addEventListener("click", function (e) {
            let targetElement = e.target;
            if (!targetElement.classList.contains("menu-dots")) {
                targetElement = e.target.closest(".menu-dots");
            }

            if (targetElement && targetElement.classList.contains("menu-dots")) {
                e.preventDefault();
                e.stopPropagation();

                const index = parseInt(targetElement.getAttribute("data-index"));
                const shortcuts = JSON.parse(localStorage.getItem("shortcuts") || "[]");
                const shortcut = shortcuts[index];

                if (shortcut) {
                    openShortcutModal(shortcut.name, shortcut.url, index);
                }
            }
        });
    }

    const sidePanel = document.getElementById("sidePanel");
    const cornerIcon = document.getElementById("corner-button");

    const panelWidth = 350;

    if (cornerIcon && sidePanel) {
        cornerIcon.addEventListener("click", () => {
            sidePanel.classList.toggle("active");
            const iconElement = cornerIcon.querySelector('i');
            if (sidePanel.classList.contains("active")) {
                cornerIcon.style.right = `${panelWidth + -1}px`;
                if (iconElement) iconElement.className = 'bx bx-arrow-to-right';
            } else {
                cornerIcon.style.right = '0px';
                if (iconElement) iconElement.className = 'bx bx-arrow-to-left';
            }
        });

        document.addEventListener("click", (e) => {
            if (
                sidePanel.classList.contains("active") &&
                !sidePanel.contains(e.target) &&
                !cornerIcon.contains(e.target) &&
                !shortcutModal.contains(e.target) &&
                !settingsModal.contains(e.target)
            ) {
                sidePanel.classList.remove("active");
                cornerIcon.style.right = '0px';
                const iconElement = cornerIcon.querySelector('i');
                if (iconElement) iconElement.className = 'bx bx-arrow-to-left';
            }
        });
    }

    const musicToggle = document.getElementById('musicToggle');
    const backgroundMusic = document.getElementById('backgroundMusic');
    const musicIcon = musicToggle.querySelector('i');

    let isMusicPlaying = localStorage.getItem('isMusicPlaying') === 'true';

    function playInitialMusic() {
        if (isMusicPlaying && backgroundMusic) {
            backgroundMusic.play().catch(e => {
                console.warn("Music autoplay blocked or failed:", e);
            });
            musicIcon.classList.remove('bx-music-alt');
            musicIcon.classList.add('bx-music-alt', 'bx-spin');
        } else if (backgroundMusic) {
            backgroundMusic.pause();
            musicIcon.classList.remove('bx-music-alt', 'bx-spin');
            musicIcon.classList.add('bx-music-alt');
        }
    }


    musicToggle.addEventListener('click', () => {
        if (backgroundMusic) {
            if (isMusicPlaying) {
                backgroundMusic.pause();
                musicIcon.classList.remove('bx-music', 'bx-spin');
                musicIcon.classList.add('bx-music');
                isMusicPlaying = false;
            } else {
                backgroundMusic.play().catch(e => console.error("Music playback failed:", e));
                musicIcon.classList.remove('bx-music');
                musicIcon.classList.add('bx-music', 'bx-spin');
                isMusicPlaying = true;
            }
            localStorage.setItem('isMusicPlaying', isMusicPlaying);
        }
    });

    if (settingsIcon) {
        settingsIcon.addEventListener('click', openSettingsModal);
    }

    if (saveBtn) saveBtn.addEventListener("click", saveShortcut);
    if (deleteBtn) deleteBtn.addEventListener("click", deleteShortcut);
    if (closeShortcutModalBtn) closeShortcutModalBtn.addEventListener("click", closeShortcutModal);
    if (closeSettingsModalBtn) closeSettingsModalBtn.addEventListener("click", closeSettingsModal);

    renderShortcuts();

    const selectedThemeNameElement = document.getElementById("selectedThemeName");
    const selectedThemePreviewItem = document.getElementById("selectedThemePreview");
    const selectedThemePreviewImage = selectedThemePreviewItem ? selectedThemePreviewItem.querySelector("img") : null;
    const selectedThemeOverlay = selectedThemePreviewItem ? selectedThemePreviewItem.querySelector(".wallpaper-overlay") : null;
    const themesSlotsContainer = document.querySelector(".themes-slots");
    const backgroundVideo = document.getElementById("background-video");

    let currentSelectedTheme = {
        name: "Minecraft Theme",
        preview: "preview/default_image.png",
        video: "wallpapers/default_background.mp4",
        music: "sounds/default_music1.mp3"
    };

    const allThemes = [
        { name: "Minecraft Theme", preview: "preview/default_image.png", video: "wallpapers/default_background.mp4", music: "sounds/default_music1.mp3" },
        { name: "Eren Yeager", preview: "preview/eren_aot.png", video: "wallpapers/eren_aot_bg.mp4", music: "sounds/eren_aot_music.mp3" },
        { name: "Levi Ackerman", preview: "preview/levi_aot.png", video: "wallpapers/levi_aot_bg.mp4", music: "sounds/levi_aot_music.mp3" },
        { name: "Mikasa Ackerman", preview: "preview/mikasa_aot.png", video: "wallpapers/mikasa_aot_bg.mp4", music: "sounds/mikasa_aot_music.mp3" },
        { name: "Tsunade Senju", preview: "preview/tsunade.png", video: "wallpapers/tsunade.mp4", music: "sounds/tsunade_music.mp3" },
        { name: "Uzumaki Naruto", preview: "preview/naruto.png", video: "wallpapers/naruto.mp4", music: "sounds/naruto_music.mp3" },
        { name: "Sasuke Uchiha", preview: "preview/sasuke.png", video: "wallpapers/sasuke.mp4", music: "sounds/sasuke_music.mp3" },
        { name: "Naruto & His Friends", preview: "preview/narandfriend.png", video: "wallpapers/narandfriend.mp4", music: "sounds/narandfriend_music.mp3" },
        { name: "Kakashi Hatake", preview: "preview/kakashi.png", video: "wallpapers/kakashi.mp4", music: "sounds/kakashi_music.mp3" },
        { name: "Itachi & Kisame", preview: "preview/itachi_kisame.png", video: "wallpapers/itachi_kisame.mp4", music: "sounds/itachi_kisamemusic.mp3" },
        { name: "Valley Of The End", preview: "preview/valley.png", video: "wallpapers/valley.mp4", music: "sounds/valley_music.mp3" },
        { name: "Obito Uchiha", preview: "preview/obito.png", video: "wallpapers/obito.mp4", music: "sounds/obito_music.mp3" },
        { name: "Itachi Uchiha", preview: "preview/itachi.png", video: "wallpapers/itachi.mp4", music: "sounds/itachi_music.mp3" },
        { name: "Madara Uchiha", preview: "preview/madara.png", video: "wallpapers/madara.mp4", music: "sounds/madara_music.mp3" },
    ];

    const themeSoundPaths = {
        "Minecraft Theme": "sounds/minecraft_sounds/",
        "Eren Yeager": "sounds/aot_sounds/",
        "Levi Ackerman": "sounds/aot_sounds/",
        "Mikasa Ackerman": "sounds/aot_sounds/",
        "Tsunade Senju": "sounds/naruto_sounds/",
        "Uzumaki Naruto": "sounds/naruto_sounds/",
        "Sasuke Uchiha": "sounds/naruto_sounds/",
        "Naruto & His Friends": "sounds/naruto_sounds/",
        "Kakashi Hatake": "sounds/naruto_sounds/",
        "Itachi & Kisame": "sounds/naruto_sounds/",
        "Valley Of The End": "sounds/naruto_sounds/",
        "Obito Uchiha": "sounds/naruto_sounds/",
        "Itachi & Kisame": "sounds/naruto_sounds/",
        "Itachi Uchiha": "sounds/naruto_sounds/",
        "Madara Uchiha": "sounds/naruto_sounds/"
    };

    function updateSelectedThemeDisplay(themeName, previewSrc, videoSrc, musicSrc) {
        if (selectedThemeNameElement) {
            selectedThemeNameElement.textContent = themeName;
        }
        if (selectedThemePreviewImage) {
            selectedThemePreviewImage.src = previewSrc;
            selectedThemePreviewImage.alt = `${themeName} Preview`;
        }
        if (backgroundVideo && videoSrc) {
            backgroundVideo.src = videoSrc;
            backgroundVideo.load();
            backgroundVideo.play();
        }
        if (backgroundMusic && musicSrc) {
            if (isMusicPlaying || backgroundMusic.src !== new URL(musicSrc, window.location.href).href) {
                backgroundMusic.src = musicSrc;
                backgroundMusic.load();
                if (isMusicPlaying) {
                    backgroundMusic.play().catch(e => console.error("Music playback failed on theme change:", e));
                }
            }
        }
    }

    function updateSoundTheme(themeName) {
        const soundFolder = themeSoundPaths[themeName];
        if (!soundFolder) {
            console.error(`No sound folder found for theme: ${themeName}`);
            return;
        }

        const newSoundPaths = {
            "tab_open": soundFolder + "tab_open.mp3",
            "tab_close": soundFolder + "tab_close.mp3",
            "tab_dragging": soundFolder + "tab_dragging.mp3",
            "tab_muted": soundFolder + "tab_muted.mp3",
            "tab_unmuted": soundFolder + "tab_unmuted.mp3",
            "download_start": soundFolder + "download_start.mp3",
            "download_complete": soundFolder + "download_complete.mp3",
            "bookmark_added": soundFolder + "bookmark_added.mp3",
            "click": soundFolder + "click.mp3",
            "scroll": soundFolder + "scroll.mp3",
            "silent": soundFolder + "silent.mp3"
        };

        chrome.storage.local.set({ soundPaths: newSoundPaths }, () => {
            console.log("Updated sound paths in storage:", newSoundPaths);
            
            chrome.runtime.sendMessage({
                action: "themeChanged",
                soundPaths: newSoundPaths
            });
            
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, {
                        action: "themeChanged",
                        soundPaths: newSoundPaths
                    }).catch(err => {
                        if (!err.message.includes("Receiving end does not exist")) {
                            console.error("Error sending message to tab:", err);
                        }
                    });
                });
            });
        });
    }

    function renderMoreThemes(otherThemesData) {
        if (!themesSlotsContainer) return;

        themesSlotsContainer.innerHTML = '';

        otherThemesData.forEach(theme => {
            if (theme.name === currentSelectedTheme.name && theme.preview === currentSelectedTheme.preview) {
                return;
            }

            const themeItem = document.createElement("div");
            themeItem.className = "wallpaper-item";
            themeItem.setAttribute("data-theme-name", theme.name);
            themeItem.setAttribute("data-preview-src", theme.preview);
            themeItem.setAttribute("data-video-src", theme.video);
            themeItem.setAttribute("data-music-src", theme.music);
            themeItem.innerHTML = `
                <img src="${theme.preview}" alt="${theme.name} Theme">
                <h3 class="wallpaper-text">${theme.name}</h3>
            `;
            themesSlotsContainer.appendChild(themeItem);
        });
    }

    function initializeThemes() {
        chrome.storage.local.get(['selectedTheme'], (data) => {
            if (data.selectedTheme) {
                currentSelectedTheme = data.selectedTheme;
            } else {
                const defaultTheme = allThemes.find(theme => theme.name === "Minecraft Theme");
                if (defaultTheme) {
                    currentSelectedTheme = defaultTheme;
                }
                chrome.storage.local.set({ selectedTheme: currentSelectedTheme });
            }

            updateSelectedThemeDisplay(currentSelectedTheme.name, currentSelectedTheme.preview, currentSelectedTheme.video, currentSelectedTheme.music);

            if (!data.soundPaths) {
                updateSoundTheme(currentSelectedTheme.name);
            }

            const otherThemesForDisplay = allThemes.filter(theme =>
                theme.name !== currentSelectedTheme.name || theme.preview !== currentSelectedTheme.preview
            );
            renderMoreThemes(otherThemesForDisplay);

            playInitialMusic();
        });
    }

    if (themesSlotsContainer) {
        themesSlotsContainer.addEventListener("click", (event) => {
            const clickedThemeItem = event.target.closest(".wallpaper-item");

            if (clickedThemeItem &&
                clickedThemeItem.parentElement === themesSlotsContainer &&
                (clickedThemeItem.getAttribute("data-theme-name") !== currentSelectedTheme.name ||
                 clickedThemeItem.getAttribute("data-preview-src") !== currentSelectedTheme.preview)) {

                const newThemeName = clickedThemeItem.getAttribute("data-theme-name");
                const newThemePreviewSrc = clickedThemeItem.getAttribute("data-preview-src");
                const newThemeVideoSrc = clickedThemeItem.getAttribute("data-video-src");
                const newThemeMusicSrc = clickedThemeItem.getAttribute("data-music-src");

                currentSelectedTheme = {
                    name: newThemeName,
                    preview: newThemePreviewSrc,
                    video: newThemeVideoSrc,
                    music: newThemeMusicSrc
                };

                updateSelectedThemeDisplay(currentSelectedTheme.name, currentSelectedTheme.preview, currentSelectedTheme.video, currentSelectedTheme.music);

                let updatedOtherThemes = allThemes.filter(theme =>
                    (theme.name !== currentSelectedTheme.name || theme.preview !== currentSelectedTheme.preview)
                );

                chrome.storage.local.set({
                    selectedTheme: currentSelectedTheme,
                    otherThemes: updatedOtherThemes
                }, () => {
                    renderMoreThemes(updatedOtherThemes);
                });

                updateSoundTheme(newThemeName);
            }
        });
    }

    initializeThemes();
});