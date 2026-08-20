const linkUrl = 'https://raw.githubusercontent.com/shofiqul5/admission-class/main/video-link.txt';
        const titleUrl = 'https://raw.githubusercontent.com/shofiqul5/admission-class/main/video-titel.txt';
        const soundUrl = 'https://raw.githubusercontent.com/shofiqul5/admission-class/main/video-sound.txt';
        const thumbUrl = 'https://raw.githubusercontent.com/shofiqul5/admission-class/main/video-thumbnail.txt';

        const playerWrapper = document.getElementById('playerWrapper');
        const player = document.getElementById('mainPlayer');
        const audio = document.getElementById('mainAudio');
        const currentTitleEl = document.getElementById('currentTitle');
        const videoListEl = document.getElementById('videoList');
        const skipLeft = document.getElementById('skipLeft');
        const skipRight = document.getElementById('skipRight');
        const loadingOverlay = document.getElementById('loadingOverlay');

        let playlistData = [];
        let currentIndex = -1;
        let isSyncing = false;

        // Prevent standard keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'C')) || 
                (e.ctrlKey && (e.key === 'U' || e.key === 'S'))) {
                e.preventDefault();
            }
        });

        async function loadData() {
            try {
                const [linksRes, titlesRes, soundsRes, thumbsRes] = await Promise.all([
                    fetch(linkUrl),
                    fetch(titleUrl),
                    fetch(soundUrl).catch(() => null),
                    fetch(thumbUrl).catch(() => null)
                ]);

                const linksText = await linksRes.text();
                const titlesText = await titlesRes.text();
                const soundsText = soundsRes ? await soundsRes.text() : '';
                const thumbsText = thumbsRes ? await thumbsRes.text() : '';

                const links = linksText.split('\n').map(line => line.replace(/^[0-9\u0966-\u096F]+[:\s]*/, '').trim()).filter(Boolean);
                const titles = titlesText.split('\n').map(line => line.replace(/^[0-9\u0966-\u096F]+[:\s]*/, '').trim()).filter(Boolean);
                const sounds = soundsText.split('\n').map(line => line.replace(/^[0-9\u0966-\u096F]+[:\s]*/, '').trim()).filter(Boolean);
                const thumbs = thumbsText.split('\n').map(line => line.replace(/^[0-9\u0966-\u096F]+[:\s]*/, '').trim()).filter(Boolean);

                playlistData = links.map((link, index) => ({
                    link: link,
                    title: titles[index] || `Video ${index + 1}`,
                    sound: sounds[index] || null,
                    thumb: thumbs[index] || null
                }));

                if (playlistData.length > 0) {
                    renderPlaylist();
                } else {
                    videoListEl.innerHTML = '<p class="loading-text">No videos found.</p>';
                }
            } catch (error) {
                console.error("Error loading files:", error);
                videoListEl.innerHTML = '<p class="loading-text">Failed to load video list.</p>';
            }
        }

        function renderPlaylist() {
            videoListEl.innerHTML = '';
            playlistData.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = `video-item ${index === currentIndex ? 'active' : ''}`;
                
                // Render Thumbnail: Image if available, else auto-generated video frame
                let thumbContent = '';
                if (item.thumb) {
                    thumbContent = `<img src="${item.thumb}" alt="Thumbnail">`;
                } else {
                    thumbContent = `<video src="${item.link}#t=0.5" preload="metadata" muted></video>`;
                }

                div.innerHTML = `
                    <div class="thumbnail-box">
                        ${thumbContent}
                    </div>
                    <div class="video-info">
                        <span class="index">Video #${index + 1}</span>
                        <span class="title">${item.title}</span>
                    </div>
                `;

                div.onclick = () => playVideo(index);
                videoListEl.appendChild(div);
            });
        }

        function playVideo(index) {
            currentIndex = index;
            
            playerWrapper.style.display = 'block';
            currentTitleEl.style.display = 'block';

            player.src = playlistData[index].link;
            currentTitleEl.innerText = playlistData[index].title;

            if (playlistData[index].sound) {
                player.muted = true;
                audio.src = playlistData[index].sound;
                audio.load();
            } else {
                player.muted = false;
                audio.removeAttribute('src');
            }

            renderPlaylist();
            playerWrapper.scrollIntoView({ behavior: 'smooth' });

            player.play().catch(() => {});
        }

        /* --- Sync Logic --- */
        player.addEventListener('play', () => { 
            if (audio.src && audio.paused) audio.play().catch(() => {}); 
        });
        
        player.addEventListener('pause', () => { 
            if (audio.src && !audio.paused) audio.pause(); 
        });

        player.addEventListener('seeking', () => { 
            if (audio.src) audio.currentTime = player.currentTime; 
        });

        player.addEventListener('ratechange', () => { 
            if (audio.src) audio.playbackRate = player.playbackRate; 
        });

        player.addEventListener('timeupdate', () => {
            if (audio.src && !isSyncing) {
                const diff = Math.abs(player.currentTime - audio.currentTime);
                if (diff > 0.8) {
                    isSyncing = true;
                    audio.currentTime = player.currentTime;
                    setTimeout(() => { isSyncing = false; }, 300);
                }
            }
        });

        function showLoading(show) {
            loadingOverlay.style.opacity = show ? '1' : '0';
        }

        player.addEventListener('waiting', () => {
            showLoading(true);
            if (audio.src) audio.pause();
        });

        player.addEventListener('canplay', () => {
            showLoading(false);
        });

        if (audio) {
            audio.addEventListener('waiting', () => {
                showLoading(true);
                player.pause();
            });
            audio.addEventListener('canplay', () => {
                showLoading(false);
                if (!player.paused) audio.play().catch(() => {});
            });
        }

        player.addEventListener('ended', () => {
            if (currentIndex + 1 < playlistData.length) {
                playVideo(currentIndex + 1);
            }
        });

        // Double Click & Tap Controls
        let clickTimeout = null;

        player.addEventListener('click', (e) => {
            const rect = player.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const playerWidth = rect.width;

            if (clickTimeout) {
                clearTimeout(clickTimeout);
                clickTimeout = null;

                if (clickX < playerWidth / 2) {
                    player.currentTime = Math.max(0, player.currentTime - 10);
                    showNotice(skipLeft);
                } else {
                    player.currentTime = Math.min(player.duration, player.currentTime + 10);
                    showNotice(skipRight);
                }
                if (audio.src) audio.currentTime = player.currentTime;
            } else {
                clickTimeout = setTimeout(() => {
                    if (player.paused) {
                        player.play();
                    } else {
                        player.pause();
                    }
                    clickTimeout = null;
                }, 250);
            }
        });

        function showNotice(element) {
            element.style.opacity = '1';
            setTimeout(() => { element.style.opacity = '0'; }, 500);
        }

        loadData();