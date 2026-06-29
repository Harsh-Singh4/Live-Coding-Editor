import mongoose from "mongoose";

const roomSchema = new mongoose.Schema({

    roomId: {
        type: String,
        unique: true,
        required: true
    },

    passcode: {
        type: String,
        required: true
    },

    code: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

export default mongoose.model(
    "Room",
    roomSchema
);