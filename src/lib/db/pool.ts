import mysql from "mysql2/promise";

const g = globalThis as unknown as { __atoPool?: mysql.Pool };

/** Satu pool koneksi MySQL/MariaDB per proses (bertahan saat hot-reload). */
export function pool(): mysql.Pool {
  if (!g.__atoPool) {
    const e = process.env;
    g.__atoPool = mysql.createPool({
      host: e.MYSQL_HOST || "127.0.0.1", port: Number(e.MYSQL_PORT || 3306),
      user: e.MYSQL_USER || "root", password: e.MYSQL_PASSWORD || "", database: e.MYSQL_DATABASE || "ai_teacher_office",
      waitForConnections: true, connectionLimit: 8, dateStrings: true, charset: "utf8mb4",
    });
  }
  return g.__atoPool;
}
