import { useState,useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

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
    <div className="home-page">

  <div className="background-blur blur1"></div>
  <div className="background-blur blur2"></div>

  <div className="home-card">

      <h1 className="title">Collaborative Coding Editor</h1>

      <input
           className="input-field"
        type="password"
        placeholder="Create Room Passcode"
        value={createPasscode}
        onChange={(e) =>
          setCreatePasscode(e.target.value)
        }
      />

      <button   className="primary-btn" onClick={createRoom}>
        Create New Room
      </button>

       <div className="divider"></div>

      <input
        className="input-field"
        type="text"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) =>
          setRoomId(e.target.value)
        }
      />

      <input
        className="input-field"
        type="password"
        placeholder="Enter Passcode"
        value={joinPasscode}
        onChange={(e) =>
          setJoinPasscode(e.target.value)
        }
      />

      <button 
        className="primary-btn"
        onClick={joinRoom}>
        Join Room
      </button>

    </div>
    </div>
  );
}

export default Home;