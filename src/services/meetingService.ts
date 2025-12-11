import { io, Socket } from "socket.io-client";

const CHAT_URL =
  import.meta.env.VITE_CHAT_SOCKET_URL || "http://localhost:3000";

export type ChatUserInfo = {
  userId: string;
  displayName: string;
  photoURL?: string;
};

export type ChatParticipant = {
  socketId: string;
  userInfo: ChatUserInfo;
};

export type ChatMessagePayload = {
  roomId: string;
  userName: string;
  message: string;
  timestamp: number;
};

// Single socket instance for the entire app.
const socket: Socket = io(CHAT_URL, {
  autoConnect: false,
  transports: ["websocket"],
});

const subscribe = <TPayload>(
  event: string,
  handler: (payload: TPayload) => void
) => {
  socket.off(event, handler);
  socket.on(event, handler);
  return () => socket.off(event, handler);
};

export const connectSocket = () => socket.connect();
export const disconnectSocket = () => socket.disconnect();

export const joinRoom = (roomId: string, userInfo: ChatUserInfo) =>
  socket.emit("join:room", roomId, userInfo);

export const sendChatMessage = (payload: ChatMessagePayload) =>
  socket.emit("chat:message", payload);

export const onExistingUsers = (handler: (users: ChatParticipant[]) => void) =>
  subscribe("existing:users", handler);

export const onUserJoined = (
  handler: (data: ChatParticipant) => void
) => subscribe("user:joined", handler);

export const onUserLeft = (
  handler: (data: ChatParticipant) => void
) => subscribe("user:left", handler);

export const onChatMessage = (
  handler: (data: ChatMessagePayload) => void
) => subscribe("chat:message", handler);

export const onRoomFull = (handler: () => void) =>
  subscribe("room:full", handler);

export const onSocketConnect = (handler: () => void) =>
  subscribe("connect", handler);

export const onSocketDisconnect = (handler: () => void) =>
  subscribe("disconnect", handler);

export const onSocketError = (handler: (err: Error) => void) =>
  subscribe("connect_error", handler);

export { socket };