let ws: WebSocket | null = null;
let currentRoom: string | null = null;
let userCount: number = 0;
let connectionStatus: 'Connected' | 'Disconnected' = 'Disconnected';

const WS_URL = 'wss://flynx-32or.onrender.com';

function connectWs(roomId: string) {
    if (ws) {
        ws.close();
        ws = null;
    }

    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            connectionStatus = 'Connected';
            currentRoom = roomId;
            ws?.send(JSON.stringify({ type: 'JOIN', roomId }));
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'ROOM_INFO') {
                    userCount = data.count || 1;
                } else if (data.type === 'ACTION') {
                    chrome.tabs.query({}, (tabs) => {
                        tabs.forEach((tab) => {
                            if (tab.url && tab.url.includes('/watch/') && tab.id) {
                                chrome.tabs.sendMessage(tab.id, {
                                    type: 'REMOTE_ACTION',
                                    action: data.action,
                                    currentTime: data.currentTime,
                                });
                            }
                        });
                    });
                } else if (data.type === 'NAVIGATE') {
                    chrome.tabs.query({}, (tabs) => {
                        tabs.forEach((tab) => {
                            if (tab.url && tab.url.includes('/watch/') && tab.id) {
                                chrome.tabs.sendMessage(tab.id, {
                                    type: 'NAVIGATE',
                                    url: data.url,
                                });
                            }
                        });
                    });
                }
            } catch (e) {
                console.error('Background WS parse error:', e);
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket connection error:', error);
            connectionStatus = 'Disconnected';
        };

        ws.onclose = () => {
            connectionStatus = 'Disconnected';
            currentRoom = null;
            userCount = 0;
            ws = null;
        };
    } catch (err) {
        console.error('Failed to initialize WebSocket:', err);
        connectionStatus = 'Disconnected';
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'JOIN_ROOM') {
        connectWs(message.roomId);
        sendResponse({ success: true });
    } else if (message.type === 'LEAVE_ROOM') {
        if (ws) ws.close();
        sendResponse({ success: true });
    } else if (message.type === 'GET_STATE') {
        sendResponse({
            joinedRoom: currentRoom,
            userCount,
            status: connectionStatus,
        });
    } else if (message.type === 'LOCAL_ACTION' && currentRoom && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
            JSON.stringify({
                type: 'ACTION',
                roomId: currentRoom,
                action: message.action,
                currentTime: message.currentTime,
            })
        );
    } else if (message.type === 'LOCAL_NAVIGATE' && currentRoom && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
            JSON.stringify({
                type: 'NAVIGATE',
                roomId: currentRoom,
                url: message.url,
            })
        );
    }
    return true;
});