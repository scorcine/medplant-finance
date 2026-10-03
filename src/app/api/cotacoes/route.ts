type Quote = {
  price: number;
  changePct: number;
  currency: string;
  time: string;
  name: string;
};

const SYMBOL = /^[A-Z0-9.\-=^]{1,20}$/;

async function fetchQuote(symbol: string): Promise<Quote | null> {
  const response = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
    { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as {
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          chartPreviousClose?: number;
          previousClose?: number;
          currency?: string;
          regularMarketTime?: number;
          longName?: string;
          shortName?: string;
        };
      }>;
    };
  };
  const meta = data.chart?.result?.[0]?.meta;
  if (!meta?.regularMarketPrice) return null;
  const previous = meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice;
  return {
    price: meta.regularMarketPrice,
    changePct: previous ? (meta.regularMarketPrice / previous - 1) * 100 : 0,
    currency: meta.currency ?? "BRL",
    time: new Date((meta.regularMarketTime ?? Date.now() / 1000) * 1000).toISOString(),
    name: meta.longName ?? meta.shortName ?? symbol,
  };
}

export async function GET(request: Request) {
  const symbols = Array.from(
    new Set(
      (new URL(request.url).searchParams.get("symbols") ?? "")
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter((item) => SYMBOL.test(item)),
    ),
  ).slice(0, 60);

  if (symbols.length === 0) {
    return Response.json({ error: "Informe os códigos dos ativos." }, { status: 400 });
  }

  const results = await Promise.all(symbols.map(async (symbol) => [symbol, await fetchQuote(symbol)] as const));
  const rates = new Map<string, number>([["BRL", 1]]);
  for (const [, quote] of results) {
    if (quote && !rates.has(quote.currency)) {
      const rate = await fetchQuote(`${quote.currency}BRL=X`);
      if (rate) rates.set(quote.currency, rate.price);
    }
  }

  const quotes: Record<string, Quote & { priceBRL: number }> = {};
  const missing: string[] = [];
  for (const [symbol, quote] of results) {
    const rate = quote ? rates.get(quote.currency) : undefined;
    if (!quote || !rate) {
      missing.push(symbol);
      continue;
    }
    quotes[symbol] = { ...quote, priceBRL: quote.price * rate };
  }

  return Response.json({ quotes, missing });
}
