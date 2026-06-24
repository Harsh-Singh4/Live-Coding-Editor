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

const rooms = {};

io.on("connection",(socket)=>{
    
   // console.log("User Connected",socket.id);

    socket.on("join-room", ({roomId,userId,userName}) => {

      if(!rooms[roomId]){
        rooms[roomId]={
            code:"",
            users:{}
        }
      }

      const room = rooms[roomId];

      // Store room and user info on socket
      socket.roomId = roomId;
      socket.userId = userId;

     if(room.users[userId]){
          console.log(
            "Reconnected:",
            userName
        );
        
           // "old socket:",
            //users[userId].socketId,
            //"new socket:",
            //socket.id
        room.users[userId].socketId = socket.id;
     } 
     else{
         console.log("New User:", userName);
          room.users[userId] = {
            socketId: socket.id,
            userName
        };
     }  

    socket.join(roomId);

    socket.emit("sync-code", room.code);
});


    // Listen for code change 
    socket.on("code-change", ({roomId,code}) => {
       
        if(!rooms[roomId]) return;

        rooms[roomId].code = code;

   // console.log("Code received from:", socket.id);
    
      
    // Send Code to others
      socket.to(roomId).emit("code-change", code);
  });


socket.on("disconnect", () => {

    const roomId = socket.roomId;
    const userId = socket.userId;

    setTimeout(()=>{

        const room = rooms[roomId];

        if(!room) return;

        if(
            room.users[userId] &&
            room.users[userId].socketId === socket.id
        ){
            console.log(
                "Removed User",
                room.users[userId].userName
            );

            delete room.users[userId];
        }

        if(Object.keys(room.users).length === 0){
            delete rooms[roomId];
        }

    },5000)

   
  //  console.log("User disconnected:", socket.id);
  });
});



server.listen(PORT,()=>{
    console.log(`Server is running on Port ${PORT}`);
})