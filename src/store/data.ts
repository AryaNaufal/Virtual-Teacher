import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GeneratedDoc } from "@/lib/docs";
import type { Criterion, Grading, PaperCheck, PaperItem } from "@/lib/paper";
export type { PaperCheck, PaperItem } from "@/lib/paper";

export type AttStatus = "H" | "S" | "I" | "A";
export type GradeType = "tugas" | "ujian" | "praktik";

export interface ClassRoom { id: string; name: string }
export interface Subject { id: string; name: string }
export interface Student { id: string; name: string; nis: string; classId: string }
export interface AttRecord { studentId: string; date: string; status: AttStatus }
export interface Grade { id: string; studentId: string; subjectId: string; type: GradeType; title: string; score: number }
export interface FinalGrade { studentId: string; subjectId: string; score: number; approvedAt: number }
export interface Quiz { id: string; title: string; classId: string; key: string[] }
export interface Submission {
  quizId: string; studentId: string; answers: string[]; correct: number; score: number;
  status: "recommended" | "approved"; approvedScore?: number;
}

export interface UploadedFile { id: string; name: string; size: number; mime: string; path: string | null; createdAt: number }

export interface EssayItem {
  studentId: string; answer: string;
  status: "pending" | "recommended" | "approved" | "error";
  score?: number; feedback?: string; error?: string; approvedScore?: number;
}
export interface EssayCheck { id: string; classId: string; title: string; question: string; rubric: string; items: EssayItem[] }

export type DataSnapshot = {
  classes: ClassRoom[]; subjects: Subject[]; students: Student[]; attendance: AttRecord[]; grades: Grade[];
  finals: FinalGrade[]; quizzes: Quiz[]; submissions: Submission[]; docs: GeneratedDoc[]; files: UploadedFile[];
  essays: EssayCheck[]; papers: PaperCheck[];
};

interface DataState {
  classes: ClassRoom[]; subjects: Subject[]; students: Student[];
  attendance: AttRecord[]; grades: Grade[]; finals: FinalGrade[];
  quizzes: Quiz[]; submissions: Submission[];
  addClass: (name: string) => string;
  removeClass: (id: string) => void;
  addSubject: (name: string) => string;
  removeSubject: (id: string) => void;
  addStudents: (s: { name: string; nis: string; className: string }[]) => { added: number; skipped: number };
  removeStudent: (id: string) => void;
  setAttendance: (studentId: string, date: string, status: AttStatus | null) => void;
  addAttendanceBulk: (rows: AttRecord[]) => void;
  addGrade: (g: Omit<Grade, "id">) => void;
  removeGrade: (id: string) => void;
  approveFinal: (f: Omit<FinalGrade, "approvedAt">) => void;
  addQuiz: (q: Omit<Quiz, "id">) => string;
  removeQuiz: (id: string) => void;
  saveSubmissions: (s: Submission[]) => void;
  approveSubmission: (quizId: string, studentId: string, score: number) => void;
  essays: EssayCheck[];
  addEssay: (e: Omit<EssayCheck, "id" | "items">) => string;
  removeEssay: (id: string) => void;
  upsertEssayItems: (essayId: string, items: EssayItem[]) => void;
  patchEssayItem: (essayId: string, studentId: string, patch: Partial<EssayItem>) => void;
  papers: PaperCheck[];
  addPaper: (p: { classId: string; title: string; requirements: string; due: string; rubric: Criterion[]; grading: Grading }) => string;
  removePaper: (id: string) => void;
  upsertPaperItem: (paperId: string, item: PaperItem) => void;
  patchPaperItem: (paperId: string, itemId: string, patch: Partial<PaperItem>) => void;
  removePaperItem: (paperId: string, itemId: string) => void;
  files: UploadedFile[];
  addFile: (f: Omit<UploadedFile, "id" | "createdAt">) => void;
  removeFile: (id: string) => void;
  replaceAll: (s: Partial<DataSnapshot>) => void;
  docs: GeneratedDoc[];
  addDoc: (d: Omit<GeneratedDoc, "id" | "createdAt">) => GeneratedDoc;
  removeDoc: (id: string) => void;
}

const uid = () => crypto.randomUUID();

export const useData = create<DataState>()(
  persist(
    (set, get) => ({
      classes: [], subjects: [], students: [], attendance: [], grades: [], finals: [], quizzes: [], submissions: [], docs: [],
      essays: [], papers: [],
      addPaper: (p) => { const id = uid(); set((s) => ({ papers: [...s.papers, { ...p, id, items: [] }] })); return id; },
      removePaper: (id) => set((s) => ({ papers: s.papers.filter((x) => x.id !== id) })),
      upsertPaperItem: (paperId, item) => set((s) => ({
        papers: s.papers.map((p) => p.id !== paperId ? p : { ...p, items: [...p.items.filter((i) => i.id !== item.id && i.studentId !== item.studentId), item] }),
      })),
      patchPaperItem: (paperId, itemId, patch) => set((s) => ({
        papers: s.papers.map((p) => p.id !== paperId ? p : { ...p, items: p.items.map((i) => i.id === itemId ? { ...i, ...patch } : i) }),
      })),
      removePaperItem: (paperId, itemId) => set((s) => ({ papers: s.papers.map((p) => p.id !== paperId ? p : { ...p, items: p.items.filter((i) => i.id !== itemId) }) })),
      addEssay: (e) => { const id = uid(); set((s) => ({ essays: [...s.essays, { ...e, id, items: [] }] })); return id; },
      removeEssay: (id) => set((s) => ({ essays: s.essays.filter((x) => x.id !== id) })),
      upsertEssayItems: (essayId, items) => set((s) => ({
        essays: s.essays.map((e) => {
          if (e.id !== essayId) return e;
          const ids = new Set(items.map((i) => i.studentId));
          return { ...e, items: [...e.items.filter((i) => !ids.has(i.studentId)), ...items] };
        }),
      })),
      patchEssayItem: (essayId, studentId, patch) => set((s) => ({
        essays: s.essays.map((e) => e.id !== essayId ? e : { ...e, items: e.items.map((i) => i.studentId === studentId ? { ...i, ...patch } : i) }),
      })),
      files: [],
      addFile: (f) => set((s) => ({ files: [{ ...f, id: uid(), createdAt: Date.now() }, ...s.files] })),
      removeFile: (id) => set((s) => ({ files: s.files.filter((x) => x.id !== id) })),
      replaceAll: (snap) => set(snap),
      addDoc: (d) => {
        const doc: GeneratedDoc = { ...d, id: uid(), createdAt: Date.now() };
        set((s) => ({ docs: [doc, ...s.docs] }));
        return doc;
      },
      removeDoc: (id) => set((s) => ({ docs: s.docs.filter((d) => d.id !== id) })),
      addClass: (name) => {
        const ex = get().classes.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
        if (ex) return ex.id;
        const id = uid();
        set((s) => ({ classes: [...s.classes, { id, name: name.trim() }] }));
        return id;
      },
      removeClass: (id) => set((s) => ({
        classes: s.classes.filter((c) => c.id !== id),
        students: s.students.filter((x) => x.classId !== id),
        essays: s.essays.filter((e) => e.classId !== id),
        papers: s.papers.filter((p) => p.classId !== id),
      })),
      addSubject: (name) => {
        const ex = get().subjects.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
        if (ex) return ex.id;
        const id = uid();
        set((s) => ({ subjects: [...s.subjects, { id, name: name.trim() }] }));
        return id;
      },
      removeSubject: (id) => set((s) => ({ subjects: s.subjects.filter((c) => c.id !== id), grades: s.grades.filter((g) => g.subjectId !== id) })),
      addStudents: (rows) => {
        let added = 0, skipped = 0;
        const next = [...get().students];
        for (const r of rows) {
          const name = r.name.trim();
          if (!name || !r.className.trim()) { skipped++; continue; }
          const classId = get().addClass(r.className);
          if (r.nis && next.some((s) => s.nis === r.nis.trim())) { skipped++; continue; }
          next.push({ id: uid(), name, nis: r.nis.trim(), classId });
          added++;
        }
        set({ students: next });
        return { added, skipped };
      },
      removeStudent: (id) => set((s) => ({
        students: s.students.filter((x) => x.id !== id),
        attendance: s.attendance.filter((a) => a.studentId !== id),
        grades: s.grades.filter((g) => g.studentId !== id),
        finals: s.finals.filter((f) => f.studentId !== id),
        submissions: s.submissions.filter((x) => x.studentId !== id),
        papers: s.papers.map((p) => ({ ...p, items: p.items.filter((i) => i.studentId !== id) })),
      })),
      setAttendance: (studentId, date, status) => set((s) => {
        const rest = s.attendance.filter((a) => !(a.studentId === studentId && a.date === date));
        return { attendance: status ? [...rest, { studentId, date, status }] : rest };
      }),
      addAttendanceBulk: (rows) => set((s) => {
        const keys = new Set(rows.map((r) => r.studentId + r.date));
        return { attendance: [...s.attendance.filter((a) => !keys.has(a.studentId + a.date)), ...rows] };
      }),
      addGrade: (g) => set((s) => ({ grades: [...s.grades, { ...g, id: uid() }] })),
      removeGrade: (id) => set((s) => ({ grades: s.grades.filter((g) => g.id !== id) })),
      approveFinal: (f) => set((s) => ({
        finals: [...s.finals.filter((x) => !(x.studentId === f.studentId && x.subjectId === f.subjectId)), { ...f, approvedAt: Date.now() }],
      })),
      addQuiz: (q) => { const id = uid(); set((s) => ({ quizzes: [...s.quizzes, { ...q, id }] })); return id; },
      removeQuiz: (id) => set((s) => ({ quizzes: s.quizzes.filter((q) => q.id !== id), submissions: s.submissions.filter((x) => x.quizId !== id) })),
      saveSubmissions: (subs) => set((s) => {
        const keys = new Set(subs.map((x) => x.quizId + x.studentId));
        return { submissions: [...s.submissions.filter((x) => !keys.has(x.quizId + x.studentId)), ...subs] };
      }),
      approveSubmission: (quizId, studentId, score) => set((s) => ({
        submissions: s.submissions.map((x) => x.quizId === quizId && x.studentId === studentId ? { ...x, status: "approved", approvedScore: score } : x),
      })),
    }),
    { name: "ai-office-data", version: 1, skipHydration: true },
  ),
);
