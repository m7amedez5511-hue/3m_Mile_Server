import xlsx from "xlsx";
import fs from "fs";
import { createAppError } from "../utils/createAppError.js";

const MAX_FILE_SIZE_MB = 5;
const MAX_ROWS = 5000;

export const readExcel = (filePath, sheetIndex = 0) => {
    const { size } = fs.statSync(filePath);
    if (size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        throw createAppError(400, `excel_file_too_large_max_${MAX_FILE_SIZE_MB}mb`);
    }

    const workbook = xlsx.readFile(filePath, { dense: true });
    const sheetName = workbook.SheetNames[sheetIndex];
    const sheet = workbook.Sheets[sheetName];

    const rows = xlsx.utils.sheet_to_json(sheet, {
        defval: null, // prevent undefined
        raw: true,
        range: 1 // ⬅️ skip first row (description)
    });

    if (rows.length > MAX_ROWS) {
        throw createAppError(400, `excel_too_many_rows_max_${MAX_ROWS}`);
    }

    return rows;
};