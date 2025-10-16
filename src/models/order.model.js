import mongoose from "mongoose";

const shopOrderItemSchema = new mongoose.Schema({
    item:{ type: mongoose.Schema.Types.ObjectId, ref: 'Item'},
    name:{ type: String, required: true },
    quantity:{ type: Number, required: true },
    price:{ type: Number, required: true },
    image:{ type: String, required: true },
    foodType:{ type: String, enum: ['veg', 'non-veg'], required: true },
},{timestamps: true});

const shopOrderSchema = new mongoose.Schema({
    shop:{ type: mongoose.Schema.Types.ObjectId, ref: 'Shop'},
    owner:{ type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    subtotal:{ type: Number, required: true },
    shopOrderItems:[shopOrderItemSchema],
    status:{
        type:String,
        enum:['pending','preparing','out-for-delivery','delivered','cancelled'],
        default:"pending"
    },
    assignment:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DeliveryAssignment',
        default: null
    },
    assignedDeliveryBoy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

},{timestamps: true});

const orderSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
        paymentMethod:{ type: String, enum: ['cod', 'online'], required: true },
        deliveryAddress: { text: String, latitude: Number, longitude: Number },
        totalAmount: { type: Number, required: true },
        shopOrder: [shopOrderSchema],

    },{ timestamps: true }

)

const Order = mongoose.model("Order", orderSchema);
export default Order;