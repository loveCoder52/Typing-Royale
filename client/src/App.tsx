import { useEffect, useRef, useState } from "react";
import { socket } from "./socket";
import "./index.css";

type Player = {
  id: string;
  name: string;
  progress: number;
  correctCharacters: number;
  wpm: number;
  accuracy: number;
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

const WORD_COUNTS = [10, 25, 50, 100];

export default function App() {
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");
  const [typedText, setTypedText] = useState("");
  const [now, setNow] = useState(Date.now());

  const typingRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    function onConnect() {
      setConnected(true);
      setError("");
    }

    function onDisconnect() {
      setConnected(false);
      setRoom(null);
      setTypedText("");
      setError("Disconnected. Rejoin a waiting room after reconnecting.");
    }

    function onConnectError() {
      setConnected(false);
      setError("Cannot connect. Check that your backend is running.");
    }

    function onRoomUpdated(updatedRoom: Room) {
      setRoom(updatedRoom);
      setNow(Date.now());
      setError("");

      if (updatedRoom.status === "waiting") {
        setTypedText("");
      }
    }

    function onRoomError(message: string) {
      setError(message);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("room:updated", onRoomUpdated);
    socket.on("room:error", onRoomError);
    socket.connect();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("room:updated", onRoomUpdated);
      socket.off("room:error", onRoomError);
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (room?.status !== "racing") return;

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 100);

    return () => window.clearInterval(timer);
  }, [room?.status]);

  const countdown = room
    ? Math.max(0, Math.ceil((room.startsAt - now) / 1000))
    : 0;

  const canType =
    connected && room?.status === "racing" && countdown === 0;

  useEffect(() => {
    if (canType) typingRef.current?.focus();
  }, [canType]);

  const me = room?.players.find((player) => player.id === socket.id);
  const isHost = Boolean(room && room.players[0]?.id === socket.id);
  const hasMistake = room ? !room.text.startsWith(typedText) : false;
  const finished = room?.status === "finished";

  const displayedPlayers = room
    ? finished
      ? [...room.players].sort((a, b) => {
          if (a.id === room.winnerId) return -1;
          if (b.id === room.winnerId) return 1;
          return b.progress - a.progress || b.wpm - a.wpm;
        })
      : room.players
    : [];

  function createRoom() {
    if (!socket.connected) return;
    setTypedText("");
    setError("");
    socket.emit("room:create", name);
  }

  function joinRoom() {
    if (!socket.connected) return;
    setTypedText("");
    setError("");
    socket.emit("room:join", name, code);
  }

  function setWordCount(count: number) {
    if (!socket.connected || !isHost || room?.status !== "waiting") {
      return;
    }

    setError("");
    socket.emit("room:set-word-count", count);
  }

  function startRace() {
    if (!socket.connected || !isHost) return;
    setError("");
    socket.emit("race:start");
  }

  function prepareRematch() {
    if (!socket.connected || !isHost) return;
    setError("");
    socket.emit("race:rematch");
  }

  function handleTyping(value: string) {
    if (!canType) return;
    setTypedText(value);
    socket.emit("race:type", value);
  }

  return (
    <main className="card">
      <header>
        <p className="eyebrow">THE GROUP CHAT HAS COMPETITION</p>
        <h1>🏁 Typing Royale</h1>

        <p className="connection" role="status">
          <span className={`status-dot ${connected ? "online" : ""}`} />
          {connected ? "Connected to server" : "Connecting…"}
        </p>
      </header>

      {!room ? (
        <section>
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            placeholder="Love"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={20}
          />

          <button
            onClick={createRoom}
            disabled={!connected || name.trim().length < 2}
          >
            Create Room
          </button>

          <p className="divider">OR JOIN YOUR FRIENDS</p>

          <label htmlFor="code">Room code</label>
          <input
            id="code"
            placeholder="Example: A3F921"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
            spellCheck={false}
          />

          <button
            className="secondary"
            onClick={joinRoom}
            disabled={
              !connected ||
              name.trim().length < 2 ||
              code.trim().length !== 6
            }
          >
            Join Room
          </button>
        </section>
      ) : (
        <section>
          <div className="room-header">
            <div>
              <p className="muted">Room code</p>
              <h2 className="room-code">{room.code}</h2>
            </div>

            <span className="badge">
              {room.wordCount} words ·{" "}
              {finished
                ? "Complete"
                : room.status === "racing"
                  ? countdown > 0
                    ? "Get ready"
                    : "Live"
                  : "Lobby"}
            </span>
          </div>

          {room.status === "waiting" && (
            <div className="lobby">
              <h2>Ready to race?</h2>
              <p className="muted">
                Share your code. At least 2 players are needed.
              </p>

              <p id="word-count-label" className="section-label">
                WORDS PER RACE
              </p>

              {isHost ? (
                <div
                  role="group"
                  aria-labelledby="word-count-label"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    gap: "8px",
                  }}
                >
                  {WORD_COUNTS.map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={room.wordCount === count ? "" : "secondary"}
                      aria-pressed={room.wordCount === count}
                      onClick={() => setWordCount(count)}
                      disabled={!connected}
                      style={{ marginTop: 0, padding: "12px 4px" }}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="badge">
                  {room.wordCount} words · Selected by the host
                </p>
              )}

              <p className="muted">
                Every player gets the same random words.
              </p>

              {isHost ? (
                <button
                  onClick={startRace}
                  disabled={!connected || room.players.length < 2}
                >
                  Start {room.wordCount}-word Race 🏁
                </button>
              ) : (
                <p className="waiting-message">
                  Waiting for the host to start…
                </p>
              )}
            </div>
          )}

          {finished && (
            <div className="result" role="status">
              <p className="eyebrow">RACE COMPLETE</p>
              <h2>🏆 {room.winnerName ?? "Player"} wins!</h2>
              <p>
                {room.winnerId === socket.id
                  ? "Keyboard warrior mil gaya! 😎"
                  : "Agli race teri hogi! 💪"}
              </p>
            </div>
          )}

          {room.status !== "waiting" && me && (
            <section aria-label="Your typing statistics">
              <p className="section-label">
                {finished ? "YOUR FINAL STATS" : "YOUR LIVE STATS"}
              </p>

              <div className="stats-grid">
                <div className="stat">
                  <strong>{me.wpm}</strong>
                  <span>WPM</span>
                </div>
                <div className="stat">
                  <strong>{me.accuracy}%</strong>
                  <span>Accuracy</span>
                </div>
                <div className="stat">
                  <strong>{me.progress}%</strong>
                  <span>Progress</span>
                </div>
              </div>
            </section>
          )}

          {room.status === "racing" && (
            <>
              <h2 className="countdown" role="status">
                {countdown > 0 ? `Starting in ${countdown}…` : "GO! 🔥"}
              </h2>

              <p className="race-text">
                {room.text.split("").map((character, index) => {
                  const className =
                    index >= typedText.length
                      ? index === typedText.length
                        ? "current-character"
                        : ""
                      : typedText[index] === character
                        ? "correct"
                        : "incorrect";

                  return (
                    <span key={index} className={className}>
                      {character}
                    </span>
                  );
                })}
              </p>

              <label htmlFor="typing">
                Type all {room.wordCount} words exactly
              </label>
              <textarea
                ref={typingRef}
                id="typing"
                value={typedText}
                onChange={(event) => handleTyping(event.target.value)}
                disabled={!canType}
                maxLength={room.text.length}
                onPaste={(event) => event.preventDefault()}
                onDrop={(event) => event.preventDefault()}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                placeholder="Countdown ke baad type karna…"
                aria-invalid={hasMistake}
              />

              <p className={hasMistake ? "error" : "muted"}>
                {hasMistake
                  ? "Typo! Backspace karke correct karo."
                  : "Use one space between words. No space after the last word."}
              </p>
            </>
          )}

          <h3>
            {finished ? "Results · ordered by progress" : "Players"}
            {" · "}
            {room.players.length}/6
          </h3>

          <ul className="players">
            {displayedPlayers.map((player) => (
              <li
                key={player.id}
                className={
                  player.id === room.winnerId ? "player winner" : "player"
                }
              >
                <div className="player-row">
                  <span className="player-name">
                    {player.id === room.winnerId && "🏆 "}
                    {player.name}
                    {player.id === socket.id && " (You)"}
                    {player.id === room.players[0]?.id && (
                      <small className="host-label">Host</small>
                    )}
                  </span>
                  <strong>{player.progress}%</strong>
                </div>

                <progress
                  value={player.progress}
                  max={100}
                  aria-label={`${player.name}'s progress`}
                />

                {room.status !== "waiting" && (
                  <div className="player-stats">
                    <span>{player.wpm} WPM</span>
                    <span>{player.accuracy}% accuracy</span>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {finished && (
            <div className="rematch-panel">
              {isHost ? (
                <>
                  <button onClick={prepareRematch} disabled={!connected}>
                    Rematch 🔁
                  </button>
                  <p className="muted">
                    Return to the lobby to keep or change the word count.
                  </p>
                </>
              ) : (
                <p className="waiting-message">
                  Waiting for the host to prepare a rematch…
                </p>
              )}
            </div>
          )}

          {room.status !== "waiting" && (
            <p className="metric-note">
              Accuracy measures your current text, including corrections.
              WPM updates when a player types. Stats freeze when the race ends.
            </p>
          )}
        </section>
      )}

      {error && (
        <p className="error error-banner" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}