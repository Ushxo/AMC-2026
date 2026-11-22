import React, { useState } from "react";

import { Session } from "./auth";
import CitizenApp from "./citizen/CitizenApp";
import LoginScreen from "./citizen/LoginScreen";
import { DemoProvider } from "./context/DemoContext";
import StaffApp from "./StaffApp";

// Point d'entrée : connexion, puis redirection selon le rôle.
// Le DemoProvider est au-dessus de tout : les signalements d'un citoyen
// restent visibles quand on se reconnecte en superviseur.
export default function AppRoot() {
  const [session, setSession] = useState<Session | null>(null);
  const logout = () => setSession(null);

  return (
    <DemoProvider>
      {!session ? (
        <LoginScreen onLogin={setSession} />
      ) : session.role === "citoyen" ? (
        <CitizenApp onLogout={logout} />
      ) : (
        <StaffApp session={session} onLogout={logout} />
      )}
    </DemoProvider>
  );
}
