// Membuat database + tabel MySQL/MariaDB. Pakai: npm run db:setup
// Variabel dibaca dari .env.local: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
// (opsional MYSQL_ADMIN_USER / MYSQL_ADMIN_PASSWORD untuk membuat database bila belum ada).
import { readFileSync, existsSync } from "node:fs";
import mysql from "mysql2/promise";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const e = process.env;
const db = e.MYSQL_DATABASE || "ai_teacher_office";
const base = { host: e.MYSQL_HOST || "127.0.0.1", port: Number(e.MYSQL_PORT || 3306), multipleStatements: true };

if (e.MYSQL_ADMIN_USER) {
  const admin = await mysql.createConnection({ ...base, user: e.MYSQL_ADMIN_USER, password: e.MYSQL_ADMIN_PASSWORD || "" });
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
}
const c = await mysql.createConnection({ ...base, user: e.MYSQL_USER || "root", password: e.MYSQL_PASSWORD || "", database: db });
await c.query(readFileSync("db/schema.sql", "utf8"));
const [rows] = await c.query("SHOW TABLES");
console.log(`Database "${db}" siap: ${rows.length} tabel.`);
await c.end();
