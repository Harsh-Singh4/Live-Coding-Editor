import { useState,useEffect,useRef } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import heroImg from './assets/hero.png'
import './App.css'
import Editor from "@monaco-editor/react";
import {io} from 'socket.io-client';

 const socket = io("http://localhost:3000");

function App() {

   const isRemote = useRef(false);
   const timeOut = useRef(null);

   let userName = localStorage.getItem("userName");

   if(!userName){
    userName=prompt("Enter Your Name");
    localStorage.setItem("userName",userName);
   }

   const userId =
  localStorage.getItem("userId") ||
  crypto.randomUUID();

localStorage.setItem("userId", userId);

console.log(`userID is ${userId}`);

    useEffect(() => {

  const handleCodeChange = (incomingCode) => {
    isRemote.current = true;
    
    setCode(incomingCode);

    localStorage.setItem("code",incomingCode);
  };

  socket.on("connect", () => {
    console.log("connected", socket.id);
     socket.emit("join-room",{
      userId,
      userName
     });
  });

  // 🔥 Receive initial code when joining
  socket.on("sync-code", (code) => {
    if (code) {
      isRemote.current = true;
      setCode(code);
      localStorage.setItem("code",code);
    }
  });

  // 🔥 Receive live updates
  socket.on("code-change", handleCodeChange);

  // 🔥 Ask server for latest code
 

  return () => {
    socket.off("code-change", handleCodeChange);
    socket.off("sync-code");
    socket.off("connect");
    socket.disconnect();
  };

}, []);
  
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


  const defaultLang = "cpp"
  const [code,setCode] = useState(()=>{
    return localStorage.getItem("code") || templates[defaultLang]});
  const [language,setLanguage] = useState(defaultLang);
  const [theme,setTheme] = useState("vs-dark");

const normalize = (str) => {
  return str.trim().replace(/\s+/g, " ");
};

const checkBoiler = (code) =>{
  for(let lang in templates){
    if(normalize(code) === normalize(templates[lang])){
      return true;
    }
  }
  return false;
}

const handleLanguageChange = (lang) =>{
  setLanguage(lang);
  if(!code || checkBoiler(code)){
    setCode(templates[lang]);
  }
}

  return (
    <>
         <div className="container">
          <div className="left">
           <select className="left-dropdown" value={language} onChange={(e)=>handleLanguageChange(e.target.value)}>
  <option value="javascript">JavaScript</option>
  <option value="cpp">C++</option>
  <option value="python">Python</option>
  <option value="java">Java</option>
</select>



<select className="right-dropdown"value={theme} onChange={(e)=>setTheme(e.target.value)}>
<option value="vs-dark">Dark</option>
<option value="light">Light</option>
</select>

          </div>
          <div className="right">
            
             <Editor
             
          height="100%"
          language={language}
         
          value ={code}
          onChange={(value)=>{
            
             if (!value) return;

            if(isRemote.current){
              isRemote.current=false;
              return;
            }
            setCode(value);
            localStorage.setItem("code",value);
             clearTimeout(timeOut.current);

timeOut.current = setTimeout(() => {
     
    socket.emit("code-change", value);
  }, 300);

           

          }}
          theme={theme}
        />

        
          </div>

           </div>

         </>
  )
}

export default App
