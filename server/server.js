
import { Server } from "socket.io";
import { createServer } from "http";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: "https://tic-tac-toe-multiplayer-9sb7968ir-pavans-projects-ccc36420.vercel.app/",
});

const allUsers = {}; // Track all users by socket ID
const allRooms = {}; // Track rooms with players

io.on("connection", (socket) => {
  allUsers[socket.id] = {
    socket: socket,
    online: true,
  };

  socket.on("request_to_play", (data) => {
    const currentUser = allUsers[socket.id];
    currentUser.playerName = data.playerName;

    let roomAssigned = false;

    // Look for a room with only one player
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

    // If no available room, create a new one
    if (!roomAssigned) {
      const newRoom = `room_${Object.keys(allRooms).length + 1}`;
      allRooms[newRoom] = [currentUser];
      currentUser.socket.join(newRoom);
      currentUser.socket.emit("OpponentNotFound");
    }
  });

  socket.on("disconnect", function () {
    const currentUser = allUsers[socket.id];
    currentUser.online = false;

    for (const room in allRooms) {
      const players = allRooms[room];
      const index = players.findIndex((player) => player.socket.id === socket.id);

      if (index !== -1) {
        const opponent = players.find((_, i) => i !== index);
        if (opponent) {
          opponent.socket.emit("opponentLeftMatch");
        }
        delete allRooms[room];
        break;
      }
    }
  });
});

function setupGameListeners(room, players) {
  const [player1, player2] = players;

  player1.socket.on("playerMoveFromClient", (data) => {
    io.to(room).emit("playerMoveFromServer", {
      ...data,
    });
  });

  player2.socket.on("playerMoveFromClient", (data) => {
    io.to(room).emit("playerMoveFromServer", {
      ...data,
    });
  });
}

httpServer.listen(3000);
