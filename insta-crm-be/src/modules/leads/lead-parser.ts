import { fork } from "node:child_process";
import { join } from "node:path";
import { BadRequestException } from "@nestjs/common";
import * as XLSX from "xlsx";
import type { RawLead } from "./lead-classifier";

/** Extract PDF text in an isolated child process (see pdf-worker.ts). */
function extractPdfText(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = fork(join(__dirname, "pdf-worker.js"), [], { silent: true });
    const timer = setTimeout(() => { child.kill(); reject(new Error("timeout")); }, 30_000);
    child.once("message", (msg: { text?: string; error?: string }) => {
      clearTimeout(timer);
      if (msg.error !== undefined) reject(new Error(msg.error));
      else resolve(msg.text ?? "");
    });
    child.once("error", (e) => { clearTimeout(timer); reject(e); });
    child.once("exit", () => clearTimeout(timer));
    child.send(buffer.toString("base64"));
  });
}

const ALIASES: Record<keyof RawLead, string[]> = {
  company: ["company", "company name", "organization", "organisation", "business", "business name", "firm", "account", "client", "customer"],
  contactName: ["name", "contact", "contact name", "contact person", "person", "lead name", "full name", "lead"],
  title: ["title", "designation", "role", "position", "job title"],
  email: ["email", "e-mail", "email id", "email address", "mail"],
  phone: ["phone", "mobile", "contact number", "phone number", "mobile number", "tel", "telephone", "whatsapp", "contact no"],
  industry: ["industry", "sector", "category", "vertical", "business type"],
  employees: ["employees", "employee count", "company size", "size", "headcount", "no of employees", "team size"],
  value: ["value", "deal value", "budget", "amount", "revenue", "potential", "estimated value", "order value", "opportunity value"],
  source: ["source", "lead source", "channel", "origin", "referred by"],
  status: ["status", "stage", "lead status", "disposition", "rating"],
  notes: ["notes", "remarks", "comments", "description", "requirement", "interest", "message", "feedback"],
  timeline: ["timeline", "purchase timeline", "expected close", "expected closure", "closing date", "urgency", "decision timeline"],
  lastContact: ["last contact", "last contacted", "last contact date", "last activity", "last interaction", "date", "last follow up", "last followup"],
  interactions: ["interactions", "touchpoints", "calls", "meetings", "no of calls", "engagement"],
};

function norm(value: string) {
  return value.toLowerCase().replace(/[_\-.]/g, " ").replace(/\s+/g, " ").trim();
}

function fieldFor(header: string): keyof RawLead | null {
  const h = norm(header);
  if (!h) return null;
  for (const [field, names] of Object.entries(ALIASES) as [keyof RawLead, string[]][]) {
    if (names.includes(h)) return field;
  }
  for (const [field, names] of Object.entries(ALIASES) as [keyof RawLead, string[]][]) {
    if (names.some((n) => h.includes(n) || (h.length > 3 && n.includes(h)))) return field;
  }
  return null;
}

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function rowsToLeads(rows: unknown[][]): RawLead[] {
  const headerIndex = rows.findIndex(
    (row) => row.filter((c) => fieldFor(cell(c))).length >= 2,
  );
  if (headerIndex === -1) {
    throw new BadRequestException(
      "Could not find a header row. Include columns such as Company, Name, Email, Phone, Status or Notes.",
    );
  }
  const mapping = rows[headerIndex].map((c) => fieldFor(cell(c)));
  const leads: RawLead[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const lead: RawLead = {};
    row.forEach((value, i) => {
      const field = mapping[i];
      const text = cell(value);
      if (field && text) lead[field] = lead[field] ? `${lead[field]}; ${text}` : text;
    });
    if (Object.keys(lead).length >= 2 || lead.company || lead.email || lead.phone) leads.push(lead);
  }
  return leads;
}

function parseSheet(buffer: Buffer): RawLead[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const all: RawLead[] = [];
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
      header: 1,
      blankrows: false,
      raw: false,
      dateNF: "yyyy-mm-dd",
    });
    try {
      all.push(...rowsToLeads(rows));
    } catch {
      // skip sheets without lead columns
    }
  }
  if (!all.length) {
    throw new BadRequestException(
      "No leads found. Include a header row with columns such as Company, Name, Email, Phone, Status or Notes.",
    );
  }
  return all;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3,5}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,5}/;

async function parsePdf(buffer: Buffer): Promise<RawLead[]> {
  let text: string;
  try {
    text = await extractPdfText(buffer);
  } catch {
    throw new BadRequestException("The PDF could not be read. Make sure it is not encrypted or corrupted.");
  }
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) {
    throw new BadRequestException("The PDF has no extractable text (scanned images are not supported).");
  }

  // Table-style PDF: a header line with known column names, split by tabs / 2+ spaces / pipes.
  const splitter = /\t+|\s{2,}|\s*\|\s*/;
  const headerAt = lines.findIndex((l) => l.split(splitter).filter((p) => fieldFor(p)).length >= 2);
  if (headerAt !== -1) {
    const rows = lines.slice(headerAt).map((l) => l.split(splitter));
    const leads = rowsToLeads(rows);
    if (leads.length) return leads;
  }

  // Free-form PDF: group lines into records. A record starts at a line containing an email/phone
  // when the previous record already has one; labelled "Key: value" lines are mapped by alias.
  const leads: RawLead[] = [];
  let current: RawLead = {};
  const flush = () => {
    if (Object.keys(current).length >= 2) leads.push(current);
    current = {};
  };
  for (const line of lines) {
    const labelled = line.match(/^([A-Za-z][A-Za-z .\-_/]{1,30})\s*[:=-]\s*(.+)$/);
    if (labelled) {
      const field = fieldFor(labelled[1]);
      if (field) {
        if ((field === "company" || field === "contactName") && current[field]) flush();
        current[field] = current[field] ? `${current[field]}; ${labelled[2]}` : labelled[2];
        continue;
      }
    }
    const email = line.match(EMAIL_RE)?.[0];
    const phone = line.replace(EMAIL_RE, " ").match(PHONE_RE)?.[0];
    if (email || phone) {
      if ((email && current.email) || (phone && current.phone)) flush();
      if (email) current.email = email;
      if (phone) current.phone = phone.trim();
      const rest = line.replace(EMAIL_RE, "").replace(PHONE_RE, "").replace(/[|,;:]+/g, " ").trim();
      if (rest.length > 2 && !current.company) current.company = rest;
    } else if (!current.notes && line.length > 3) {
      current.notes = line;
    }
  }
  flush();
  if (!leads.length) {
    throw new BadRequestException(
      "No leads found in the PDF. Use a table with headers (Company, Name, Email, Phone ...) or 'Field: value' records.",
    );
  }
  return leads;
}

export async function parseLeadFile(file: { originalname: string; buffer: Buffer }): Promise<{
  type: "excel" | "csv" | "pdf";
  leads: RawLead[];
}> {
  const name = file.originalname.toLowerCase();
  if (name.endsWith(".pdf")) return { type: "pdf", leads: await parsePdf(file.buffer) };
  if (name.endsWith(".csv")) return { type: "csv", leads: parseSheet(file.buffer) };
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return { type: "excel", leads: parseSheet(file.buffer) };
  throw new BadRequestException("Unsupported file type. Upload an Excel (.xlsx, .xls), CSV or PDF file.");
}
