// POST /functions/v1/creer-utilisateur
// Réservé aux admins : crée un compte citoyen, employé ou admin.
// Les citoyens peuvent aussi s'inscrire seuls via Supabase Auth (signUp).
//
// En-tête : Authorization: Bearer <access_token d'un admin>
// Corps   : { "email", "password", "role", "poste"?, "prenom"?, "nom"? }
//           "poste" est obligatoire si role = "employe", interdit sinon.

import { createClient } from "npm:@supabase/supabase-js@2.119.0";

const ROLES = ["citoyen", "employe", "admin"] as const;
type Role = (typeof ROLES)[number];

// Doit rester aligné avec le type SQL public.poste_employe.
const POSTES = ["superviseur", "commis"] as const;
type Poste = (typeof POSTES)[number];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, corps: unknown): Response {
  return new Response(JSON.stringify(corps), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json(405, { erreur: "Méthode non permise" });

  // 1. Qui appelle ?
  const jeton = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!jeton) return json(401, { erreur: "Jeton manquant" });

  const { data: appelant, error: erreurJeton } = await admin.auth.getUser(jeton);
  if (erreurJeton || !appelant.user) return json(401, { erreur: "Jeton invalide" });

  const { data: profilAppelant } = await admin
    .from("profils")
    .select("role")
    .eq("id", appelant.user.id)
    .single();
  if (profilAppelant?.role !== "admin") {
    return json(403, { erreur: "Réservé aux administrateurs" });
  }

  // 2. Validation du corps
  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return json(400, { erreur: "Corps JSON invalide" });
  }
  const { email, password, role, poste, prenom, nom } = corps;

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json(400, { erreur: "email invalide" });
  }
  if (typeof password !== "string" || password.length < 8) {
    return json(400, { erreur: "password : 8 caractères minimum" });
  }
  if (!ROLES.includes(role as Role)) {
    return json(400, { erreur: `role doit être : ${ROLES.join(", ")}` });
  }
  if (role === "employe" && !POSTES.includes(poste as Poste)) {
    return json(400, { erreur: `poste obligatoire pour un employé : ${POSTES.join(", ")}` });
  }
  if (role !== "employe" && poste !== undefined) {
    return json(400, { erreur: "poste réservé au rôle employe" });
  }
  for (const [champ, valeur] of [["prenom", prenom], ["nom", nom]] as const) {
    if (valeur !== undefined && typeof valeur !== "string") {
      return json(400, { erreur: `${champ} doit être un texte` });
    }
  }

  // 3. Création. Le rôle et le poste passent par app_metadata ; le trigger
  //    creer_profil s'en sert pour créer le profil.
  const { data: cree, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: role === "employe" ? { role, poste } : { role },
    user_metadata: { prenom, nom },
  });
  if (error) {
    const dejaPris = error.status === 422 || /already/i.test(error.message);
    return json(dejaPris ? 409 : 400, { erreur: error.message });
  }

  const { data: profil, error: erreurProfil } = await admin
    .from("profils")
    .select("*")
    .eq("id", cree.user.id)
    .single();
  if (erreurProfil) return json(500, { erreur: erreurProfil.message });

  return json(201, { id: cree.user.id, email: cree.user.email, ...profil });
});
