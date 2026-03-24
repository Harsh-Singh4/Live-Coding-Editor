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

      useEffect(() => {

  const handleCodeUpdate = (incomingCode) => {
    isRemote.current = true;
    setCode(incomingCode);
  };

  socket.on("connect", () => {
    console.log("connected", socket.id);
  });

  socket.on("Welcome", (e) => {
    console.log(e);
  });


  socket.on("code-update", handleCodeUpdate);

  return () => {
  
    socket.off("code-update", handleCodeUpdate);

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
  const [code,setCode] = useState(templates[defaultLang]);
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
             clearTimeout(timeOut.current);

timeOut.current = setTimeout(() => {
    socket.emit("code-change", value);
  }, 500);

           

          }}
          theme={theme}
        />

        
          </div>

           </div>

         </>
  )
}

export default App
