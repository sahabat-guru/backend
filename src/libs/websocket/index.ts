import { Server as SocketIOServer, Socket } from "socket.io";
import { Server as HttpServer } from "http";
import { logger } from "../config";
import { verifyAccessToken } from "../jwt";
import type {
	JWTPayload,
	ExamJoinPayload,
	ProctoringFramePayload,
	ProctoringAlertPayload,
} from "../../types";

let io: SocketIOServer | null = null;

// Socket user data
interface SocketData {
	user: JWTPayload;
}

// Initialize Socket.IO server
export function initializeWebSocket(httpServer: HttpServer): SocketIOServer {
	io = new SocketIOServer(httpServer, {
		cors: {
			origin: "*", // Configure this properly in production
			methods: ["GET", "POST"],
		},
		pingTimeout: 60000,
		pingInterval: 25000,
	});

	// Authentication middleware
	io.use((socket, next) => {
		const token =
			socket.handshake.auth.token ||
			socket.handshake.headers.authorization?.replace("Bearer ", "");

		if (!token) {
			return next(new Error("Authentication required"));
		}

		const payload = verifyAccessToken(token);
		if (!payload) {
			return next(new Error("Invalid token"));
		}

		(socket as Socket & { data: SocketData }).data.user = payload;
		next();
	});

	// Connection handler
	io.on("connection", (socket) => {
		const userData = (socket as Socket & { data: SocketData }).data.user;
		logger.info(`Client connected: ${socket.id}, User: ${userData.sub}`);

		socket.on("disconnect", (reason) => {
			logger.info(`Client disconnected: ${socket.id}, Reason: ${reason}`);
		});

		socket.on("error", (error) => {
			logger.error({ err: error }, `Socket error: ${socket.id}`);
		});
	});

	// Exam namespace
	const examNamespace = io.of("/exam");

	examNamespace.use((socket, next) => {
		const token =
			socket.handshake.auth.token ||
			socket.handshake.headers.authorization?.replace("Bearer ", "");

		if (!token) {
			return next(new Error("Authentication required"));
		}

		const payload = verifyAccessToken(token);
		if (!payload) {
			return next(new Error("Invalid token"));
		}

		(socket as Socket & { data: SocketData }).data.user = payload;
		next();
	});

	examNamespace.on("connection", (socket) => {
		const userData = (socket as Socket & { data: SocketData }).data.user;
		logger.info(
			`Exam namespace - Client connected: ${socket.id}, User: ${userData.sub}`,
		);

		// Join exam room
		socket.on("exam:join", (payload: ExamJoinPayload) => {
			const roomId = `exam:${payload.examId}`;
			socket.join(roomId);
			socket.emit("exam:joined", {
				success: true,
				examId: payload.examId,
			});
			logger.info(`User ${userData.sub} joined exam room: ${roomId}`);
		});

		// Leave exam room
		socket.on("exam:leave", (payload: { examId: string }) => {
			const roomId = `exam:${payload.examId}`;
			socket.leave(roomId);
			logger.info(`User ${userData.sub} left exam room: ${roomId}`);
		});

		socket.on("disconnect", () => {
			logger.info(`Exam namespace - Client disconnected: ${socket.id}`);
		});
	});

	// Proctoring namespace
	const proctoringNamespace = io.of("/proctoring");

	proctoringNamespace.use((socket, next) => {
		const token =
			socket.handshake.auth.token ||
			socket.handshake.headers.authorization?.replace("Bearer ", "");

		if (!token) {
			return next(new Error("Authentication required"));
		}

		const payload = verifyAccessToken(token);
		if (!payload) {
			return next(new Error("Invalid token"));
		}

		(socket as Socket & { data: SocketData }).data.user = payload;
		next();
	});

	proctoringNamespace.on("connection", (socket) => {
		const userData = (socket as Socket & { data: SocketData }).data.user;
		logger.info(
			`Proctoring namespace - Client connected: ${socket.id}, User: ${userData.sub}`,
		);

		// Join proctoring room for an exam (guru observes all students)
		socket.on("proctoring:observe", (payload: { examId: string }) => {
			const roomId = `proctoring:${payload.examId}`;
			socket.join(roomId);
			logger.info(
				`User ${userData.sub} started observing proctoring: ${roomId}`,
			);
		});

		// Student starts proctoring session
		socket.on(
			"proctoring:start",
			(payload: { examId: string; sessionId: string }) => {
				const roomId = `proctoring:${payload.examId}`;
				socket.join(roomId);
				socket.data.sessionId = payload.sessionId;
				logger.info(
					`Student ${userData.sub} started proctoring session: ${payload.sessionId}`,
				);
			},
		);

		socket.on("disconnect", () => {
			logger.info(
				`Proctoring namespace - Client disconnected: ${socket.id}`,
			);
		});
	});

	logger.info("WebSocket server initialized");
	return io;
}

// Get Socket.IO instance
export function getIO(): SocketIOServer | null {
	return io;
}

// Emit exam event to room
export function emitExamEvent(
	examId: string,
	event: string,
	data: unknown,
): void {
	if (!io) return;
	io.of("/exam").to(`exam:${examId}`).emit(event, data);
}

// Emit proctoring alert to teachers
export function emitProctoringAlert(
	examId: string,
	alert: ProctoringAlertPayload,
): void {
	if (!io) return;
	io.of("/proctoring")
		.to(`proctoring:${examId}`)
		.emit("proctoring:alert", alert);
}

// Emit warning to specific student
export function emitProctoringWarning(
	studentSocketId: string,
	warning: { type: string; message: string },
): void {
	if (!io) return;
	io.of("/proctoring")
		.to(studentSocketId)
		.emit("proctoring:warning", warning);
}

// Broadcast exam start
export function broadcastExamStart(examId: string): void {
	emitExamEvent(examId, "exam:start", { examId, startedAt: new Date() });
}

// Broadcast exam end
export function broadcastExamEnd(examId: string): void {
	emitExamEvent(examId, "exam:end", { examId, endedAt: new Date() });
}
