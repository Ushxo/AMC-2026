// Relais vers le service d'analyse des photos.
// L'app envoie la photo ici ; la clé du service reste côté serveur et n'est jamais dans l'app.
//
// POST /functions/v1/juger-photo   corps multipart, champ « photo »  → résultat de l'analyse
// GET  /functions/v1/juger-photo   → réveille le service et dit s'il répond
//
// Secrets à régler (supabase secrets set) :
//   ML_URL      adresse du service d'analyse, sans barre finale
//   ML_CLE_API  clé attendue par le service dans l'en-tête X-Cle-API

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Une photo de téléphone compressée tient largement dans cette limite.
const TAILLE_MAX = 8 * 1024 * 1024;
const DELAI_MS = 25_000;

function json(status: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function appelantConnu(req: Request): boolean {
  const attendue = Deno.env.get("SUPABASE_ANON_KEY");
  if (!attendue) return true;
  return req.headers.get("apikey") === attendue;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!appelantConnu(req)) return json(401, { detail: "Appel non autorisé." });

  const adresse = Deno.env.get("ML_URL")?.replace(/\/$/, "");
  const cle = Deno.env.get("ML_CLE_API");
  if (!adresse || !cle) return json(503, { detail: "Analyse de la photo non configurée." });

  const arret = new AbortController();
  const minuterie = setTimeout(() => arret.abort(), DELAI_MS);
  try {
    if (req.method === "GET") {
      const r = await fetch(`${adresse}/sante`, { signal: arret.signal });
      return json(r.ok ? 200 : 502, { ok: r.ok });
    }
    if (req.method !== "POST") return json(405, { detail: "Méthode non permise." });

    const type = req.headers.get("content-type") ?? "";
    if (!type.toLowerCase().startsWith("multipart/form-data")) {
      return json(400, { detail: "La photo doit être envoyée dans un formulaire." });
    }
    const annoncee = Number(req.headers.get("content-length") ?? "0");
    if (annoncee > TAILLE_MAX) return json(413, { detail: "Photo trop lourde." });

    const corps = await req.arrayBuffer();
    if (corps.byteLength === 0) return json(400, { detail: "Aucune photo reçue." });
    if (corps.byteLength > TAILLE_MAX) return json(413, { detail: "Photo trop lourde." });

    const r = await fetch(`${adresse}/juger`, {
      method: "POST",
      headers: { "Content-Type": type, "X-Cle-API": cle },
      body: corps,
      signal: arret.signal,
    });
    const texte = await r.text();
    // Un refus de clé par le service est un problème de réglage du serveur, pas de l'app.
    if (r.status === 401) return json(503, { detail: "Analyse de la photo non configurée." });
    return new Response(texte, {
      status: r.status,
      headers: { ...CORS, "Content-Type": r.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return json(504, { detail: "Le service d'analyse ne répond pas." });
  } finally {
    clearTimeout(minuterie);
  }
});
