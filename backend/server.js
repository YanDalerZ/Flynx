const { WebSocketServer, WebSocket } = require('ws');

const PORT = process.env.PORT || 3001;
const wss = new WebSocketServer({ port: PORT });

// Track rooms: Room Code => Set of WebSocket Clients
const rooms = new Map();

function broadcastToRoom(roomId, message, senderWs = null) {
  const clients = rooms.get(roomId);
  if (!clients) return;

  const payload = JSON.stringify(message);
  for (const client of clients) {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function sendRoomInfo(roomId) {
  const clients = rooms.get(roomId);
  if (!clients) return;

  const count = clients.size;
  const payload = JSON.stringify({ type: 'ROOM_INFO', count });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'JOIN') {
        const { roomId } = data;
        currentRoom = roomId;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Set());
        }

        rooms.get(roomId).add(ws);
        sendRoomInfo(roomId);
      } else if (data.type === 'ACTION' && currentRoom) {
        broadcastToRoom(currentRoom, data, ws);
      }
    } catch (err) {
      console.error('Failed to parse WS message:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const roomClients = rooms.get(currentRoom);
      roomClients.delete(ws);

      if (roomClients.size === 0) {
        rooms.delete(currentRoom);
      } else {
        sendRoomInfo(currentRoom);
      }
    }
  });
});

console.log(`SyncFlix WebSocket signaling backend running on port ${PORT}`);