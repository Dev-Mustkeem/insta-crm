// Runs in a child process (see lead-parser.ts). pdf-parse bundles an old pdf.js that misbehaves when
// xlsx is loaded in the same process, and isolating it keeps malformed PDFs from affecting the API.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (b: Buffer) => Promise<{ text: string }>;

process.once("message", async (base64: string) => {
  try {
    const { text } = await pdfParse(Buffer.from(base64, "base64"));
    process.send?.({ text });
  } catch (error) {
    process.send?.({ error: error instanceof Error ? error.message : "parse failed" });
  } finally {
    process.exit(0);
  }
});
