

import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String},
    mobile: { type: String, required: true },
    role: { type: String, enum: ['user', 'owner', 'deliveryBoy'], default: 'user' },
    otp:{
        type: String,
    },
    isOtpVerified:{
        type: Boolean,
        default: false,
    },
    isOtpExpired:{
        type: Date,
    },
    location:{
        type:{type:String,
            enum:['Point'],
            default:'Point'
        },
        coordinates:{
            type:[Number], // [longitude, latitude]
            default:[0,0]
        }
    }
}, { timestamps: true })

userSchema.index({ location: "2dsphere" });

const User = mongoose.model("User", userSchema);

export default User;