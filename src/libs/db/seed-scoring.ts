/**
 * Seeder for Scoring Feature Testing
 * Creates: teacher, students, exam, questions, participants, and answers
 *
 * Run with: npx tsx src/libs/db/seed-scoring.ts
 */

import "dotenv/config";
import { db } from "./index";
import {
	users,
	questions,
	exams,
	examQuestions,
	examParticipants,
	answers,
} from "./schema";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

async function seedScoring() {
	console.log("🌱 Starting scoring feature seed...");

	// 1. Create teacher (GURU)
	const teacherId = uuidv4();
	const teacherPassword = await bcrypt.hash("password123", 10);

	await db
		.insert(users)
		.values({
			id: teacherId,
			name: "Guru Test",
			email: "guru@test.com",
			passwordHash: teacherPassword,
			role: "GURU",
		})
		.onConflictDoNothing();

	console.log("✅ Created teacher: guru@test.com / password123");

	// 2. Create students (MURID)
	const studentIds: string[] = [];
	const studentData = [
		{ name: "Ahmad Siswa", email: "ahmad@test.com" },
		{ name: "Budi Pelajar", email: "budi@test.com" },
		{ name: "Citra Mahasiswa", email: "citra@test.com" },
	];

	for (const student of studentData) {
		const studentId = uuidv4();
		studentIds.push(studentId);
		const studentPassword = await bcrypt.hash("password123", 10);

		await db
			.insert(users)
			.values({
				id: studentId,
				name: student.name,
				email: student.email,
				passwordHash: studentPassword,
				role: "MURID",
			})
			.onConflictDoNothing();
	}

	console.log(`✅ Created ${studentData.length} students`);

	// 3. Create questions (mix of PG and ESSAY)
	const questionData = [
		{
			id: uuidv4(),
			teacherId,
			type: "PG" as const,
			question: "Apa ibu kota Indonesia?",
			options: {
				A: "Surabaya",
				B: "Jakarta",
				C: "Bandung",
				D: "Yogyakarta",
			},
			answerKey: "B",
			difficulty: "mudah",
		},
		{
			id: uuidv4(),
			teacherId,
			type: "PG" as const,
			question: "Berapa hasil dari 5 x 7?",
			options: { A: "25", B: "30", C: "35", D: "40" },
			answerKey: "C",
			difficulty: "mudah",
		},
		{
			id: uuidv4(),
			teacherId,
			type: "ESSAY" as const,
			question: "Jelaskan proses fotosintesis pada tumbuhan!",
			answerKey: `Fotosintesis merupakan proses pembuatan makanan oleh tumbuhan hijau 
yang berlangsung di kloroplas dengan bantuan cahaya matahari.
Bahan yang dibutuhkan adalah air (H2O) dari akar dan karbon dioksida (CO2) dari udara.
Reaksi fotosintesis menghasilkan glukosa (C6H12O6) sebagai makanan 
dan oksigen (O2) yang dilepaskan sebagai produk sampingan.
Proses ini sangat penting bagi kehidupan karena menghasilkan oksigen
dan menjadi dasar rantai makanan.`,
			rubric: {
				pemahaman_konsep: 30,
				kelengkapan_jawaban: 30,
				struktur_dan_organisasi: 20,
				tata_bahasa: 20,
			},
			difficulty: "sedang",
		},
		{
			id: uuidv4(),
			teacherId,
			type: "ESSAY" as const,
			question:
				"Apa manfaat olahraga bagi kesehatan tubuh? Jelaskan minimal 3 manfaat!",
			answerKey: `Manfaat olahraga bagi kesehatan tubuh:
1. Menjaga kesehatan jantung dan peredaran darah
2. Meningkatkan daya tahan tubuh dan sistem imun
3. Membantu mengontrol berat badan
4. Mengurangi stres dan meningkatkan suasana hati
5. Memperkuat otot dan tulang`,
			rubric: {
				pemahaman_konsep: 30,
				kelengkapan_jawaban: 40,
				tata_bahasa: 30,
			},
			difficulty: "mudah",
		},
	];

	for (const q of questionData) {
		await db.insert(questions).values(q).onConflictDoNothing();
	}

	console.log(`✅ Created ${questionData.length} questions (2 PG, 2 ESSAY)`);

	// 4. Create exam
	const examId = uuidv4();
	await db
		.insert(exams)
		.values({
			id: examId,
			teacherId,
			title: "Ujian Harian - Test Scoring AI",
			description:
				"Ujian untuk testing fitur penilaian otomatis dengan AI",
			status: "ONGOING",
			startTime: new Date(),
			endTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
			duration: 60,
			settings: {
				enableProctoring: false,
				shuffleQuestions: false,
			},
		})
		.onConflictDoNothing();

	console.log("✅ Created exam: Ujian Harian - Test Scoring AI");

	// 5. Link questions to exam
	for (let i = 0; i < questionData.length; i++) {
		await db
			.insert(examQuestions)
			.values({
				examId,
				questionId: questionData[i].id,
				order: i + 1,
				points: questionData[i].type === "ESSAY" ? 30 : 20,
			})
			.onConflictDoNothing();
	}

	console.log("✅ Linked questions to exam");

	// 6. Create exam participants
	const participantIds: string[] = [];
	for (const studentId of studentIds) {
		const participantId = uuidv4();
		participantIds.push(participantId);

		await db
			.insert(examParticipants)
			.values({
				id: participantId,
				examId,
				studentId,
				status: "SUBMITTED",
				startTime: new Date(Date.now() - 30 * 60 * 1000), // Started 30 min ago
				submitTime: new Date(Date.now() - 5 * 60 * 1000), // Submitted 5 min ago
			})
			.onConflictDoNothing();
	}

	console.log(`✅ Created ${participantIds.length} exam participants`);

	// 7. Create student answers
	// Student answers with varying quality for testing
	const studentAnswers = [
		// Student 1 - Good answers
		[
			{ questionIndex: 0, answerText: "B" }, // PG - Correct
			{ questionIndex: 1, answerText: "C" }, // PG - Correct
			{
				questionIndex: 2,
				answerText: `Fotosintesis adalah proses tumbuhan membuat makanan sendiri. 
Proses ini terjadi di daun, tepatnya di kloroplas. 
Tumbuhan menggunakan cahaya matahari, air, dan karbon dioksida.
Hasilnya adalah glukosa dan oksigen yang dilepaskan ke udara.
Fotosintesis sangat penting untuk kehidupan di bumi.`,
			},
			{
				questionIndex: 3,
				answerText: `Manfaat olahraga bagi kesehatan:
1. Menjaga kesehatan jantung supaya tetap kuat memompa darah
2. Meningkatkan daya tahan tubuh agar tidak mudah sakit
3. Membantu menurunkan berat badan yang berlebih
4. Membuat pikiran lebih segar dan mengurangi stres`,
			},
		],
		// Student 2 - Medium answers
		[
			{ questionIndex: 0, answerText: "B" }, // PG - Correct
			{ questionIndex: 1, answerText: "B" }, // PG - Wrong
			{
				questionIndex: 2,
				answerText: `Fotosintesis adalah cara tumbuhan membuat makanan. 
Butuh sinar matahari dan air. Hasilnya makanan untuk tumbuhan.`,
			},
			{
				questionIndex: 3,
				answerText: `Olahraga bagus untuk kesehatan karena bisa bikin sehat dan kuat.
Juga bisa mengurangi stres.`,
			},
		],
		// Student 3 - Poor answers
		[
			{ questionIndex: 0, answerText: "A" }, // PG - Wrong
			{ questionIndex: 1, answerText: "C" }, // PG - Correct
			{
				questionIndex: 2,
				answerText: `Fotosintesis terjadi di daun tumbuhan.`,
			},
			{
				questionIndex: 3,
				answerText: `Olahraga bagus untuk sehat.`,
			},
		],
	];

	for (let pIdx = 0; pIdx < participantIds.length; pIdx++) {
		const participantId = participantIds[pIdx];
		const studentAnswerSet = studentAnswers[pIdx];

		for (const ans of studentAnswerSet) {
			await db
				.insert(answers)
				.values({
					id: uuidv4(),
					participantId,
					questionId: questionData[ans.questionIndex].id,
					answerText: ans.answerText,
					status: "PENDING", // Ready for scoring
				})
				.onConflictDoNothing();
		}
	}

	console.log("✅ Created student answers (ready for AI scoring)");

	console.log("\n🎉 Scoring feature seed completed!");
	console.log("\n📝 Test Credentials:");
	console.log("   Teacher: guru@test.com / password123");
	console.log(
		"   Students: ahmad@test.com, budi@test.com, citra@test.com / password123",
	);
	console.log("\n🚀 Next Steps:");
	console.log("   1. Login as guru@test.com");
	console.log("   2. Go to /scoring page");
	console.log("   3. Click 'Nilai AI' to trigger AI scoring");
	console.log("   4. Review the AI-scored answers");

	process.exit(0);
}

seedScoring().catch((err) => {
	console.error("❌ Seed failed:", err);
	process.exit(1);
});
