export type FaturaItem = {
  key: string;
  date: string;
  description: string;
  amount: number;
};

export type FaturaResult = {
  items: FaturaItem[];
  ignored: number;
};

function parseAmount(raw: string) {
  let text = raw.trim().replace(/\s/g, "").replace(/R\$/gi, "");
  const negative = /^\(.*\)$/.test(text) || text.startsWith("-") || text.endsWith("-");
  text = text.replace(/[()\-+]/g, "");
  if (text.includes(",") && text.lastIndexOf(",") > text.lastIndexOf(".")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return Number.NaN;
  return negative ? -value : value;
}

function parseDate(raw: string) {
  const text = raw.trim();
  let match = text.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (match) {
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  }
  return "";
}

function keyOf(date: string, description: string, amount: number, extra = "") {
  return `${date}|${description.toLowerCase()}|${amount.toFixed(2)}|${extra}`;
}

function finish(raw: Array<{ date: string; description: string; amount: number; id?: string }>): FaturaResult {
  const valid = raw.filter((item) => item.date && item.description && Number.isFinite(item.amount) && item.amount !== 0);
  const positives = valid.filter((item) => item.amount > 0).length;
  const purchasesArePositive = positives >= valid.length - positives;
  const items: FaturaItem[] = [];
  const seen = new Map<string, number>();
  let ignored = 0;
  for (const item of valid) {
    const isPurchase = purchasesArePositive ? item.amount > 0 : item.amount < 0;
    const description = item.description.replace(/\s+/g, " ").trim();
    if (!isPurchase || /pagamento (recebido|efetuado|de fatura)/i.test(description)) {
      ignored += 1;
      continue;
    }
    const amount = Math.abs(item.amount);
    const base = keyOf(item.date, description, amount, item.id ?? "");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    items.push({ key: count ? `${base}#${count}` : base, date: item.date, description, amount });
  }
  return { items, ignored: ignored + (raw.length - valid.length) };
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}>([^<\\r\\n]*)`, "i"));
  return match ? match[1].trim() : "";
}

export function parseOfx(text: string): FaturaResult {
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  return finish(
    blocks.map((block) => ({
      date: parseDate(tag(block, "DTPOSTED")),
      description: tag(block, "MEMO") || tag(block, "NAME"),
      amount: parseAmount(tag(block, "TRNAMT")),
      id: tag(block, "FITID"),
    })),
  );
}

function splitLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function parseCsv(text: string): FaturaResult {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return { items: [], ignored: 0 };
  const delimiter = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const header = splitLine(lines[0], delimiter).map(normalize);
  const find = (patterns: RegExp[]) => header.findIndex((cell) => patterns.some((pattern) => pattern.test(cell)));
  let dateCol = find([/^data/, /^date/, /dt/]);
  let descCol = find([/descri/, /title/, /estabelecimento/, /lancamento/, /historico/, /^nome/]);
  let amountCol = find([/valor/, /amount/, /^value/]);
  let start = 1;
  if (dateCol < 0 || descCol < 0 || amountCol < 0) {
    dateCol = 0;
    descCol = 1;
    amountCol = 2;
    start = parseDate(splitLine(lines[0], delimiter)[0] ?? "") ? 0 : 1;
  }
  return finish(
    lines.slice(start).map((line) => {
      const cells = splitLine(line, delimiter);
      return {
        date: parseDate(cells[dateCol] ?? ""),
        description: cells[descCol] ?? "",
        amount: parseAmount(cells[amountCol] ?? ""),
      };
    }),
  );
}

export function parseFatura(fileName: string, text: string): FaturaResult {
  if (/<OFX>|<STMTTRN>/i.test(text) || /\.(ofx|qfx)$/i.test(fileName)) return parseOfx(text);
  return parseCsv(text);
}
