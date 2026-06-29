import { useState, useEffect, useRef } from 'react';
import { useParams } from "react-router-dom";
import { useNavigate } from "react-router-dom";

import '../App.css';
import Editor from "@monaco-editor/react";


import { socket } from "./socket";
function EditorPage() {

  const { roomId } = useParams();
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [cursorPositions, setCursorPositions] =
  useState({});
  const [output, setOutput] =
    useState("");
    const [loading, setLoading] =
useState(false);

const runCode = async () => {

    setLoading(true);
    setOutput("");

    try {

        const res = await fetch(
            "http://localhost:3000/run-code",
            {
                method: "POST",
                headers: {
                    "Content-Type":
                    "application/json"
                },
                body: JSON.stringify({
                    code,
                    language,
                    userId
                })
            }
        );


if (res.status === 429) {
    const data = await res.json();
    setOutput(data.output);
    return;
}


        const data =
        await res.json();

        console.log(data);


        setOutput(data.output);

    } catch(err){

        setOutput(
            "Execution failed"
        );

    } finally {

        setLoading(false);

    }
};
  const passcode =
  localStorage.getItem(`passcode-${roomId}`);

  const isRemote = useRef(false);
  const timeOut = useRef(null);

  let userName = localStorage.getItem("userName");

  if (!userName) {
    userName = prompt("Enter Your Name") || "Anonymous";
    localStorage.setItem("userName", userName);
  }

  const userId =
    localStorage.getItem("userId") ||
    crypto.randomUUID();

  localStorage.setItem("userId", userId);

  console.log(`userID is ${userId}`);

  const templates = {
    javascript: `// JavaScript
function main() {
  console.log("Hello World");
}
main();`,

    python: `# Python
def main():
    print("Hello World")

main()`,

    cpp: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello World";
    return 0;
}`,

    java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}`
  };

  const defaultLang = "cpp";

  const [code, setCode] = useState(() => {
    return (
      localStorage.getItem(`code-${roomId}`) ||
      templates[defaultLang]
    );
  });

  const [language, setLanguage] = useState(defaultLang);
  const [theme, setTheme] = useState("vs-dark");

 

  useEffect(() => {

    const handleCodeChange = (incomingCode) => {
      isRemote.current = true;

 

      setCode(incomingCode);

      localStorage.setItem(
        `code-${roomId}`,
        incomingCode
      );
    };

    const joinRoom = () => {
      console.log("Joining room:", roomId);

      socket.emit("join-room", {
        roomId,
        passcode,
        userId,
        userName
      });
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.once("connect", joinRoom);
    }

    // 🔥 Receive initial code when joining
    socket.on("sync-code", (code) => {

      isRemote.current = true;

      setCode(code ?? "");

      localStorage.setItem(
        `code-${roomId}`,
        code ?? ""
      );
    });

    // 🔥 Receive live updates
    socket.on("code-change", handleCodeChange);


    
socket.on("join-error", (msg) => {
   alert(msg);
  navigate("/");
});

socket.on("users-update", (userList) => {
  setUsers(userList);
});


socket.on("notification", (msg) => {

  setActivity(prev => [
    
    ...prev,
    msg
  ].slice(0, 20));

});

socket.on("cursor-change", (data) => {

  setCursorPositions(prev => ({
    ...prev,
    [data.userName]: {
      line: data.line,
      column: data.column
    }
  }));

});


   return () => {

      clearTimeout(timeOut.current);

      socket.off("code-change", handleCodeChange);
      socket.off("sync-code");
      socket.off("connect", joinRoom);
       socket.off("join-error");
       socket.off("users-update");
       socket.off("notification");
       socket.off("cursor-change");
        
      // socket.off("room-create-error");
      // socket.disconnect();
    };

    

  }, [roomId]);

  

  const normalize = (str) => {
    return str.trim().replace(/\s+/g, " ");
  };

  const checkBoiler = (code) => {
    for (let lang in templates) {
      if (normalize(code) === normalize(templates[lang])) {
        return true;
      }
    }
    return false;
  };

  const handleLanguageChange = (lang) => {
    setLanguage(lang);

    if (!code || checkBoiler(code)) {
      setCode(templates[lang]);
    }
  };

  return (
    <>
      <div className="container">
<div className="left">

  <div className="top-controls">

    <select
      value={language}
      onChange={(e) =>
        handleLanguageChange(e.target.value)
      }
    >
      <option value="javascript">JavaScript</option>
      <option value="cpp">C++</option>
      <option value="python">Python</option>
      <option value="java">Java</option>
    </select>

    <select
      value={theme}
      onChange={(e) =>
        setTheme(e.target.value)
      }
    >
      <option value="vs-dark">Dark</option>
      <option value="light">Light</option>
    </select>

  </div>

  <div className="users-section">

    <h3>Users</h3>

{users.map((user, index) => (
  <div key={index}>
    {user}
    {cursorPositions[user] && ` - L${cursorPositions[user].line}` }
  </div>
))}

<hr />

<h3>Activity</h3>

{activity.map((item, index) => (
  <div key={index}>
    {item}
  </div>
))}
  </div>

</div>  
    <div className="right1">

          <Editor
            height="100%"
            language={language}
            value={code}
              onMount={(editor) => {

    editor.onDidChangeCursorPosition((e) => {

      socket.emit("cursor-change", {
        roomId,
        userName,
        line: e.position.lineNumber,
        column: e.position.column
      });

    });

  }}

   
            onChange={(value) => {

              if (!value) return;
             

              if (isRemote.current) {
                isRemote.current = false;
                return;
              }

              setCode(value);

              localStorage.setItem(
                `code-${roomId}`,
                value
              );

              clearTimeout(timeOut.current);

              timeOut.current = setTimeout(() => {

                socket.emit("code-change", {
                  roomId,
                  code: value
                });

              }, 300);

            }}
            theme={theme}
          />

        </div>
        <div className="right2">
         <button
    onClick={runCode}
    disabled={loading}
>
    {loading ? "Running..." : "Run"}
</button>
<h3>Output</h3>

    <pre>
{
    loading
    ? "Running..."
    : output || "No Output"
}
</pre>
    </div>
      </div>
    </>
  );
}

export default EditorPage;