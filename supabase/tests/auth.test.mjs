// Tests d'API des logins et de la création de comptes, sans UI.
// Ils appellent directement le projet Supabase (Auth, REST, Edge Function).
//
// Lancer depuis la racine du repo :
//   node --env-file=app/.env --env-file=supabase/tests/.env --test supabase/tests/
//
// app/.env            : EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
// supabase/tests/.env : ADMIN_EMAIL, ADMIN_PASSWORD (le premier admin)
//
// Chaque lancement crée de nouveaux comptes (emails uniques @example.com) dans le projet.

import { test, before } from "node:test";
import assert from "node:assert/strict";

const URL_ = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

for (const [nom, val] of Object.entries({
  EXPO_PUBLIC_SUPABASE_URL: URL_,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: ANON,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
})) {
  if (!val) throw new Error(`Variable d'environnement manquante : ${nom}`);
}

const suffixe = Date.now();
const email = (qui) => `${qui}.${suffixe}@example.com`;
const MDP = "MotDePasse123";

async function appel(chemin, { methode = "GET", jeton, corps, entetes = {} } = {}) {
  const rep = await fetch(URL_ + chemin, {
    method: methode,
    headers: {
      apikey: ANON,
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
      "Content-Type": "application/json",
      ...entetes,
    },
    body: corps === undefined ? undefined : JSON.stringify(corps),
  });
  const texte = await rep.text();
  return { status: rep.status, data: texte ? JSON.parse(texte) : null };
}

const login = (mail, mdp) =>
  appel("/auth/v1/token?grant_type=password", {
    methode: "POST",
    corps: { email: mail, password: mdp },
  });

const monProfil = (jeton) => appel("/rest/v1/rpc/mon_profil", { methode: "POST", jeton, corps: {} });

// Fonction des autres tables : vrai si l'utilisateur a une ligne dans employes.
const estEmploye = async (jeton) =>
  (await appel("/rest/v1/rpc/est_employe", { methode: "POST", jeton, corps: {} })).data;

const creer = (jeton, corps) =>
  appel("/functions/v1/creer-utilisateur", { methode: "POST", jeton, corps });

let jetonAdmin;

before(async () => {
  const r = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  assert.equal(r.status, 200, `login admin impossible : ${JSON.stringify(r.data)}`);
  jetonAdmin = r.data.access_token;
  const p = await monProfil(jetonAdmin);
  assert.equal(p.data.role, "admin", "le compte ADMIN_EMAIL n'a pas le rôle admin (voir premier-admin.sql)");
  assert.equal(await estEmploye(jetonAdmin), true, "l'admin n'est pas dans employes (voir premier-admin.sql)");
});

test("citoyen : inscription publique puis login", async () => {
  const r = await appel("/auth/v1/signup", {
    methode: "POST",
    corps: { email: email("citoyen"), password: MDP, data: { prenom: "Cléa", nom: "Citoyenne" } },
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.ok(r.data.access_token, "pas de session : désactiver « Confirm email » dans Auth > Providers > Email");

  const l = await login(email("citoyen"), MDP);
  assert.equal(l.status, 200);
  const p = await monProfil(l.data.access_token);
  assert.equal(p.data.role, "citoyen");
  assert.equal(p.data.prenom, "Cléa");
  assert.equal(await estEmploye(l.data.access_token), false);
});

test("citoyen : impossible de s'inscrire en se donnant le rôle admin", async () => {
  const r = await appel("/auth/v1/signup", {
    methode: "POST",
    corps: { email: email("tricheur"), password: MDP, data: { role: "admin" } },
  });
  assert.equal(r.status, 200);
  const p = await monProfil(r.data.access_token);
  assert.equal(p.data.role, "citoyen");
});

test("admin : crée un employé commis, qui peut se connecter", async () => {
  const r = await creer(jetonAdmin, {
    email: email("employe"), password: MDP, role: "employe", poste: "commis",
    prenom: "Émile", nom: "Employé",
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.role, "employe");
  assert.equal(r.data.poste, "commis");

  const l = await login(email("employe"), MDP);
  assert.equal(l.status, 200);
  const p = await monProfil(l.data.access_token);
  assert.equal(p.data.role, "employe");
  assert.equal(p.data.poste, "commis");
  assert.equal(await estEmploye(l.data.access_token), true, "pas de ligne dans employes");
});

test("admin : crée un employé superviseur", async () => {
  const r = await creer(jetonAdmin, {
    email: email("superviseur"), password: MDP, role: "employe", poste: "superviseur",
  });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal(r.data.poste, "superviseur");
});

test("création : poste obligatoire pour un employé, interdit pour les autres → 400", async () => {
  const base = { email: email("poste"), password: MDP };
  assert.equal((await creer(jetonAdmin, { ...base, role: "employe" })).status, 400);
  assert.equal((await creer(jetonAdmin, { ...base, role: "employe", poste: "pdg" })).status, 400);
  assert.equal((await creer(jetonAdmin, { ...base, role: "admin", poste: "commis" })).status, 400);
});

test("admin : crée un autre admin", async () => {
  const r = await creer(jetonAdmin, { email: email("admin2"), password: MDP, role: "admin" });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const l = await login(email("admin2"), MDP);
  assert.equal((await monProfil(l.data.access_token)).data.role, "admin");
  assert.equal(await estEmploye(l.data.access_token), true, "pas de ligne dans employes");
});

test("création : email déjà utilisé → 409", async () => {
  const corps = { email: email("doublon"), password: MDP, role: "employe", poste: "commis" };
  assert.equal((await creer(jetonAdmin, corps)).status, 201);
  assert.equal((await creer(jetonAdmin, corps)).status, 409);
});

test("création : données invalides → 400", async () => {
  const base = { email: email("invalide"), password: MDP, role: "employe", poste: "commis" };
  assert.equal((await creer(jetonAdmin, { ...base, role: "patron" })).status, 400);
  assert.equal((await creer(jetonAdmin, { ...base, email: "pas-un-email" })).status, 400);
  assert.equal((await creer(jetonAdmin, { ...base, password: "court" })).status, 400);
});

test("création : refusée sans jeton (401), pour un citoyen ou un employé (403)", async () => {
  const corps = { email: email("intrus"), password: MDP, role: "admin" };
  const sansJeton = await fetch(URL_ + "/functions/v1/creer-utilisateur", {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify(corps),
  });
  assert.equal(sansJeton.status, 401);

  const citoyen = await login(email("citoyen"), MDP);
  assert.equal((await creer(citoyen.data.access_token, corps)).status, 403);

  const employe = await login(email("employe"), MDP);
  assert.equal((await creer(employe.data.access_token, corps)).status, 403);
});

test("login : mauvais mot de passe → 400", async () => {
  const r = await login(email("citoyen"), "mauvais");
  assert.equal(r.status, 400);
});

test("profils : un citoyen ne voit que le sien, l'admin voit tout", async () => {
  const citoyen = await login(email("citoyen"), MDP);
  const vus = await appel("/rest/v1/profils?select=id,role", { jeton: citoyen.data.access_token });
  assert.equal(vus.status, 200);
  assert.equal(vus.data.length, 1);

  const tous = await appel("/rest/v1/profils?select=id,role", { jeton: jetonAdmin });
  assert.ok(tous.data.length >= 4);
});

test("profils : un citoyen ne peut pas changer son rôle", async () => {
  const citoyen = await login(email("citoyen"), MDP);
  const jeton = citoyen.data.access_token;
  const id = citoyen.data.user.id;

  const r = await appel(`/rest/v1/profils?id=eq.${id}`, {
    methode: "PATCH", jeton, corps: { role: "admin" },
  });
  assert.ok(r.status >= 400, `PATCH role accepté (${r.status})`);
  const r2 = await appel(`/rest/v1/profils?id=eq.${id}`, {
    methode: "PATCH", jeton, corps: { poste: "superviseur" },
  });
  assert.ok(r2.status >= 400, `PATCH poste accepté (${r2.status})`);
  assert.equal((await monProfil(jeton)).data.role, "citoyen");

  const ok = await appel(`/rest/v1/profils?id=eq.${id}`, {
    methode: "PATCH", jeton, corps: { prenom: "Cléo" }, entetes: { Prefer: "return=representation" },
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.data[0].prenom, "Cléo");
});
