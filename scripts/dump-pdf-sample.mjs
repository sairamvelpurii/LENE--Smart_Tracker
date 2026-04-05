import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      String.raw`C:\Users\saira\AppData\Roaming\Cursor\User\workspaceStorage\18dd0ba83afba0b848507e10290ba33c\pdfs\de89046b-7c27-4ddf-897a-b1854327b21a\mohan canara.pdf`,
      String.raw`C:\Users\saira\AppData\Roaming\Cursor\User\workspaceStorage\18dd0ba83afba0b848507e10290ba33c\pdfs\e23ff99f-e9b3-4632-8ff2-ada4029d8027\rupesh anna statement.pdf`,
      String.raw`C:\Users\saira\AppData\Roaming\Cursor\User\workspaceStorage\18dd0ba83afba0b848507e10290ba33c\pdfs\7a6ebf6b-ece0-451b-bf8a-77723affffe2\slice_statement_01Feb26_28Feb26 (1) (1).pdf`,
    ];

for (const fp of files) {
  console.log("\n==========", path.basename(fp), "==========\n");
  if (!fs.existsSync(fp)) {
    console.log("MISSING:", fp);
    continue;
  }
  const data = new Uint8Array(fs.readFileSync(fp));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  let out = "";
  const maxPages = Math.min(3, doc.numPages);
  for (let p = 1; p <= maxPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    out +=
      tc.items.map((i) => i.str).join(" | ") + "\n---PAGE " + p + "---\n";
  }
  console.log(out.slice(0, 12000));
}
