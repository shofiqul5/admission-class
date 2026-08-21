const linkUrl = 'https://raw.githubusercontent.com/shofiqul5/admission-class/main/video-link.txt';
        const titleUrl = 'https://raw.githubusercontent.com/shofiqul5/admission-class/main/video-titel.txt';
        const thumbUrl = 'https://raw.githubusercontent.com/shofiqul5/admission-class/main/video-thumbnail.txt';

        const playerWrapper = document.getElementById('playerWrapper');
        const playerContent = document.getElementById('playerContent');
        const shieldOverlay = document.getElementById('shieldOverlay');
        const playBtn = document.getElementById('playBtn');
        const progressBar = document.getElementById('progressBar');
        const progressContainer = document.getElementById('progressContainer');
        const timeDisplay = document.getElementById('timeDisplay');
        const qualitySelect = document.getElementById('qualitySelect');
        const fullScreenBtn = document.getElementById('fullScreenBtn');
        const currentTitleEl = document.getElementById('currentTitle');
        const videoListEl = document.getElementById('videoList');
        const searchInput = document.getElementById('searchInput');
        const customControls = document.querySelector('.custom-controls');

        let playlistData = [];
        let currentIndex = -1;
        let ytPlayer = null;
        let html5Player = null;
        let isYT = false;
        let updateTimer = null;
        let isPlayerPlaying = false;
        let hideControlsTimer = null;
        const HIDE_DELAY = 2500; // ms of inactivity before controls fade out

        // ---- Auto-hide controls ----
        function showControls() {
            customControls.classList.remove('controls-hidden');
            scheduleHideControls();
        }

        function hideControlsNow() {
            customControls.classList.add('controls-hidden');
        }

        function scheduleHideControls() {
            clearTimeout(hideControlsTimer);
            // Only auto-hide while the video is actually playing.
            if (isPlayerPlaying) {
                hideControlsTimer = setTimeout(hideControlsNow, HIDE_DELAY);
            }
        }

        // Block DevTools
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || (e.ctrlKey && (e.key === 'U' || e.key === 'S'))) {
                e.preventDefault();
            }
        });

        function getYouTubeId(url) {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        }

        // Strips a leading numbering prefix like "1.", "1:", "1)" or Bengali
        // digits from a line — used for links, titles AND thumbnails so all
        // three lists stay aligned and thumbnail URLs are recognized correctly.
        function stripNumbering(line) {
            return line.replace(/^[0-9\u0966-\u096F]+[:.\)\s]*/, '').trim();
        }

        async function loadData() {
            try {
                const cacheBuster = `?t=${new Date().getTime()}`;
                const [linksRes, titlesRes, thumbsRes] = await Promise.all([
                    fetch(linkUrl + cacheBuster),
                    fetch(titleUrl + cacheBuster),
                    fetch(thumbUrl + cacheBuster).catch(() => null)
                ]);

                const linksText = await linksRes.text();
                const titlesText = await titlesRes.text();
                const thumbsText = thumbsRes ? await thumbsRes.text() : '';

                const links = linksText.split('\n').map(stripNumbering).filter(Boolean);
                const titles = titlesText.split('\n').map(stripNumbering).filter(Boolean);

                // FIX: previously thumbnail lines were only trimmed, never
                // stripped of their numbering prefix, so a line like
                // "1. https://..." failed the startsWith('http') check below
                // and silently fell back to the default YouTube thumbnail.
                // We keep blank lines here (no filter) so indexes stay
                // aligned with the links/titles arrays.
                const thumbs = thumbsText.split('\n').map(t => stripNumbering(t));

                playlistData = links.map((link, index) => {
                    const ytId = getYouTubeId(link);
                    let defaultThumb = ytId 
                        ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` 
                        : 'https://via.placeholder.com/120x68?text=No+Thumb';

                    let customThumb = thumbs[index];
                    let finalThumb = (customThumb && customThumb.startsWith('http')) 
                        ? customThumb 
                        : defaultThumb;

                    return {
                        id: index,
                        link: link,
                        ytId: ytId,
                        title: titles[index] || `Video ${index + 1}`,
                        thumb: finalThumb,
                        fallbackThumb: defaultThumb
                    };
                });

                if (playlistData.length > 0) renderPlaylist(playlistData);
                else videoListEl.innerHTML = '<p class="loading-text">No videos found.</p>';
            } catch (error) {
                videoListEl.innerHTML = '<p class="loading-text">Error loading videos.</p>';
            }
        }

        function renderPlaylist(items) {
            videoListEl.innerHTML = '';
            if (items.length === 0) {
                videoListEl.innerHTML = '<p class="loading-text">No matching videos.</p>';
                return;
            }

            items.forEach((item) => {
                const div = document.createElement('div');
                div.className = `video-item ${item.id === currentIndex ? 'active' : ''}`;
                div.innerHTML = `
                    <div class="thumbnail-box">
                        <img src="${item.thumb}" onerror="this.onerror=null; this.src='${item.fallbackThumb}';">
                    </div>
                    <div class="video-info">
                        <span class="title">${item.title}</span>
                    </div>
                `;
                div.onclick = () => playVideo(item.id);
                videoListEl.appendChild(div);
            });
        }

        // Search Filter
        // FIX: this logic itself was fine, but the input never accepted focus
        ///typing reliably because of the global `user-select: none` rule —
        // fixed above in CSS. Also trim the query and guard against
        // playlistData not being loaded yet.
        searchInput.oninput = (e) => {
            const query = e.target.value.toLowerCase().trim();
            if (!playlistData.length) return;
            const filtered = query
                ? playlistData.filter(item => item.title.toLowerCase().includes(query))
                : playlistData;
            renderPlaylist(filtered);
        };

        function playVideo(index) {
            currentIndex = index;
            const item = playlistData[index];
            playerWrapper.style.display = 'block';
            currentTitleEl.style.display = 'block';
            currentTitleEl.innerText = item.title;

            clearInterval(updateTimer);
            clearTimeout(hideControlsTimer);
            customControls.classList.remove('controls-hidden');
            isPlayerPlaying = false;

            if (item.ytId) {
                isYT = true;
                qualitySelect.style.display = 'block';
                setupYouTubePlayer(item.ytId);
            } else {
                isYT = false;
                qualitySelect.style.display = 'none';
                setupHTML5Player(item);
            }
            renderPlaylist(playlistData);
        }

        function setupYouTubePlayer(ytId) {
            playerContent.innerHTML = `<div class="yt-frame-container"><div id="ytContainer"></div></div>`;
            
            ytPlayer = new YT.Player('ytContainer', {
                videoId: ytId,
                playerVars: {
                    'autoplay': 1,
                    'controls': 0,
                    'modestbranding': 1,
                    'rel': 0,
                    'disablekb': 1,
                    'fs': 0
                },
                events: {
                    'onReady': (e) => {
                        e.target.playVideo();
                    },
                    'onStateChange': (e) => {
                        if (e.data === YT.PlayerState.PLAYING) {
                            playBtn.innerText = '⏸';
                            isPlayerPlaying = true;
                            startProgressLoop();
                            showControls();
                        } else if (e.data === YT.PlayerState.PAUSED) {
                            playBtn.innerText = '▶';
                            isPlayerPlaying = false;
                            clearTimeout(hideControlsTimer);
                            customControls.classList.remove('controls-hidden');
                        } else if (e.data === YT.PlayerState.ENDED) {
                            isPlayerPlaying = false;
                            clearTimeout(hideControlsTimer);
                            customControls.classList.remove('controls-hidden');
                            if (currentIndex + 1 < playlistData.length) playVideo(currentIndex + 1);
                        }
                    }
                }
            });
        }

        function setupHTML5Player(item) {
            playerContent.innerHTML = `<video id="mainPlayer" style="object-fit:contain;"></video>`;
            html5Player = document.getElementById('mainPlayer');
            html5Player.src = item.link;

            html5Player.play();
            playBtn.innerText = '⏸';
            isPlayerPlaying = true;

            html5Player.addEventListener('play', () => {
                playBtn.innerText = '⏸';
                isPlayerPlaying = true;
                showControls();
            });
            html5Player.addEventListener('pause', () => {
                playBtn.innerText = '▶';
                isPlayerPlaying = false;
                clearTimeout(hideControlsTimer);
                customControls.classList.remove('controls-hidden');
            });
            html5Player.addEventListener('ended', () => {
                isPlayerPlaying = false;
                clearTimeout(hideControlsTimer);
                customControls.classList.remove('controls-hidden');
                if (currentIndex + 1 < playlistData.length) playVideo(currentIndex + 1);
            });

            startProgressLoop();
            showControls();
        }

        function togglePlay() {
            if (isYT && ytPlayer) {
                if (ytPlayer.getPlayerState() === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
                else ytPlayer.playVideo();
            } else if (html5Player) {
                if (html5Player.paused) html5Player.play();
                else html5Player.pause();
            }
        }

        playBtn.onclick = () => {
            togglePlay();
            showControls();
        };

        shieldOverlay.onclick = () => {
            if (customControls.classList.contains('controls-hidden')) {
                // First tap on a hidden-controls video just reveals them.
                showControls();
            } else {
                togglePlay();
                showControls();
            }
        };

        // Any interaction with the player area keeps controls visible a bit longer.
        playerWrapper.addEventListener('mousemove', showControls);
        playerWrapper.addEventListener('touchstart', showControls, { passive: true });
        progressContainer.addEventListener('mousedown', showControls);
        progressContainer.addEventListener('touchstart', showControls, { passive: true });

        /* Quality Switcher Engine */
        qualitySelect.onchange = (e) => {
            const selectedQuality = e.target.value;
            if (isYT && ytPlayer && ytPlayer.setPlaybackQuality) {
                ytPlayer.setPlaybackQuality(selectedQuality);
            }
        };

        function startProgressLoop() {
            clearInterval(updateTimer);
            updateTimer = setInterval(() => {
                let curr = 0, dur = 0;
                if (isYT && ytPlayer && ytPlayer.getCurrentTime) {
                    curr = ytPlayer.getCurrentTime();
                    dur = ytPlayer.getDuration();
                } else if (html5Player) {
                    curr = html5Player.currentTime;
                    dur = html5Player.duration;
                }

                if (dur > 0) {
                    progressBar.style.width = (curr / dur) * 100 + '%';
                    timeDisplay.innerText = `${formatTime(curr)} / ${formatTime(dur)}`;
                }
            }, 500);
        }

        function formatTime(sec) {
            let m = Math.floor(sec / 60);
            let s = Math.floor(sec % 60);
            return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
        }

        progressContainer.onclick = (e) => {
            const rect = progressContainer.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;

            if (isYT && ytPlayer && ytPlayer.getDuration) {
                const targetTime = pos * ytPlayer.getDuration();
                ytPlayer.seekTo(targetTime, true);
            } else if (html5Player) {
                const targetTime = pos * html5Player.duration;
                html5Player.currentTime = targetTime;
            }
        };

        async function toggleFullScreen() {
            try {
                if (!document.fullscreenElement) {
                    if (playerWrapper.requestFullscreen) {
                        await playerWrapper.requestFullscreen();
                    } else if (playerWrapper.webkitRequestFullscreen) {
                        await playerWrapper.webkitRequestFullscreen();
                    }

                    if (screen.orientation && screen.orientation.lock) {
                        await screen.orientation.lock('landscape').catch(() => {});
                    }
                } else {
                    if (document.exitFullscreen) {
                        await document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        await document.webkitExitFullscreen();
                    }

                    if (screen.orientation && screen.orientation.unlock) {
                        screen.orientation.unlock();
                    }
                }
            } catch (err) {
                console.log("Fullscreen Error:", err);
            }
        }

        fullScreenBtn.onclick = toggleFullScreen;

        loadData();