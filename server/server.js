import { Server } from "socket.io";
import { createServer } from "http";

const PORT = process.env.PORT || 3000;

// HTTP server for Render
const httpServer = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Tic Tac Toe Server Running");
});

const io = new Server(httpServer, {
  cors: {
    origin: [
      "*",
      
    ],
    methods: ["GET", "POST"],
  },
});

const allUsers = {};
const allRooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  allUsers[socket.id] = {
    socket,
    online: true,
  };

  socket.on("request_to_play", (data) => {
    const currentUser = allUsers[socket.id];
    currentUser.playerName = data.playerName;

    let roomAssigned = false;

    // Find a room with one player
    for (const room in allRooms) {
      const players = allRooms[room];

      if (players.length === 1) {
        players.push(currentUser);
        roomAssigned = true;

        const opponentPlayer = players[0];

        currentUser.socket.join(room);
        opponentPlayer.socket.join(room);

        currentUser.socket.emit("OpponentFound", {
          opponentName: opponentPlayer.playerName,
          playingAs: "cross",
        });

        opponentPlayer.socket.emit("OpponentFound", {
          opponentName: currentUser.playerName,
          playingAs: "circle",
        });

        setupGameListeners(room, players);
        break;
      }
    }

    // Create a room if none available
    if (!roomAssigned) {
      const roomName = `room_${Date.now()}`;

      allRooms[roomName] = [currentUser];

      currentUser.socket.join(roomName);

      currentUser.socket.emit("OpponentNotFound");
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    const currentUser = allUsers[socket.id];

    if (currentUser) {
      currentUser.online = false;
    }

    for (const room in allRooms) {
      const players = allRooms[room];

      const index = players.findIndex(
        (player) => player.socket.id === socket.id
      );

      if (index !== -1) {
        const opponent = players.find(
          (_, i) => i !== index
        );

        if (opponent) {
          opponent.socket.emit("opponentLeftMatch");
        }

        delete allRooms[room];
        break;
      }
    }

    delete allUsers[socket.id];
  });
});

function setupGameListeners(room, players) {
  const [player1, player2] = players;

  player1.socket.on("playerMoveFromClient", (data) => {
    io.to(room).emit("playerMoveFromServer", data);
  });

  player2.socket.on("playerMoveFromClient", (data) => {
    io.to(room).emit("playerMoveFromServer", data);
  });
}

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running and listening on port ${PORT}`);
});
