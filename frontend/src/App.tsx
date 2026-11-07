import React, { useState, useEffect, useRef } from 'react';

interface SyncMessage {
  type: 'JOIN' | 'ROOM_INFO' | 'ACTION' | 'SYNC';
  roomId?: string;
  count?: number;
  action?: 'play' | 'pause' | 'seek';
  currentTime?: number;
}

export default function App() {
  const [roomId, setRoomId] = useState<string>('');
  const [joinedRoom, setJoinedRoom] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number>(0);
  const [status, setStatus] = useState<string>('Disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  // Replace with your deployed Firebase / WebSocket Server URL
  const WS_URL = 'ws://localhost:3001';

  useEffect(() => {
    // Listen for events sent from content script to popup
    const handleChromeMessage = (message: any) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && joinedRoom) {
        wsRef.current.send(
          JSON.stringify({
            type: 'ACTION',
            roomId: joinedRoom,
            action: message.action,
            currentTime: message.currentTime,
          })
        );
      }
    };

    chrome.runtime.onMessage.addListener(handleChromeMessage);
    return () => {
      chrome.runtime.onMessage.removeListener(handleChromeMessage);
    };
  }, [joinedRoom]);

  const connectWebSocket = (roomCode: string) => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('Connected');
      ws.send(JSON.stringify({ type: 'JOIN', roomId: roomCode }));
      setJoinedRoom(roomCode);
    };

    ws.onmessage = (event) => {
      try {
        const data: SyncMessage = JSON.parse(event.data);
        if (data.type === 'ROOM_INFO') {
          setUserCount(data.count || 1);
        } else if (data.type === 'ACTION') {
          // Send command down to Netflix content script
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'REMOTE_ACTION',
                action: data.action,
                currentTime: data.currentTime,
              });
            }
          });
        }
      } catch (e) {
        console.error('Error parsing WS message:', e);
      }
    };

    ws.onclose = () => {
      setStatus('Disconnected');
      setJoinedRoom(null);
      setUserCount(0);
    };
  };

  const handleCreateRoom = () => {
    const newRoomCode = `ROOM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    connectWebSocket(newRoomCode);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (roomId.trim()) {
      connectWebSocket(roomId.trim().toUpperCase());
    }
  };

  const handleLeaveRoom = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-700 pb-3">
        <h1 className="text-xl font-bold text-red-600 flex items-center gap-1">
          SyncFlix
        </h1>
        <span
          className={`px-2 py-0.5 text-xs rounded-full ${status === 'Connected' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
            }`}
        >
          {status}
        </span>
      </div>

      {!joinedRoom ? (
        <div className="flex flex-col gap-3">
          <button
            onClick={handleCreateRoom}
            className="w-full bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded font-medium transition cursor-pointer"
          >
            Create Private Room
          </button>

          <div className="relative flex items-center justify-center my-1">
            <span className="bg-slate-900 px-2 text-xs text-slate-500">OR</span>
            <div className="absolute inset-0 flex items-center -z-10">
              <div className="w-full border-t border-slate-800"></div>
            </div>
          </div>

          <form onSubmit={handleJoinRoom} className="flex gap-2">
            <input
              type="text"
              placeholder="ROOM-XXXXXX"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded text-sm font-medium transition cursor-pointer"
            >
              Join
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="bg-slate-800/60 p-3 rounded border border-slate-700/50 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400">Room Code</p>
              <p className="text-sm font-mono font-bold text-slate-100">{joinedRoom}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Active</p>
              <p className="text-sm font-bold text-emerald-400">{userCount} Online</p>
            </div>
          </div>

          <button
            onClick={handleLeaveRoom}
            className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded text-sm font-medium transition cursor-pointer"
          >
            Leave Room
          </button>
        </div>
      )}
    </div>
  );
}