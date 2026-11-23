/** Daftar tabel data yang boleh dibaca/ditulis lewat /api/db/*. Urutan = urutan dependensi FK (tulis maju, hapus mundur). */
export interface TableSpec { name: string; cols: string[]; pk: string[]; json?: string[]; num?: string[] }

export const TABLES: TableSpec[] = [
  { name: "classes", cols: ["id", "name"], pk: ["id"] },
  { name: "subjects", cols: ["id", "name"], pk: ["id"] },
  { name: "students", cols: ["id", "class_id", "name", "nis"], pk: ["id"] },
  { name: "attendance", cols: ["student_id", "date", "status"], pk: ["student_id", "date"] },
  { name: "grades", cols: ["id", "student_id", "subject_id", "type", "title", "score"], pk: ["id"], num: ["score"] },
  { name: "final_grades", cols: ["student_id", "subject_id", "score", "approved_at"], pk: ["student_id", "subject_id"], num: ["score", "approved_at"] },
  { name: "assignments", cols: ["id", "class_id", "title", "answer_key"], pk: ["id"], json: ["answer_key"] },
  { name: "assignment_submissions", cols: ["quiz_id", "student_id", "answers", "correct", "score", "status", "approved_score"], pk: ["quiz_id", "student_id"], json: ["answers"], num: ["score", "approved_score"] },
  { name: "generated_documents", cols: ["id", "title", "kind", "agent_id", "class_id", "subject", "created_at", "content", "doc_table"], pk: ["id"], json: ["doc_table"], num: ["created_at"] },
  { name: "essay_checks", cols: ["id", "class_id", "title", "question", "rubric", "items"], pk: ["id"], json: ["items"] },
  { name: "paper_checks", cols: ["id", "class_id", "title", "requirements", "due", "rubric", "grading", "items"], pk: ["id"], json: ["rubric", "grading", "items"] },
  { name: "document_archives", cols: ["id", "name", "size", "mime", "storage_path", "created_at"], pk: ["id"], num: ["size", "created_at"] },
  { name: "ai_tasks", cols: ["code", "title", "agent_id", "created_at", "deadline", "priority", "status", "result", "group_id", "attachment_name"], pk: ["code"], num: ["created_at", "deadline"] },
  { name: "ai_task_logs", cols: ["id", "task_code", "at", "text"], pk: ["id"], num: ["at"] },
];
export const TABLE_BY_NAME = Object.fromEntries(TABLES.map((t) => [t.name, t]));
