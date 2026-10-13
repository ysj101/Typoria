import { openDatabase } from "./database";

export { ImportError, openDatabase, validateExportData, type TyporiaDatabase } from "./database";

/** アプリ全体で共有するデータベース（§12） */
export const db = openDatabase();
