/** Dengan `NEXT_PUBLIC_DB_ENABLED=1` aplikasi memakai login + database MySQL; tanpa itu "mode lokal" (tanpa login, data di browser). */
export const dbEnabled = process.env.NEXT_PUBLIC_DB_ENABLED === "1";
