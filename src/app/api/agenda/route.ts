const ALLOWED_HOSTS = new Set(["calendar.google.com", "calendar.googleusercontent.com"]);

export async function POST(request: Request) {
  let urlValue = "";
  try {
    const body = (await request.json()) as { url?: string };
    urlValue = body.url ?? "";
  } catch {
    return Response.json({ error: "Informe o link da agenda." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(urlValue.trim());
  } catch {
    return Response.json({ error: "O link da agenda é inválido." }, { status: 400 });
  }

  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    return Response.json(
      { error: "Use o endereço secreto iCal do Google Agenda." },
      { status: 400 },
    );
  }

  const response = await fetch(url.toString(), { cache: "no-store", redirect: "follow" });
  if (!response.ok) {
    return Response.json({ error: "Não foi possível ler essa agenda." }, { status: 502 });
  }

  const finalUrl = new URL(response.url);
  if (!ALLOWED_HOSTS.has(finalUrl.hostname)) {
    return Response.json({ error: "O link não aponta para o Google Agenda." }, { status: 400 });
  }

  const ics = await response.text();
  if (!ics.includes("BEGIN:VCALENDAR") || ics.length > 2_000_000) {
    return Response.json({ error: "A resposta não é uma agenda válida." }, { status: 422 });
  }

  return Response.json({ ics });
}
