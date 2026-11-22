"""Outil de tri : range les photos de ml/donnees/brut/ dans ml/donnees/images/<classe>/.

    uv run python -m ml_egouts.trier

Touches :
    0 = invalide (pas un égout)     1 = faible     2 = moyenne     3 = elevee
    Espace = passer (photo ambiguë)  Retour arrière = annuler la dernière   Échap = quitter

Les photos sont copiées (brut/ reste intact). On peut quitter et reprendre :
les photos déjà triées ne sont pas reproposées.
"""

import json
import shutil
import tkinter as tk
from pathlib import Path

from PIL import Image, ImageTk

from ml_egouts import CLASSES
from ml_egouts.donnees import EXTENSIONS

RACINE = Path(__file__).resolve().parent.parent / "donnees"
TOUCHES = {"0": "invalide", "1": "faible", "2": "moyenne", "3": "elevee"}
# Rangés automatiquement par ml_egouts.importer_roboflow : pas de tri manuel.
DOSSIERS_AUTOMATIQUES = {"hors_sujet"}
AIDE = "0 invalide · 1 faible · 2 moyenne · 3 élevée · Espace passer · ← annuler · Échap quitter"


class Trieur:
    def __init__(self, brut: Path, images: Path):
        self.brut, self.images = brut, images
        self.journal_chemin = brut / "tri.json"
        self.journal = (
            json.loads(self.journal_chemin.read_text("utf-8"))
            if self.journal_chemin.exists() else {}
        )
        self.a_trier = [
            p for p in sorted(brut.rglob("*"))
            if p.suffix.lower() in EXTENSIONS
            and str(p.relative_to(brut)) not in self.journal
            and p.relative_to(brut).parts[0] not in DOSSIERS_AUTOMATIQUES
        ]
        self.historique: list[tuple[Path, str]] = []

        self.fenetre = tk.Tk()
        self.fenetre.title("Tri des photos d'égouts")
        self.etiquette = tk.Label(self.fenetre)
        self.etiquette.pack()
        self.statut = tk.Label(self.fenetre, font=("Segoe UI", 12))
        self.statut.pack(pady=4)
        tk.Label(self.fenetre, text=AIDE, font=("Segoe UI", 10)).pack(pady=(0, 8))
        self.fenetre.bind("<Key>", self.touche)
        self.afficher()

    def compte(self) -> str:
        n = {c: sum(1 for v in self.journal.values() if v == c) for c in CLASSES}
        return " | ".join(f"{c} {n[c]}" for c in CLASSES)

    def afficher(self) -> None:
        if not self.a_trier:
            self.etiquette.configure(image="", text="Tout est trié !", font=("Segoe UI", 20))
            self.statut.configure(text=self.compte())
            return
        chemin = self.a_trier[0]
        with Image.open(chemin) as image:
            image = image.convert("RGB")
            image.thumbnail((900, 650))
            self.photo = ImageTk.PhotoImage(image)
        self.etiquette.configure(image=self.photo, text="")
        self.statut.configure(
            text=f"{chemin.relative_to(self.brut)}  —  reste {len(self.a_trier)}  —  {self.compte()}"
        )

    def enregistrer(self, retire: str | None = None) -> None:
        # Fusion avec le fichier actuel : l'import automatique peut y écrire en même temps.
        sur_disque = (
            json.loads(self.journal_chemin.read_text("utf-8"))
            if self.journal_chemin.exists() else {}
        )
        sur_disque.update(self.journal)
        if retire:
            sur_disque.pop(retire, None)
        self.journal = sur_disque
        self.journal_chemin.write_text(json.dumps(self.journal, indent=1), "utf-8")

    def touche(self, evenement) -> None:
        if evenement.keysym == "Escape":
            self.fenetre.destroy()
            return
        if evenement.keysym == "BackSpace" and self.historique:
            chemin, classe = self.historique.pop()
            relatif = str(chemin.relative_to(self.brut))
            if classe in CLASSES:
                (self.images / classe / self.nom_copie(chemin)).unlink(missing_ok=True)
            self.journal.pop(relatif, None)
            self.a_trier.insert(0, chemin)
            self.enregistrer(retire=relatif)
            self.afficher()
            return
        elif self.a_trier and (evenement.char in TOUCHES or evenement.keysym == "space"):
            chemin = self.a_trier.pop(0)
            classe = TOUCHES.get(evenement.char, "passee")
            if classe in CLASSES:
                (self.images / classe).mkdir(parents=True, exist_ok=True)
                shutil.copy2(chemin, self.images / classe / self.nom_copie(chemin))
            self.journal[str(chemin.relative_to(self.brut))] = classe
            self.historique.append((chemin, classe))
        else:
            return
        self.enregistrer()
        self.afficher()

    def nom_copie(self, chemin: Path) -> str:
        # Préfixe = sous-dossier d'origine, pour éviter les collisions de noms.
        return "_".join(chemin.relative_to(self.brut).parts)


def main() -> None:
    brut = RACINE / "brut"
    if not brut.is_dir():
        raise SystemExit(f"Rien à trier : {brut} n'existe pas.")
    Trieur(brut, RACINE / "images").fenetre.mainloop()


if __name__ == "__main__":
    main()
