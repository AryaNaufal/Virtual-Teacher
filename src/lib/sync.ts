import { useData, DataSnapshot } from "@/store/data";
import { Task, useTasks } from "@/store/tasks";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
interface Spec {
  table: string;
  conflict: string;
  rows: () => Row[];
  key: (r: Row) => string;
  apply: (rows: Row[]) => void; // tarik: isi store dari baris DB
  delKey: (r: Row) => Record<string, any>;
}

const D = () => useData.getState();
const pull = <K extends keyof DataSnapshot>(k: K, v: DataSnapshot[K]) => D().replaceAll({ [k]: v } as Partial<DataSnapshot>);

// Urutan = urutan dependensi FK (tulis maju, hapus mundur).
const SPECS: Spec[] = [
  { table: "classes", conflict: "id", key: (r) => r.id, delKey: (r) => ({ id: r.id }),
    rows: () => D().classes.map((c) => ({ id: c.id, name: c.name })),
    apply: (rs) => pull("classes", rs.map((r) => ({ id: r.id, name: r.name }))) },
  { table: "subjects", conflict: "id", key: (r) => r.id, delKey: (r) => ({ id: r.id }),
    rows: () => D().subjects.map((c) => ({ id: c.id, name: c.name })),
    apply: (rs) => pull("subjects", rs.map((r) => ({ id: r.id, name: r.name }))) },
  { table: "students", conflict: "id", key: (r) => r.id, delKey: (r) => ({ id: r.id }),
    rows: () => D().students.map((s) => ({ id: s.id, name: s.name, nis: s.nis, class_id: s.classId })),
    apply: (rs) => pull("students", rs.map((r) => ({ id: r.id, name: r.name, nis: r.nis, classId: r.class_id }))) },
  { table: "attendance", conflict: "student_id,date", key: (r) => r.student_id + "|" + r.date, delKey: (r) => ({ student_id: r.student_id, date: r.date }),
    rows: () => D().attendance.map((a) => ({ student_id: a.studentId, date: a.date, status: a.status })),
    apply: (rs) => pull("attendance", rs.map((r) => ({ studentId: r.student_id, date: r.date, status: r.status }))) },
  { table: "grades", conflict: "id", key: (r) => r.id, delKey: (r) => ({ id: r.id }),
    rows: () => D().grades.map((g) => ({ id: g.id, student_id: g.studentId, subject_id: g.subjectId, type: g.type, title: g.title, score: g.score })),
    apply: (rs) => pull("grades", rs.map((r) => ({ id: r.id, studentId: r.student_id, subjectId: r.subject_id, type: r.type, title: r.title, score: Number(r.score) }))) },
  { table: "final_grades", conflict: "student_id,subject_id", key: (r) => r.student_id + "|" + r.subject_id, delKey: (r) => ({ student_id: r.student_id, subject_id: r.subject_id }),
    rows: () => D().finals.map((f) => ({ student_id: f.studentId, subject_id: f.subjectId, score: f.score, approved_at: f.approvedAt })),
    apply: (rs) => pull("finals", rs.map((r) => ({ studentId: r.student_id, subjectId: r.subject_id, score: Number(r.score), approvedAt: Number(r.approved_at) }))) },
  { table: "assignments", conflict: "id", key: (r) => r.id, delKey: (r) => ({ id: r.id }),
    rows: () => D().quizzes.map((q) => ({ id: q.id, class_id: q.classId, title: q.title, answer_key: q.key })),
    apply: (rs) => pull("quizzes", rs.map((r) => ({ id: r.id, classId: r.class_id, title: r.title, key: r.answer_key }))) },
  { table: "assignment_submissions", conflict: "quiz_id,student_id", key: (r) => r.quiz_id + "|" + r.student_id, delKey: (r) => ({ quiz_id: r.quiz_id, student_id: r.student_id }),
    rows: () => D().submissions.map((s) => ({ quiz_id: s.quizId, student_id: s.studentId, answers: s.answers, correct: s.correct, score: s.score, status: s.status, approved_score: s.approvedScore ?? null })),
    apply: (rs) => pull("submissions", rs.map((r) => ({ quizId: r.quiz_id, studentId: r.student_id, answers: r.answers, correct: r.correct, score: Number(r.score), status: r.status, approvedScore: r.approved_score == null ? undefined : Number(r.approved_score) }))) },
  { table: "generated_documents", conflict: "id", key: (r) => r.id, delKey: (r) => ({ id: r.id }),
    rows: () => D().docs.map((d) => ({ id: d.id, title: d.title, kind: d.kind, agent_id: d.agentId, class_id: d.classId ?? null, subject: d.subject ?? null, created_at: d.createdAt, content: d.content, doc_table: d.table ?? null })),
    apply: (rs) => pull("docs", rs.map((r) => ({ id: r.id, title: r.title, kind: r.kind, agentId: r.agent_id, classId: r.class_id ?? undefined, subject: r.subject ?? undefined, createdAt: Number(r.created_at), content: r.content, table: r.doc_table ?? undefined }))) },
  { table: "essay_checks", conflict: "id", key: (r) => r.id, delKey: (r) => ({ id: r.id }),
    rows: () => D().essays.map((e) => ({ id: e.id, class_id: e.classId, title: e.title, question: e.question, rubric: e.rubric, items: e.items })),
    apply: (rs) => pull("essays", rs.map((r) => ({ id: r.id, classId: r.class_id, title: r.title, question: r.question, rubric: r.rubric, items: r.items ?? [] }))) },
  { table: "paper_checks", conflict: "id", key: (r) => r.id, delKey: (r) => ({ id: r.id }),
    rows: () => D().papers.map((p) => ({ id: p.id, class_id: p.classId, title: p.title, requirements: p.requirements, due: p.due, rubric: p.rubric, grading: p.grading, items: p.items })),
    apply: (rs) => pull("papers", rs.map((r) => ({ id: r.id, classId: r.class_id, title: r.title, requirements: r.requirements ?? "", due: r.due ?? "", rubric: r.rubric ?? [], grading: r.grading ?? { A: 90, B: 80, C: 70 }, items: r.items ?? [] }))) },
  { table: "document_archives", conflict: "id", key: (r) => r.id, delKey: (r) => ({ id: r.id }),
    rows: () => D().files.filter((f) => f.path).map((f) => ({ id: f.id, name: f.name, size: f.size, mime: f.mime, storage_path: f.path, created_at: f.createdAt })),
    apply: (rs) => pull("files", rs.map((r) => ({ id: r.id, name: r.name, size: Number(r.size), mime: r.mime, path: r.storage_path, createdAt: Number(r.created_at) }))) },
];

const taskRows = (): Row[] => useTasks.getState().tasks.map((t) => ({
  code: t.id, title: t.title, agent_id: t.agentId, created_at: t.createdAt, deadline: t.deadline, priority: t.priority,
  status: t.status, result: t.result ?? null, group_id: t.groupId ?? null, attachment_name: t.attachment?.name ?? null,
}));
const logRows = (uid: string): Row[] => useTasks.getState().tasks.flatMap((t) => t.logs.map((l) => ({ id: `${uid}|${t.id}|${l.at}|${l.text.length}|${l.text.slice(0, 12)}`, task_code: t.id, at: l.at, text: l.text })));

/** Serialisasi stabil (urutan kunci diabaikan) untuk membandingkan baris lokal vs DB. */
const norm = (r: Row | null) => (r ? JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k] ?? null])) : "null");
const hashOf = (rows: Row[]) => rows.map(norm).join("\n");

export type SyncState = "off" | "loading" | "synced" | "saving" | "error";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

/** Sinkron dua arah dengan MySQL lewat /api/db/*: satu permintaan untuk memuat, satu transaksi untuk menyimpan. */
export function startSync(uid: string, onState: (s: SyncState, msg?: string) => void) {
  const known = new Map<string, Set<string>>(); // table -> key baris yang ada di DB
  const lastHash = new Map<string, string>();
  const keyObj = new Map<string, Map<string, Row>>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let ready = false;
  let busy = false, again = false;

  const remember = (table: string, rows: Row[], spec?: Spec) => {
    known.set(table, new Set(rows.map((r) => (spec ? spec.key(r) : r.code ?? r.id))));
    keyObj.set(table, new Map(rows.map((r) => [spec ? spec.key(r) : r.code ?? r.id, r])));
  };

  async function initialLoad() {
    onState("loading");
    const { tables: remote } = await api<{ tables: Record<string, Row[]> }>("/api/db/load");
    const t = remote.ai_tasks ?? [], l = remote.ai_task_logs ?? [];
    const remoteEmpty = SPECS.every((s) => (remote[s.table] ?? []).length === 0) && t.length === 0;
    const localHas = SPECS.some((s) => s.rows().length > 0) || useTasks.getState().tasks.length > 0;

    if (remoteEmpty && localHas) {
      // Akun baru: unggah data lokal yang ada. known tetap kosong -> flush akan menyimpan semuanya.
      SPECS.forEach((s) => remember(s.table, []));
      remember("ai_tasks", []); remember("ai_task_logs", []);
    } else {
      SPECS.forEach((s) => { const rows = remote[s.table] ?? []; s.apply(rows); remember(s.table, rows, s); });
      const logsBy = new Map<string, { at: number; text: string }[]>();
      l.forEach((r) => { const a = logsBy.get(r.task_code) ?? []; a.push({ at: Number(r.at), text: r.text }); logsBy.set(r.task_code, a); });
      const tasks: Task[] = t.map((r) => ({
        id: r.code, title: r.title, agentId: r.agent_id, createdAt: Number(r.created_at), deadline: Number(r.deadline), priority: r.priority,
        status: r.status, result: r.result ?? undefined, groupId: r.group_id ?? undefined,
        logs: (logsBy.get(r.code) ?? []).sort((a, b) => b.at - a.at),
      }));
      const interrupted = tasks.map((x) => (x.status === "pending" || x.status === "in_progress"
        ? { ...x, status: "failed" as const, logs: [{ at: Date.now(), text: "Terinterupsi saat aplikasi ditutup" }, ...x.logs] } : x));
      const counter = Math.max(0, ...tasks.map((x) => parseInt(x.id.replace(/\D/g, "")) || 0));
      useTasks.getState().replaceTasks(interrupted, counter);
      remember("ai_tasks", t); remember("ai_task_logs", l);
    }
    ready = true; // hash dasar dikosongkan agar perubahan pertama (termasuk unggah awal) terkirim
  }

  async function flush() {
    if (!ready || stopped) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      onState("saving");
      const plan: { table: string; rows: Row[]; keyOf: (r: Row) => string; delKey: (r: Row) => Record<string, any> }[] = [
        ...SPECS.map((s) => ({ table: s.table, rows: s.rows(), keyOf: s.key, delKey: s.delKey })),
        { table: "ai_tasks", rows: taskRows(), keyOf: (r: Row) => r.code, delKey: (r: Row) => ({ code: r.code }) },
        { table: "ai_task_logs", rows: logRows(uid), keyOf: (r: Row) => r.id, delKey: (r: Row) => ({ id: r.id }) },
      ];
      const changes: { table: string; upserts: Row[]; deletes: Record<string, any>[] }[] = [];
      const next: { table: string; cur: Map<string, Row>; hash: string }[] = [];
      for (const p of plan) {
        const hash = hashOf(p.rows);
        const cur = new Map(p.rows.map((r) => [p.keyOf(r), r]));
        const existing = keyObj.get(p.table) ?? new Map<string, Row>();
        const keys = new Set(cur.keys());
        const gone = [...(known.get(p.table) ?? [])].filter((k) => !keys.has(k));
        const upserts = lastHash.get(p.table) === hash ? [] : p.rows.filter((r) => { const e = existing.get(p.keyOf(r)); return !e || norm(e) !== norm(r); });
        if (upserts.length || gone.length) changes.push({ table: p.table, upserts, deletes: gone.map((k) => p.delKey(existing.get(k)!)) });
        next.push({ table: p.table, cur, hash });
      }
      if (changes.length) await api("/api/db/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ changes }) });
      for (const n of next) { known.set(n.table, new Set(n.cur.keys())); keyObj.set(n.table, n.cur); lastHash.set(n.table, n.hash); }
      onState("synced");
    } catch (e) {
      onState("error", (e as Error).message);
    } finally {
      busy = false;
      if (again && !stopped) { again = false; schedule(); }
    }
  }

  const schedule = () => { if (!ready) return; clearTimeout(timer); timer = setTimeout(flush, 800); };
  const unsub1 = useData.subscribe(schedule);
  const unsub2 = useTasks.subscribe(schedule);

  initialLoad().then(() => { if (!stopped) flush(); }).catch((e) => onState("error", (e as Error).message));

  return () => { stopped = true; clearTimeout(timer); unsub1(); unsub2(); };
}
