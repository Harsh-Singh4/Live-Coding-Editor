import { useState,useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { socket } from "./socket";
function Home() {

  const [roomId, setRoomId] = useState("");
  const [createPasscode, setCreatePasscode] = useState("");
  const [joinPasscode, setJoinPasscode] = useState("");

  const navigate = useNavigate();

  const createRoom = () => {

    if (!createPasscode.trim()) {
      alert("Enter a passcode");
      return;
    }

    const userId =
  localStorage.getItem("userId") ||
  crypto.randomUUID();

localStorage.setItem("userId", userId);

    const newRoomId =
      crypto.randomUUID().slice(0, 8);

    localStorage.setItem(
      `passcode-${newRoomId}`,
      createPasscode
    );

socket.emit("create-room", {
  roomId: newRoomId,
  passcode: createPasscode,
  userId
});
    socket.once("room-created", (roomId) => {
      navigate(`/room/${roomId}`);
    });

    socket.once("create-error", (msg) => {
      alert(msg);
    });
  };
 useEffect(() => {

    socket.on(
        "room-create-error",
        (msg) => {
            alert(msg);
        }
    );

    return () => {
        socket.off(
            "room-create-error"
        );
    };

}, []);

  const joinRoom = () => {

    if (!roomId.trim()) return;

    localStorage.setItem(
      `passcode-${roomId.trim()}`,
      joinPasscode
    );

    navigate(`/room/${roomId.trim()}`);
  };

  return (
    <div>

      <h1>Collaborative Coding Editor</h1>

      <input
        type="password"
        placeholder="Create Room Passcode"
        value={createPasscode}
        onChange={(e) =>
          setCreatePasscode(e.target.value)
        }
      />

      <button onClick={createRoom}>
        Create New Room
      </button>

      <hr />

      <input
        type="text"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) =>
          setRoomId(e.target.value)
        }
      />

      <input
        type="password"
        placeholder="Enter Passcode"
        value={joinPasscode}
        onChange={(e) =>
          setJoinPasscode(e.target.value)
        }
      />

      <button onClick={joinRoom}>
        Join Room
      </button>

    </div>
  );
}

export default Home;