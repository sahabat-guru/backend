import { examsRepository } from "./exams.repository";
import { proctoringAIService } from "../../services/proctoring-ai.service";
import {
	NotFoundError,
	ForbiddenError,
	BadRequestError,
} from "../../middlewares/error.middleware";
import { logger } from "../../libs/config";
import { broadcastExamStart, broadcastExamEnd } from "../../libs/websocket";
import type {
	CreateExamInput,
	UpdateExamInput,
	AddQuestionsInput,
	SubmitAnswerInput,
	BatchSubmitAnswersInput,
	ListExamsQuery,
	CreateQuestionInput,
	UpdateQuestionInput,
	ListQuestionsQuery,
} from "./exams.schema";

export const examsService = {
	// === EXAM MANAGEMENT (GURU) ===

	// Create exam
	async createExam(teacherId: string, input: CreateExamInput) {
		const exam = await examsRepository.createExam({
			teacherId,
			title: input.title,
			description: input.description,
			startTime: input.startTime ? new Date(input.startTime) : undefined,
			endTime: input.endTime ? new Date(input.endTime) : undefined,
			duration: input.duration,
			settings: input.settings,
			status: "DRAFT",
		});

		logger.info(
			{ teacherId, title: input.title },
			`Exam created: ${exam.id}`,
		);

		return exam;
	},

	// Get exam
	async getExam(examId: string, userId: string, isTeacher: boolean) {
		const exam = await examsRepository.findExamWithQuestions(examId);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		// Teachers can only see their own exams
		if (isTeacher && exam.teacherId !== userId) {
			throw new ForbiddenError("You do not have access to this exam");
		}

		// Students access rules
		if (!isTeacher) {
			// ONGOING exams are always accessible for students
			if (exam.status === "ONGOING") {
				return exam;
			}

			// For FINISHED/PUBLISHED, check if student has participated
			if (exam.status === "FINISHED" || exam.status === "PUBLISHED") {
				const participant = await examsRepository.findParticipant(
					examId,
					userId,
				);
				if (participant) {
					return exam;
				}
			}

			// Otherwise, deny access
			throw new ForbiddenError("This exam is not available");
		}

		return exam;
	},

	// List exams for teacher
	async listExams(teacherId: string, query: ListExamsQuery) {
		return examsRepository.listExamsByTeacher(teacherId, query);
	},

	// List available exams for students
	async listAvailableExams(query: ListExamsQuery) {
		return examsRepository.listAvailableExams(query);
	},

	// Get student exam history
	async getStudentExamHistory(
		studentId: string,
		status?: "ONGOING" | "FINISHED" | "PUBLISHED",
	) {
		return examsRepository.listStudentExamHistory(studentId, status);
	},

	// Update exam
	async updateExam(
		examId: string,
		teacherId: string,
		input: UpdateExamInput,
	) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		// Allow editing in DRAFT and FINISHED status
		if (exam.status === "ONGOING") {
			throw new BadRequestError(
				"Cannot update exam that is currently ongoing",
			);
		}

		if (exam.status === "PUBLISHED") {
			throw new BadRequestError(
				"Cannot update exam that has been published",
			);
		}

		const updated = await examsRepository.updateExam(examId, {
			...input,
			startTime: input.startTime
				? new Date(input.startTime)
				: exam.startTime,
			endTime: input.endTime ? new Date(input.endTime) : exam.endTime,
		});

		logger.info(`Exam updated: ${examId}`);

		return updated;
	},

	// Delete exam
	async deleteExam(examId: string, teacherId: string) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		if (exam.status === "ONGOING") {
			throw new BadRequestError("Cannot delete ongoing exam");
		}

		await examsRepository.deleteExam(examId);

		logger.info(`Exam deleted: ${examId}`);

		return { success: true };
	},

	// Update exam status with validation
	async updateExamStatus(
		examId: string,
		teacherId: string,
		newStatus: "DRAFT" | "ONGOING" | "FINISHED" | "PUBLISHED",
	) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		// Validate status transitions
		const validTransitions: Record<string, string[]> = {
			DRAFT: ["ONGOING"],
			ONGOING: ["FINISHED"],
			FINISHED: ["PUBLISHED", "ONGOING"], // Can reopen or publish
			PUBLISHED: [], // Terminal state
		};

		if (!validTransitions[exam.status]?.includes(newStatus)) {
			throw new BadRequestError(
				`Cannot transition from ${exam.status} to ${newStatus}`,
			);
		}

		// For DRAFT -> ONGOING, check if exam has questions
		if (exam.status === "DRAFT" && newStatus === "ONGOING") {
			const questions = await examsRepository.getExamQuestions(examId);
			if (questions.length === 0) {
				throw new BadRequestError(
					"Cannot start exam without questions",
				);
			}

			// Initialize statistics
			await examsRepository.upsertStatistics(examId, {
				avgScore: 0,
				maxScore: 0,
				minScore: 0,
				totalParticipants: 0,
				submittedCount: 0,
				scoredCount: 0,
				suspiciousCount: 0,
			});

			// Broadcast to connected clients
			broadcastExamStart(examId);
		}

		// For ONGOING -> FINISHED, broadcast end
		if (exam.status === "ONGOING" && newStatus === "FINISHED") {
			broadcastExamEnd(examId);
		}

		const updated = await examsRepository.updateExam(examId, {
			status: newStatus,
			...(newStatus === "ONGOING" && !exam.startTime
				? { startTime: new Date() }
				: {}),
			...(newStatus === "FINISHED" ? { endTime: new Date() } : {}),
		});

		logger.info(
			{ examId, from: exam.status, to: newStatus },
			"Exam status updated",
		);

		return updated;
	},

	// Add questions to exam
	async addQuestionsToExam(
		examId: string,
		teacherId: string,
		input: AddQuestionsInput,
	) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		if (exam.status !== "DRAFT") {
			throw new BadRequestError(
				"Cannot add questions to exam that is not in DRAFT status",
			);
		}

		// Verify all questions exist and belong to teacher
		for (const q of input.questions) {
			const question = await examsRepository.findQuestionByIdAndTeacher(
				q.questionId,
				teacherId,
			);
			if (!question) {
				throw new NotFoundError(`Question ${q.questionId}`);
			}
		}

		await examsRepository.addQuestionsToExam(examId, input.questions);

		logger.info(
			{ count: input.questions.length },
			`Questions added to exam: ${examId}`,
		);

		return examsRepository.findExamWithQuestions(examId);
	},

	// Remove question from exam
	async removeQuestionFromExam(
		examId: string,
		teacherId: string,
		questionId: string,
	) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		if (exam.status !== "DRAFT") {
			throw new BadRequestError(
				"Cannot remove questions from exam that is not in DRAFT status",
			);
		}

		await examsRepository.removeQuestionFromExam(examId, questionId);

		logger.info({ questionId }, `Question removed from exam: ${examId}`);

		return { success: true };
	},

	// Publish exam (start)
	async publishExam(examId: string, teacherId: string) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		if (exam.status !== "DRAFT") {
			throw new BadRequestError("Exam is already published");
		}

		// Check if exam has questions
		const questions = await examsRepository.getExamQuestions(examId);
		if (questions.length === 0) {
			throw new BadRequestError("Cannot publish exam without questions");
		}

		const updated = await examsRepository.updateExam(examId, {
			status: "ONGOING",
			startTime: exam.startTime || new Date(),
		});

		// Initialize statistics
		await examsRepository.upsertStatistics(examId, {
			avgScore: 0,
			maxScore: 0,
			minScore: 0,
			totalParticipants: 0,
			submittedCount: 0,
			scoredCount: 0,
			suspiciousCount: 0,
		});

		// Broadcast to connected clients
		broadcastExamStart(examId);

		logger.info(`Exam published: ${examId}`);

		return updated;
	},

	// End exam
	async endExam(examId: string, teacherId: string) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		if (exam.status !== "ONGOING") {
			throw new BadRequestError("Exam is not ongoing");
		}

		const updated = await examsRepository.updateExam(examId, {
			status: "FINISHED",
			endTime: new Date(),
		});

		// Broadcast to connected clients
		broadcastExamEnd(examId);

		logger.info(`Exam ended: ${examId}`);

		return updated;
	},

	// Get exam participants
	async getExamParticipants(examId: string, teacherId: string) {
		const exam = await examsRepository.findExamByIdAndTeacher(
			examId,
			teacherId,
		);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		return examsRepository.listParticipants(examId);
	},

	// === STUDENT EXAM ACTIONS ===

	// Join exam
	async joinExam(examId: string, studentId: string, studentName: string) {
		const exam = await examsRepository.findExamById(examId);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		if (exam.status !== "ONGOING") {
			throw new BadRequestError("This exam is not available for joining");
		}

		// Check if already joined
		let participant = await examsRepository.findParticipant(
			examId,
			studentId,
		);

		if (participant) {
			// Return existing participant
			return {
				participant,
				alreadyJoined: true,
			};
		}

		// Start proctoring session if enabled
		let proctoringSessionId: string | undefined;
		const settings = exam.settings as { enableProctoring?: boolean } | null;

		if (settings?.enableProctoring) {
			try {
				proctoringSessionId = await proctoringAIService.startSession({
					student_id: studentId,
					exam_id: examId,
					student_name: studentName,
					exam_name: exam.title,
				});
			} catch (error) {
				logger.error(
					{ err: error },
					"Failed to start proctoring session",
				);
				// Continue without proctoring
			}
		}

		// Create participant
		participant = await examsRepository.createParticipant({
			examId,
			studentId,
			proctoringSessionId,
			startTime: new Date(),
			status: "IN_PROGRESS",
		});

		// Update statistics
		const stats = await examsRepository.getStatistics(examId);
		await examsRepository.upsertStatistics(examId, {
			totalParticipants: (stats?.totalParticipants || 0) + 1,
		});

		logger.info({ studentId }, `Student joined exam: ${examId}`);

		return {
			participant,
			alreadyJoined: false,
			proctoringSessionId,
		};
	},

	// Submit answer
	async submitAnswer(
		examId: string,
		studentId: string,
		input: SubmitAnswerInput,
	) {
		const participant = await examsRepository.findParticipant(
			examId,
			studentId,
		);

		if (!participant) {
			throw new ForbiddenError("You have not joined this exam");
		}

		if (participant.submitTime) {
			throw new BadRequestError("You have already submitted the exam");
		}

		// Verify question belongs to exam
		const examQuestions = await examsRepository.getExamQuestions(examId);
		const questionExists = examQuestions.some(
			(eq) => eq.questionId === input.questionId,
		);

		if (!questionExists) {
			throw new NotFoundError("Question not found in this exam");
		}

		const answer = await examsRepository.upsertAnswer(
			participant.id,
			input.questionId,
			{
				answerText: input.answerText,
				answerFileUrl: input.answerFileUrl,
				status: "PENDING",
			},
		);

		logger.debug(
			{ examId, studentId, questionId: input.questionId },
			`Answer submitted: ${answer.id}`,
		);

		return answer;
	},

	// Batch submit answers
	async batchSubmitAnswers(
		examId: string,
		studentId: string,
		input: BatchSubmitAnswersInput,
	) {
		const participant = await examsRepository.findParticipant(
			examId,
			studentId,
		);

		if (!participant) {
			throw new ForbiddenError("You have not joined this exam");
		}

		if (participant.submitTime) {
			throw new BadRequestError("You have already submitted the exam");
		}

		const results = [];
		for (const answerInput of input.answers) {
			const answer = await examsRepository.upsertAnswer(
				participant.id,
				answerInput.questionId,
				{
					answerText: answerInput.answerText,
					answerFileUrl: answerInput.answerFileUrl,
					status: "PENDING",
				},
			);
			results.push(answer);
		}

		logger.info(
			{ studentId, count: results.length },
			`Batch answers submitted: ${examId}`,
		);

		return results;
	},

	// Finish exam (final submit)
	async finishExam(examId: string, studentId: string) {
		const exam = await examsRepository.findExamById(examId);

		if (!exam) {
			throw new NotFoundError("Exam");
		}

		const participant = await examsRepository.findParticipant(
			examId,
			studentId,
		);

		if (!participant) {
			throw new ForbiddenError("You have not joined this exam");
		}

		if (participant.submitTime) {
			throw new BadRequestError("You have already submitted the exam");
		}

		// End proctoring session
		if (participant.proctoringSessionId) {
			try {
				await proctoringAIService.endSession(
					participant.proctoringSessionId,
				);
			} catch (error) {
				logger.error(
					{ err: error },
					"Failed to end proctoring session",
				);
			}
		}

		// Mark as submitted
		const updated = await examsRepository.updateParticipant(
			participant.id,
			{
				submitTime: new Date(),
				status: "SUBMITTED",
			},
		);

		// Update statistics
		const stats = await examsRepository.getStatistics(examId);
		await examsRepository.upsertStatistics(examId, {
			submittedCount: (stats?.submittedCount || 0) + 1,
		});

		logger.info({ studentId }, `Exam finished: ${examId}`);

		return updated;
	},

	// Get student's exam status
	async getStudentExamStatus(examId: string, studentId: string) {
		const participant = await examsRepository.findParticipant(
			examId,
			studentId,
		);

		if (!participant) {
			return { joined: false };
		}

		const answers = await examsRepository.getParticipantAnswers(
			participant.id,
		);

		// Get exam to check if it's published (for showing full results)
		const exam = await examsRepository.findExamById(examId);
		const showResults =
			exam?.status === "PUBLISHED" || exam?.status === "FINISHED";

		return {
			joined: true,
			participant,
			answeredCount: answers.length,
			submitted: !!participant.submitTime,
			// Include full answers with questions for results page
			answers: showResults ? answers : undefined,
		};
	},

	// Get student's exams history
	async getStudentExams(studentId: string) {
		return examsRepository.getStudentExams(studentId);
	},

	// === QUESTION MANAGEMENT ===

	// Create question
	async createQuestion(teacherId: string, input: CreateQuestionInput) {
		const question = await examsRepository.createQuestion({
			teacherId,
			type: input.type,
			question: input.question,
			options: input.options,
			answerKey: input.answerKey,
			rubric: input.rubric,
			difficulty: input.difficulty,
			category: input.category,
			isHots: input.isHots,
		});

		logger.info({ teacherId }, `Question created: ${question.id}`);

		return question;
	},

	// Get question
	async getQuestion(questionId: string, teacherId: string) {
		const question = await examsRepository.findQuestionByIdAndTeacher(
			questionId,
			teacherId,
		);

		if (!question) {
			throw new NotFoundError("Question");
		}

		return question;
	},

	// List questions
	async listQuestions(teacherId: string, query: ListQuestionsQuery) {
		return examsRepository.listQuestionsByTeacher(teacherId, query);
	},

	// Update question
	async updateQuestion(
		questionId: string,
		teacherId: string,
		input: UpdateQuestionInput,
	) {
		const question = await examsRepository.findQuestionByIdAndTeacher(
			questionId,
			teacherId,
		);

		if (!question) {
			throw new NotFoundError("Question");
		}

		const updated = await examsRepository.updateQuestion(questionId, input);

		logger.info(`Question updated: ${questionId}`);

		return updated;
	},

	// Delete question
	async deleteQuestion(questionId: string, teacherId: string) {
		const question = await examsRepository.findQuestionByIdAndTeacher(
			questionId,
			teacherId,
		);

		if (!question) {
			throw new NotFoundError("Question");
		}

		await examsRepository.deleteQuestion(questionId);

		logger.info(`Question deleted: ${questionId}`);

		return { success: true };
	},
};
