import { useState, useEffect } from 'react';

export default function App() {
  const [roomInput, setRoomInput] = useState<string>('');
  const [joinedRoom, setJoinedRoom] = useState<string | null>(null);
  const [userCount, setUserCount] = useState<number>(0);
  const [status, setStatus] = useState<string>('Disconnected');

  useEffect(() => {
    const fetchState = () => {
      chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
        if (response) {
          setJoinedRoom(response.joinedRoom);
          setUserCount(response.userCount);
          setStatus(response.status);
        }
      });
    };

    fetchState();
    const interval = setInterval(fetchState, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRoomAction = () => {
    // Use custom input if provided, otherwise generate a random room code
    const code = roomInput.trim()
      ? roomInput.trim()
      : `ROOM-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    chrome.runtime.sendMessage({ type: 'JOIN_ROOM', roomId: code });
  };

  const handleLeaveRoom = () => {
    chrome.runtime.sendMessage({ type: 'LEAVE_ROOM' });
  };

  return (
    <div className="p-4 flex flex-col gap-4 w-72 bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between border-b border-slate-700 pb-3">
        <h1 className="text-xl font-bold text-red-600 flex items-center gap-1">
          Flynx
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
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-slate-400 font-medium">Room Name or Code</label>
            <input
              type="text"
              placeholder="e.g. movietime"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-red-500 text-slate-100"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleRoomAction}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-3 rounded text-sm font-medium transition cursor-pointer"
            >
              Create Room
            </button>
            <button
              onClick={handleRoomAction}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 py-2 px-3 rounded text-sm font-medium transition cursor-pointer"
            >
              Join Room
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="bg-slate-800/60 p-3 rounded border border-slate-700/50 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400">Room Name</p>
              <p className="text-sm font-mono font-bold text-slate-100 truncate max-w-[140px]">{joinedRoom}</p>
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