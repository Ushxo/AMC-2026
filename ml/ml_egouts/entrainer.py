"""Entraîne le classifieur sur ml/donnees/images/ et l'enregistre dans ml/modeles/.

    uv run python -m ml_egouts.entrainer
    uv run python -m ml_egouts.entrainer --epoques 25 --donnees autre/dossier

Deux phases d'apprentissage par transfert :
  1. seule la dernière couche apprend (le reste du réseau est gelé) ;
  2. tout le réseau s'ajuste, avec un pas d'apprentissage plus petit.
Le meilleur modèle (F1 macro sur la validation) est gardé, puis exporté en
PyTorch (.pt), en ONNX (.onnx, pour le servir ailleurs) et avec ses métriques (.json).
"""

import argparse
import json
import time
from pathlib import Path

import torch
from torch import nn
from torch.utils.data import DataLoader

from ml_egouts import CLASSES
from ml_egouts.donnees import (
    TAILLE,
    PhotosEgouts,
    compter,
    lister_images,
    separer,
    transformation_entrainement,
    transformation_evaluation,
)
from ml_egouts.modele import construire_modele, geler_extracteur

MINIMUM_PAR_CLASSE = 2


def matrice_confusion(vraies: list[int], predites: list[int]) -> list[list[int]]:
    matrice = [[0] * len(CLASSES) for _ in CLASSES]
    for v, p in zip(vraies, predites):
        matrice[v][p] += 1
    return matrice


def metriques(matrice: list[list[int]]) -> dict:
    n = len(matrice)
    total = sum(map(sum, matrice))
    justes = sum(matrice[i][i] for i in range(n))
    par_classe, f1s = {}, []
    for i, classe in enumerate(CLASSES):
        vp = matrice[i][i]
        predits = sum(matrice[j][i] for j in range(n))
        reels = sum(matrice[i])
        precision = vp / predits if predits else 0.0
        rappel = vp / reels if reels else 0.0
        f1 = 2 * precision * rappel / (precision + rappel) if precision + rappel else 0.0
        par_classe[classe] = {
            "precision": round(precision, 3), "rappel": round(rappel, 3),
            "f1": round(f1, 3), "photos": reels,
        }
        if reels:
            f1s.append(f1)
    return {
        "exactitude": round(justes / total, 3) if total else 0.0,
        "f1_macro": round(sum(f1s) / len(f1s), 3) if f1s else 0.0,
        "par_classe": par_classe,
    }


def evaluer(modele, chargeur, appareil) -> tuple[float, list[list[int]]]:
    modele.eval()
    vraies, predites, perte_totale = [], [], 0.0
    critere = nn.CrossEntropyLoss(reduction="sum")
    with torch.no_grad():
        for images, etiquettes in chargeur:
            images, etiquettes = images.to(appareil), etiquettes.to(appareil)
            sorties = modele(images)
            perte_totale += critere(sorties, etiquettes).item()
            vraies += etiquettes.tolist()
            predites += sorties.argmax(1).tolist()
    return perte_totale / max(1, len(vraies)), matrice_confusion(vraies, predites)


def poids_des_classes(exemples) -> torch.Tensor:
    """Compense les classes sous-représentées dans la perte."""
    nombres = list(compter(exemples).values())
    total = sum(nombres)
    return torch.tensor(
        [total / (len(nombres) * n) if n else 0.0 for n in nombres], dtype=torch.float
    )


def entrainer(
    dossier_donnees: Path,
    dossier_sortie: Path,
    epoques: int = 20,
    epoques_tete: int = 5,
    taille_lot: int = 32,
    pre_entraine: bool = True,
    appareil: str | None = None,
    afficher=print,
) -> dict:
    appareil = appareil or ("cuda" if torch.cuda.is_available() else "cpu")
    exemples = lister_images(dossier_donnees)
    nombres = compter(exemples)
    manquantes = [c for c, n in nombres.items() if n < MINIMUM_PAR_CLASSE]
    if manquantes:
        raise SystemExit(
            f"Pas assez de photos dans {dossier_donnees} pour : {', '.join(manquantes)} "
            f"(minimum {MINIMUM_PAR_CLASSE} par classe). Photos trouvées : {nombres}"
        )

    entrainement, validation = separer(exemples)
    afficher(f"Appareil : {appareil}")
    afficher(f"Entraînement : {compter(entrainement)}")
    afficher(f"Validation   : {compter(validation)}")

    ouvriers = 0  # Windows : plus simple et assez rapide pour de petits jeux de données
    chargeur_ent = DataLoader(
        PhotosEgouts(entrainement, transformation_entrainement),
        batch_size=taille_lot, shuffle=True, num_workers=ouvriers,
    )
    chargeur_val = DataLoader(
        PhotosEgouts(validation, transformation_evaluation),
        batch_size=taille_lot, num_workers=ouvriers,
    )

    modele = construire_modele(pre_entraine).to(appareil)
    critere = nn.CrossEntropyLoss(weight=poids_des_classes(entrainement).to(appareil))

    dossier_sortie.mkdir(parents=True, exist_ok=True)
    chemin_pt = dossier_sortie / "modele.pt"
    meilleur = {"f1_macro": -1.0}

    for epoque in range(1, epoques + 1):
        if epoque == 1:
            geler_extracteur(modele, True)
            optimiseur = torch.optim.AdamW(
                (p for p in modele.parameters() if p.requires_grad), lr=1e-3
            )
        elif epoque == epoques_tete + 1:
            geler_extracteur(modele, False)
            optimiseur = torch.optim.AdamW(modele.parameters(), lr=1e-4, weight_decay=1e-4)

        modele.train()
        debut, perte_ent = time.time(), 0.0
        for images, etiquettes in chargeur_ent:
            images, etiquettes = images.to(appareil), etiquettes.to(appareil)
            optimiseur.zero_grad()
            perte = critere(modele(images), etiquettes)
            perte.backward()
            optimiseur.step()
            perte_ent += perte.item() * len(etiquettes)
        perte_ent /= len(entrainement)

        perte_val, matrice = evaluer(modele, chargeur_val, appareil)
        m = metriques(matrice)
        phase = "tête" if epoque <= epoques_tete else "complet"
        afficher(
            f"Époque {epoque:>2}/{epoques} ({phase}) | perte ent. {perte_ent:.3f} | "
            f"perte val. {perte_val:.3f} | exactitude {m['exactitude']:.3f} | "
            f"F1 macro {m['f1_macro']:.3f} | {time.time() - debut:.0f} s"
        )
        if m["f1_macro"] > meilleur["f1_macro"]:
            torch.save(modele.state_dict(), chemin_pt)
            meilleur = {**m, "epoque": epoque, "matrice_confusion": matrice}

    modele.load_state_dict(torch.load(chemin_pt, map_location=appareil, weights_only=True))
    exporter_onnx(modele.cpu().eval(), dossier_sortie / "modele.onnx")

    resume = {
        "classes": list(CLASSES),
        "taille_image": TAILLE,
        "photos": {"entrainement": compter(entrainement), "validation": compter(validation)},
        "meilleure_validation": meilleur,
    }
    (dossier_sortie / "metriques.json").write_text(
        json.dumps(resume, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    afficher(
        f"Meilleur modèle : époque {meilleur['epoque']}, F1 macro {meilleur['f1_macro']}, "
        f"exactitude {meilleur['exactitude']} -> {dossier_sortie}"
    )
    return resume


def exporter_onnx(modele: nn.Module, chemin: Path) -> None:
    exemple = torch.randn(1, 3, TAILLE, TAILLE)
    torch.onnx.export(
        modele, exemple, chemin,
        input_names=["image"], output_names=["scores"],
        dynamic_axes={"image": {0: "lot"}, "scores": {0: "lot"}},
        dynamo=False,
    )


def main() -> None:
    racine = Path(__file__).resolve().parent.parent
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--donnees", type=Path, default=racine / "donnees" / "images")
    parser.add_argument("--sortie", type=Path, default=racine / "modeles")
    parser.add_argument("--epoques", type=int, default=20)
    parser.add_argument("--epoques-tete", type=int, default=5)
    parser.add_argument("--taille-lot", type=int, default=32)
    args = parser.parse_args()
    entrainer(args.donnees, args.sortie, args.epoques, args.epoques_tete, args.taille_lot)


if __name__ == "__main__":
    main()
