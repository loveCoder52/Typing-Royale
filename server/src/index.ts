import express from "express";
import { createServer } from "node:http";
import { randomBytes, randomInt } from "node:crypto";
import { Server } from "socket.io";

type Player = {
  id: string;
  name: string;
  progress: number;
  correctCharacters: number;
  wpm: number;
  accuracy: number;

  // Internal tracking: these fields are not sent to clients.
  previousInput: string;
  totalAttempts: number;
  correctAttempts: number;
};

type Room = {
  code: string;
  players: Player[];
  status: "waiting" | "racing" | "finished";
  wordCount: number;
  text: string;
  startsAt: number;
  winnerId: string | null;
  winnerName: string | null;
};

const app = express();
const httpServer = createServer(app);

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const rooms = new Map<string, Room>();
const ALLOWED_WORD_COUNTS = [10, 25, 50, 100];

const WORD_BANK = `
  the be of and a to in he have it
  that for they with as not on she at by
  this we you do but from or which one would
  all will there say who make when can more if
  no man out other so what time up go about
  than into could state only new year some take come
  these know see use get like then first any work
  now may such give over think most even find day
  also after way many must look before great back through
  long where much should well people down own just because
  good each those feel seem how high too place little
  world very still hand old life tell write become here
  show house both between need mean call develop under last
  right move thing general school never same another begin while
  number part turn real leave might want point form off
  child small since against ask late home interest large person
  end open public follow during present without again hold around
  possible head consider word program problem however lead system set
  order eye plan run keep face fact group play stand
  increase early course change help line city put close case
  force meet once water upon war build hear light together
  learn book friend start story night young different next every
  read walk idea name simple clear fast slow happy morning
`.trim().split(/\s+/);

function generateRaceText(wordCount: number, previousText = ""): string {
  if (!ALLOWED_WORD_COUNTS.includes(wordCount)) {
    throw new Error("Unsupported word count.");
  }

  const words: string[] = [];

  for (let index = 0; index < wordCount; index++) {
    const previousWord = words[words.length - 1];
    const candidates = WORD_BANK.filter((word) => word !== previousWord);

    words.push(candidates[randomInt(candidates.length)]!);
  }

  if (words.join(" ") === previousText) {
    const alternatives = WORD_BANK.filter(
      (word) => word !== words[0] && word !== words[1],
    );

    words[0] = alternatives[randomInt(alternatives.length)]!;
  }

  return words.join(" ");
}

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "Typing Royale server is running!",
  });
});

function broadcastRoom(room: Room) {
  io.to(room.code).emit("room:updated", {
    code: room.code,
    status: room.status,
    wordCount: room.wordCount,
    text: room.text,
    startsAt: room.startsAt,
    winnerId: room.winnerId,
    winnerName: room.winnerName,

    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      progress: player.progress,
      correctCharacters: player.correctCharacters,
      wpm: player.wpm,
      accuracy: player.accuracy,
    })),
  });
}

function validateName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const name = value.trim();

  return name.length >= 2 && name.length <= 20 ? name : null;
}

function createPlayer(id: string, name: string): Player {
  return {
    id,
    name,
    progress: 0,
    correctCharacters: 0,
    wpm: 0,
    accuracy: 100,
    previousInput: "",
    totalAttempts: 0,
    correctAttempts: 0,
  };
}

function updateWpm(room: Room, timestamp: number) {
  const elapsedMinutes = Math.max(timestamp - room.startsAt, 1) / 60_000;

  for (const player of room.players) {
    player.wpm = Math.round(
      player.correctCharacters / 5 / elapsedMinutes,
    );
  }
}

// Compare the previous and current input to identify inserted/replaced text.
// Deleting characters does not remove earlier attempts.
function trackAccuracy(player: Player, nextInput: string, target: string) {
  const previousInput = player.previousInput;

  // Identical input must not create extra attempts.
  if (previousInput === nextInput) return;

  let changeStart = 0;

  // Find the unchanged prefix.
  while (
    changeStart < previousInput.length &&
    changeStart < nextInput.length &&
    previousInput[changeStart] === nextInput[changeStart]
  ) {
    changeStart++;
  }

  let previousEnd = previousInput.length;
  let nextEnd = nextInput.length;

  // Find the unchanged suffix without overlapping the prefix.
  while (
    previousEnd > changeStart &&
    nextEnd > changeStart &&
    previousInput[previousEnd - 1] === nextInput[nextEnd - 1]
  ) {
    previousEnd--;
    nextEnd--;
  }

  // Count only characters introduced by this edit.
  // For a pure deletion, this loop runs zero times.
  for (let index = changeStart; index < nextEnd; index++) {
    player.totalAttempts++;

    if (nextInput[index] === target[index]) {
      player.correctAttempts++;
    }
  }

  player.previousInput = nextInput;

  player.accuracy =
    player.totalAttempts === 0
      ? 100
      : Math.round(
          (player.correctAttempts / player.totalAttempts) * 1000,
        ) / 10;
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  let currentRoomCode: string | null = null;

  function getCurrentRoom() {
    return currentRoomCode ? rooms.get(currentRoomCode) : undefined;
  }

  function sendError(message: string) {
    socket.emit("room:error", message);
  }

  socket.on("room:create", (rawName: unknown) => {
    if (currentRoomCode) {
      sendError("You are already in a room.");
      return;
    }

    const name = validateName(rawName);

    if (!name) {
      sendError("Name must be 2–20 characters.");
      return;
    }

    let code: string;

    do {
      code = randomBytes(3).toString("hex").toUpperCase();
    } while (rooms.has(code));

    const room: Room = {
      code,
      players: [createPlayer(socket.id, name)],
      status: "waiting",
      wordCount: 25,
      text: "",
      startsAt: 0,
      winnerId: null,
      winnerName: null,
    };

    rooms.set(code, room);
    currentRoomCode = code;

    socket.join(code);
    broadcastRoom(room);
  });

  socket.on("room:join", (rawName: unknown, rawCode: unknown) => {
    if (currentRoomCode) {
      sendError("You are already in a room.");
      return;
    }

    const name = validateName(rawName);
    const code =
      typeof rawCode === "string" ? rawCode.trim().toUpperCase() : "";

    if (!name) {
      sendError("Name must be 2–20 characters.");
      return;
    }

    const room = rooms.get(code);

    if (!room) {
      sendError("Room not found. Check the code.");
      return;
    }

    if (room.status !== "waiting") {
      sendError("This race has already started. Try again after a rematch.");
      return;
    }

    if (room.players.length >= 6) {
      sendError("Room is full. Maximum 6 players.");
      return;
    }

    room.players.push(createPlayer(socket.id, name));
    currentRoomCode = code;

    socket.join(code);
    broadcastRoom(room);
  });

  socket.on("room:set-word-count", (value: unknown) => {
    const room = getCurrentRoom();

    if (!room) return;

    if (room.players[0]?.id !== socket.id) {
      sendError("Only the host can change the word count.");
      return;
    }

    if (room.status !== "waiting") {
      sendError("Word count can only be changed in the lobby.");
      return;
    }

    if (
      typeof value !== "number" ||
      !ALLOWED_WORD_COUNTS.includes(value)
    ) {
      sendError("Choose 10, 25, 50 or 100 words.");
      return;
    }

    room.wordCount = value;
    broadcastRoom(room);
  });

  socket.on("race:start", () => {
    const room = getCurrentRoom();

    if (!room) return;

    if (room.players[0]?.id !== socket.id) {
      sendError("Only the host can start the race.");
      return;
    }

    if (room.status !== "waiting") return;

    if (room.players.length < 2) {
      sendError("At least 2 players are needed.");
      return;
    }

    room.text = generateRaceText(room.wordCount, room.text);

    // Reset progress and accuracy history for this race.
    room.players = room.players.map((player) =>
      createPlayer(player.id, player.name),
    );

    room.winnerId = null;
    room.winnerName = null;
    room.status = "racing";
    room.startsAt = Date.now() + 3000;

    broadcastRoom(room);
  });

  socket.on("race:type", (value: unknown) => {
    const room = getCurrentRoom();

    if (!room || room.status !== "racing") return;

    const now = Date.now();

    if (now < room.startsAt) return;

    if (typeof value !== "string" || value.length > room.text.length) {
      return;
    }

    const player = room.players.find((item) => item.id === socket.id);

    if (!player) return;

    trackAccuracy(player, value, room.text);

    let correctPrefix = 0;

    while (
      correctPrefix < value.length &&
      value[correctPrefix] === room.text[correctPrefix]
    ) {
      correctPrefix++;
    }

    player.correctCharacters = correctPrefix;
    player.progress = Math.floor(
      (correctPrefix / room.text.length) * 100,
    );

    updateWpm(room, now);

    if (value === room.text) {
      room.status = "finished";
      room.winnerId = socket.id;
      room.winnerName = player.name;
    }

    broadcastRoom(room);
  });

  socket.on("race:rematch", () => {
    const room = getCurrentRoom();

    if (!room) return;

    if (room.players[0]?.id !== socket.id) {
      sendError("Only the host can prepare a rematch.");
      return;
    }

    if (room.status !== "finished") {
      sendError("Finish the current race first.");
      return;
    }

    room.status = "waiting";
    room.startsAt = 0;
    room.winnerId = null;
    room.winnerName = null;

    room.players = room.players.map((player) =>
      createPlayer(player.id, player.name),
    );

    broadcastRoom(room);
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);

    const room = getCurrentRoom();

    if (!room) return;

    room.players = room.players.filter(
      (player) => player.id !== socket.id,
    );

    if (room.players.length === 0) {
      rooms.delete(room.code);
    } else {
      broadcastRoom(room);
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});