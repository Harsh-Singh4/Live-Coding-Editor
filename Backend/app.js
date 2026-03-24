import express from "express";
import {Server} from "socket.io";
import {createServer} from "http";
import cors from "cors";

const app = express();

const PORT = 3000;

const server = createServer(app);

const io = new Server(server,{
    cors:{
        origin : "http://localhost:5173",
        methods:["GET","POST"],
        credentials:true
    }
});

app.use(cors());

app.get('/',(req,res)=>{
    res.send("SKFNJGJ")
})


io.on("connection",(socket)=>{
    console.log("User Connected",socket.id);

    // Step 1:- 
    // Every user joins room 1
    socket.join("room1");

    // Listen for code change 
    socket.on("code-change", (code) => {
    console.log("Code received from:", socket.id);
    
      
    // Send Code to others
      socket.to("room1").emit("code-update", code);
  });

   socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});




server.listen(PORT,()=>{
    console.log(`Server is running on Port ${PORT}`);
})