let isRemoteTrigger = false;
let unlockTimer: number | undefined;
let lastAttachedVideo: HTMLVideoElement | null = null;
let lastSentVideoId = '';

function getVideoId(url: string): string | null {
    const m = url.match(/\/watch\/(\d+)/);
    return m ? m[1] : null;
}

function getNetflixVideo(): HTMLVideoElement | null {
    const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
    if (videos.length === 0) return null;
    return videos.find(v => v.duration > 0 && !isNaN(v.duration)) || videos[0];
}

// Talk to the main-world bridge (Netflix player API)
function bridge(cmd: 'seek' | 'play' | 'pause', time?: number) {
    window.postMessage({ source: 'FLYNX_CONTENT', cmd, time }, '*');
}

// Echo guard: ignore events we caused ourselves
function lockRemote(timeoutMs = 4000) {
    isRemoteTrigger = true;
    clearTimeout(unlockTimer);
    unlockTimer = window.setTimeout(() => (isRemoteTrigger = false), timeoutMs);
}
function unlockSoon(delayMs = 600) {
    clearTimeout(unlockTimer);
    unlockTimer = window.setTimeout(() => (isRemoteTrigger = false), delayMs);
}

function attachMediaListeners() {
    const video = getNetflixVideo();
    if (!video || video === lastAttachedVideo) return;
    lastAttachedVideo = video;

    const notify = (action: 'play' | 'pause' | 'seek_sync') => {
        chrome.runtime.sendMessage({
            type: 'LOCAL_ACTION',
            action,
            currentTime: video.currentTime,
        });
    };

    video.addEventListener('play', () => { if (!isRemoteTrigger) notify('play'); });
    video.addEventListener('pause', () => { if (!isRemoteTrigger) notify('pause'); });

    video.addEventListener('seeked', () => {
        if (isRemoteTrigger) {
            // This seek was caused by a remote command; release the lock shortly after
            unlockSoon();
            return;
        }
        // Local user skipped: tell the other side, and pause ourselves too
        // so both can press play once everyone is at the same spot.
        notify('seek_sync');
        lockRemote();
        bridge('pause');
        unlockSoon();
    });
}

setInterval(() => {
    attachMediaListeners();

    const id = getVideoId(window.location.href);
    if (id && id !== lastSentVideoId) {
        lastSentVideoId = id;
        chrome.runtime.sendMessage({
            type: 'LOCAL_NAVIGATE',
            url: `https://www.netflix.com/watch/${id}`,
        });
    }
}, 1000);

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'NAVIGATE') {
        const target = getVideoId(message.url);
        if (target && target !== getVideoId(window.location.href)) {
            window.location.href = message.url;
        }
        return;
    }

    if (message.type !== 'REMOTE_ACTION') return;
    if (!getNetflixVideo()) return;

    if (message.action === 'seek_sync') {
        lockRemote(); // released when 'seeked' fires (or after 4s fallback)
        bridge('seek', message.currentTime);
        bridge('pause');
    } else if (message.action === 'play') {
        lockRemote();
        bridge('play');
        unlockSoon();
    } else if (message.action === 'pause') {
        lockRemote();
        bridge('pause');
        unlockSoon();
    }
});