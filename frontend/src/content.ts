let isRemoteTrigger = false;

function getNetflixVideo(): HTMLVideoElement | null {
    return document.querySelector('video');
}

function attachMediaListeners(video: HTMLVideoElement) {
    const notifyPopup = (action: 'play' | 'pause' | 'seek') => {
        if (isRemoteTrigger) return;
        chrome.runtime.sendMessage({
            type: 'LOCAL_ACTION',
            action,
            currentTime: video.currentTime,
        });
    };

    video.addEventListener('play', () => notifyPopup('play'));
    video.addEventListener('pause', () => notifyPopup('pause'));
    video.addEventListener('seeking', () => notifyPopup('seek'));
}

// Observe DOM until Netflix player loads
const observer = new MutationObserver(() => {
    const video = getNetflixVideo();
    if (video) {
        observer.disconnect();
        attachMediaListeners(video);
    }
});

observer.observe(document.body, { childList: true, subtree: true });

// Receive synchronization commands from the Popup UI
chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'REMOTE_ACTION') return;

    const video = getNetflixVideo();
    if (!video) return;

    isRemoteTrigger = true;

    const DRIFT_THRESHOLD = 0.5; // Sync time if drift is > 0.5 sec
    if (Math.abs(video.currentTime - message.currentTime) > DRIFT_THRESHOLD) {
        video.currentTime = message.currentTime;
    }

    if (message.action === 'play' && video.paused) {
        video.play().catch(console.error);
    } else if (message.action === 'pause' && !video.paused) {
        video.pause();
    }

    setTimeout(() => {
        isRemoteTrigger = false;
    }, 300);
});