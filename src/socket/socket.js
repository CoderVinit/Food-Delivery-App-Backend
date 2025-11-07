import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let ioInstance = null;

const parseCookies = (cookieHeader = "") => {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...v] = part.split("=");
    if (!key || !v.length) return acc;
    acc[key.trim()] = decodeURIComponent(v.join("=").trim());
    return acc;
  }, {});
};

const extractToken = (socket) => {
  const authToken = socket.handshake?.auth?.token;
  if (authToken) return authToken;

  const bearerHeader = socket.handshake?.headers?.authorization;
  if (bearerHeader?.startsWith("Bearer ")) {
    return bearerHeader.substring(7);
  }

  const cookies = parseCookies(socket.handshake?.headers?.cookie || "");
  if (cookies.token) return cookies.token;

  return null;
};

export const initSocketServer = (httpServer, allowedOrigins = []) => {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  ioInstance.use((socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) {
        console.warn("Socket auth failed: missing token", {
          id: socket.id,
          origin: socket.handshake?.headers?.origin,
        });
        return next(new Error("Unauthorized"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = decoded.userId;
      socket.data.role = decoded.role;
      console.log("Socket authenticated", {
        id: socket.id,
        userId: socket.data.userId,
        role: socket.data.role,
      });
      return next();
    } catch (error) {
      console.error("Socket auth error", error?.message || error);
      return next(new Error("Unauthorized"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const { userId, role } = socket.data;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    console.log("Socket connected", { id: socket.id, userId, role });

    socket.join(`user:${userId}`);

    if (role === "owner") {
      socket.join(`owner:${userId}`);
    }

    if (role === "deliveryBoy") {
      socket.join(`delivery:${userId}`);
    }

    socket.on("order:subscribe", (orderId) => {
      if (!orderId) return;
      console.log("Socket subscribe order", { id: socket.id, orderId });
      socket.join(`order:${orderId}`);
    });

    socket.on("order:unsubscribe", (orderId) => {
      if (!orderId) return;
      console.log("Socket unsubscribe order", { id: socket.id, orderId });
      socket.leave(`order:${orderId}`);
    });

    socket.on("disconnect", (reason) => {
      console.log("Socket disconnected", { id: socket.id, userId, role, reason });
    });
  });

  return ioInstance;
};

export const getIO = () => ioInstance;
