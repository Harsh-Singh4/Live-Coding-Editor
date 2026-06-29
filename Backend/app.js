import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import connectDB from "./db.js";
import Room from "./models/Room.js";
import dotenv from "dotenv";
import fetch from "node-fetch";


dotenv.config();

const app = express();


const PORT = 3000;

const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send("SKFNJGJ")
})
const runRateLimit = new Map();

const RUN_WINDOW_MS = 60 * 1000;
const RUN_LIMIT = 3;
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

const langMap = {
    cpp: "CPP17",
    python: "PYTHON3",
    javascript: "JAVASCRIPT_NODE",
    java: "JAVA8"
};
app.post("/run-code", async (req, res) => {

    const { code, language, userId } = req.body;

    if (!allowRunCode(userId)) {
        return res.status(429).json({
            output: "Rate limit exceeded"
        });
    }



    try {

        const response = await fetch(
            "https://api.hackerearth.com/v4/partner/code-evaluation/submissions/",
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "client-secret":
                        process.env.HACKEREARTH_SECRET
                },
                body: JSON.stringify({
                    source: code,
                    lang: langMap[language],
                    input: "",
                    time_limit: 5,
                    memory_limit: 262144
                })
            }
        );

        const data =
            await response.json();

        const statusUrl =
            data.status_update_url;

        let result;

        while (true) {

            const statusResponse =
                await fetch(
                    statusUrl,
                    {
                        headers: {
                            "client-secret":
                                process.env.HACKEREARTH_SECRET
                        }
                    }
                );

            result =
                await statusResponse.json();
            console.log({
                request:
                    result.request_status.code,

                compile:
                    result.result?.compile_status,

                run:
                    result.result?.run_status?.status
            });
            if (
                result.request_status.code ===
                "REQUEST_COMPLETED"
            ) {
                break;
            }

            await new Promise(
                r => setTimeout(r, 2000)
            );
        }
        const outputUrl =
            result.result.run_status.output;

        const outputResponse =
            await fetch(outputUrl);

        const output =
            await outputResponse.text();

        res.json({
            output
        });
    }
    catch (err) {

        res.json({
            output: err.message
        });

    }

});

const rooms = {};
const roomsCache = {};

const roomRateLimit = new Map();


const WINDOW_MS = 60 * 1000; // 1 minute
const LIMIT = 5;


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
                code: ""
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



        }, 5000)


        //  console.log("User disconnected:", socket.id);
    });
});


await connectDB();


server.listen(PORT, () => {
    console.log(`Server is running on Port ${PORT}`);
})