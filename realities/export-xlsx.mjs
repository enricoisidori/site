import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const directory = new URL(".", import.meta.url).pathname;
const columns = ["id", "name", "entityType", "field", "period", "based", "country", "tags", "priority", "instagram", "website", "notes", "source", "status"];
const headers = ["ID", "Name", "Type", "Field", "Period", "Base", "Country", "Tags", "Priority", "Instagram", "Website", "Notes", "Source", "Status"];
const dataSource = await fs.readFile(`${directory}archive-data.js`, "utf8");
const archiveRows = Function(`return ${dataSource.replace(/^window\.REALITIES_DATA\s*=\s*/, "").replace(/;\s*$/, "")}`)();
const overrides = JSON.parse(await fs.readFile(`${directory}archive-overrides.json`, "utf8"));
const base = archiveRows.map(row => Object.fromEntries(columns.map((key, index) => [key, row[index] || ""])));
const records = base.filter(record => !overrides[record.id]?.deleted).map(record => ({ ...record, ...(overrides[record.id] || {}) }));
for (const record of Object.values(overrides)) if (record.isNew && !record.deleted) records.push(record);
records.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Realities");
sheet.showGridLines = false;
sheet.getRange("A1:N1").merge();
sheet.getRange("A1").values = [["Realities archive"]];
sheet.getRange("A2").values = [[`Updated ${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC · ${records.length} records`]];
sheet.getRange("A4:N4").values = [headers];
sheet.getRangeByIndexes(4, 0, records.length, columns.length).values = records.map(record => columns.map(key => record[key] ?? ""));
sheet.getRange("A1:N1").format = { fill: "#111111", font: { bold: true, color: "#FFFFFF", size: 16 }, horizontalAlignment: "left", verticalAlignment: "center" };
sheet.getRange("A1:N1").format.rowHeight = 28;
sheet.getRange("A2:N2").format = { font: { color: "#666666", italic: true } };
sheet.getRange("A4:N4").format = { fill: "#EDEDED", font: { bold: true, color: "#111111" }, horizontalAlignment: "left", borders: { preset: "bottom", style: "thin", color: "#BDBDBD" } };
const dataRange = sheet.getRangeByIndexes(4, 0, records.length, columns.length);
dataRange.format = { verticalAlignment: "top", wrapText: true, borders: { preset: "insideHorizontal", style: "thin", color: "#EEEEEE" } };
sheet.freezePanes.freezeRows(4);
const widths = [14, 26, 14, 18, 16, 20, 13, 28, 12, 34, 34, 46, 28, 16];
widths.forEach((width, index) => { sheet.getRangeByIndexes(0, index, records.length + 4, 1).format.columnWidth = width; });
sheet.getRangeByIndexes(4, 0, records.length, columns.length).format.rowHeight = 30;
const table = sheet.tables.add(`A4:N${records.length + 4}`, true, "RealitiesArchive");
table.style = "TableStyleMedium2";

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(`${directory}realities.xlsx`);
console.log(`Exported ${records.length} records to ${directory}realities.xlsx`);
