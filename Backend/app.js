import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import connectDB from "./db.js";
import Room from "./Models/Room.js";
import dotenv from "dotenv";
import fetch from "node-fetch";
import redis from "./redis.js";

dotenv.config();

const app = express();


const PORT = process.env.PORT || 3000;

const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173",
             "https://live-coding-editor.vercel.app"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors());
app.use(express.json({
    limit: "10mb"
}));

app.get('/', (req, res) => {
    res.send("SKFNJGJ")
})
const runRateLimit = new Map();

const RUN_WINDOW_MS = 60 * 1000;
const RUN_LIMIT = 5;
function allowRunCode(userId) {
    const now = Date.now();

    if (!runRateLimit.has(userId)) {
        runRateLimit.set(userId, []);
    }


    const timestamps = runRateLimit.get(userId);

    console.log(
        "RUN REQUEST",
        userId,
        timestamps.length
    );

    while (
        timestamps.length &&
        now - timestamps[0] > RUN_WINDOW_MS
    ) {
        timestamps.shift();
    }

    if (timestamps.length >= RUN_LIMIT) {
        console.log(
            "ROOM RATE LIMITED",
            userId
        );
        return false;
    }

    timestamps.push(now);
    return true;
}

const rooms = {};
const roomsCache = {};

const roomRateLimit = new Map();


const WINDOW_MS = 60 * 1000; // 1 minute
const LIMIT = 10;


function allowRoomAction(userId) {
    const now = Date.now();
    if (!roomRateLimit.has(userId)) {
        roomRateLimit.set(userId, []);

    }

    const timestamps = roomRateLimit.get(userId);

    while (timestamps.length && (now - timestamps[0]) > WINDOW_MS) {
        timestamps.shift();
    }

    console.log(
        "RATE LIMITED",
        userId,
        timestamps.length
    );

    if (timestamps.length >= LIMIT) {
        return false;
    }
    console.log(
        "ALLOWED",
        userId,
        timestamps.length
    );

    timestamps.push(now);

    return true;
}

io.on("connection", (socket) => {

    // console.log("User Connected",socket.id);

    socket.on(
    "run-code",
    async ({
        code,
        language,
        roomId,
        userId
    }) => {

        if(!allowRunCode(userId)){

            socket.emit(
                "execution-result",
                "Rate limit exceeded"
            );

            return;
        }

        try {

    await redis.rPush(
        "codeQueue",
        JSON.stringify({
            code,
            language,
            roomId
        })
    );

       console.log(
    "JOB QUEUED",
    roomId
);

        socket.emit(
            "job-queued"
        );

    }
    




catch(err){

    socket.emit(
        "execution-result",
        "Queue unavailable"
    );

}

    }
);
     
    socket.on("create-room", async ({ roomId, passcode, userId }) => {
        if (!allowRoomAction(userId)) {
            socket.emit(
                "room-create-error",
                "Too many requests"
            );
            return;
        }

        try {

            await Room.create({
    roomId,
    passcode,
    code: `#include <iostream>
using namespace std;

int main() {
    cout << "Hello World";
    return 0;
}`
});
            socket.emit(
                "room-created",
                roomId
            );

        } catch {

            socket.emit(
                "create-error",
                "Room already exists"
            );

        }




    });

    socket.on("join-room", async ({ roomId,
        passcode, userId, userName }) => {
        if (!allowRoomAction(userId)) {
            socket.emit(
                "join-error",
                "Too many requests"
            );
            return;
        }


        console.log(
            "JOIN ROOM:",
            roomId,
            userName,
            socket.id
        );
        let dbRoom;

        if (roomsCache[roomId]) {
            dbRoom = roomsCache[roomId];
            console.log(
                "Loaded from cache"
            );

        }
        else {
            dbRoom = await Room.findOne({ roomId });

            if (dbRoom) {
                roomsCache[roomId] = {
                    passcode: dbRoom.passcode,
                    code: dbRoom.code,
                    dirty: false
                };
            }

            console.log(
                "Loaded from DB"
            );
        }
        if (!dbRoom) {

            socket.emit(
                "join-error",
                "Room does not exist"
            );

            return;
        }


        if (roomsCache[roomId].passcode !== passcode) {

            socket.emit(
                "join-error",
                "Incorrect Passcode"
            );

            return;
        }
        if (!rooms[roomId]) {

            rooms[roomId] = {
                users: {}
            };

        }

        const room = rooms[roomId];




        // Store room and user info on socket
        socket.roomId = roomId;
        socket.userId = userId;


        if (room.users[userId]) {
            console.log(
                "Reconnected:",
                userName
            );

            // "old socket:",
            //users[userId].socketId,
            //"new socket:",
            //socket.id
            room.users[userId].socketIds.add(socket.id);
        }
        else {


            console.log("New User:", userName);
            room.users[userId] = {
                socketIds: new Set([socket.id]),
                userName
            };
            socket.to(roomId).emit(
                "notification",
                `${userName} joined the room`
            );
        }

        socket.join(roomId);
        const userList = Object.values(room.users)
            .map(user => user.userName);
        io.to(roomId).emit(
            "users-update",
            userList
        );

        socket.emit("sync-code", roomsCache[roomId].code);
    });
    

    // Listen for code change 
    socket.on("code-change", async ({ roomId, code }) => {

        const userId =
            socket.userId;




        console.log(
            "CODE CHANGE:",
            roomId,
            socket.id
        );

        if (!rooms[roomId]) return;

      


        roomsCache[roomId].code = code;
        roomsCache[roomId].dirty = true;
        // console.log("Code received from:", socket.id);


        // Send Code to others
        socket.to(roomId).emit("code-change", code);
    });

    socket.on("cursor-change", (data) => {

        socket.to(data.roomId).emit(
            "cursor-change",
            data
        );

    });


    socket.on("disconnect", () => {

        const roomId = socket.roomId;
        const userId = socket.userId;

        setTimeout(async () => {

            const room = rooms[roomId];

            if (!room) return;

            const user = room.users[userId];

            if (!user) {
                return;
            }

            room.users[userId].socketIds.delete(socket.id);

            if (
                room.users[userId] &&
                room.users[userId].socketIds.size == 0
            ) {
                console.log(
                    "Removed User",
                    room.users[userId].userName
                );
                delete room.users[userId];
                socket.to(roomId).emit(
                    "notification",
                    `${user.userName} left the room`
                );
                const userList = Object.values(room.users)
                    .map(user => user.userName);

                io.to(roomId).emit(
                    "users-update",
                    userList
                );
            }

            if (Object.keys(room.users).length === 0) {

                if (
                    roomsCache[roomId] &&
                    roomsCache[roomId].dirty
                ) {

                    await Room.updateOne(
                        { roomId },
                        {
                            code:
                                roomsCache[roomId].code
                        }
                    );
                }
                delete rooms[roomId];
                delete roomsCache[roomId];
            }



        }, 20000)


        //  console.log("User disconnected:", socket.id);
    });
});


app.post(
    "/job-complete",
    (req,res)=>{

        const {
            roomId,
            output
        } = req.body;

        console.log(
            "JOB COMPLETE",
            roomId
        );

        io.to(roomId).emit(
            "execution-result",
            output
        );

        res.sendStatus(200);
    }
);

await connectDB();


server.listen(PORT, () => {
    console.log(`Server is running on Port ${PORT}`);
})