import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const directory = new URL(".", import.meta.url).pathname;
const archiveColumns = ["id", "name", "entityType", "field", "period", "based", "country", "tags", "priority", "instagram", "website", "notes", "source", "status"];
const columns = ["name", "starred", "entityType", "field", "based", "tags", "instagram", "website", "hidden"];
const headers = ["name", "favourite", "type", "field", "based", "tags", "instagram", "website", "hide"];
const dataSource = await fs.readFile(`${directory}archive-data.js`, "utf8");
const archiveRows = Function(`return ${dataSource.replace(/^window\.REALITIES_DATA\s*=\s*/, "").replace(/;\s*$/, "")}`)();
const overrides = JSON.parse(await fs.readFile(`${directory}archive-overrides.json`, "utf8"));
const base = archiveRows.map(row => Object.fromEntries(archiveColumns.map((key, index) => [key, row[index] || ""])));
const records = base.filter(record => !overrides[record.id]?.deleted).map(record => ({ ...record, ...(overrides[record.id] || {}) }));
for (const record of Object.values(overrides)) if (record.isNew && !record.deleted) records.push(record);
records.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Realities");
sheet.getRange("A1:I1").values = [headers];
sheet.getRangeByIndexes(1, 0, records.length, columns.length).values = records.map(record => columns.map(key => key === "starred" || key === "hidden" ? Boolean(record[key]) : record[key] ?? ""));
sheet.getRange("A1:I1").format = { font: { bold: true } };
sheet.freezePanes.freezeRows(1);
const widths = [26, 12, 14, 18, 20, 28, 34, 34, 12];
widths.forEach((width, index) => { sheet.getRangeByIndexes(0, index, records.length + 1, 1).format.columnWidth = width; });

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${directory}realities.xlsx`);
console.log(`Exported ${records.length} records to ${directory}realities.xlsx`);
