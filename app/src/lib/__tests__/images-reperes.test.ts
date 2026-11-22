import { hexSansDieze, nomImageGroupe, nomImageRepere, NOM_IMAGE_VEHICULE } from '../images-reperes';

describe('noms des images de repères', () => {
  it('gravité : un nom par couleur et par état', () => {
    expect(nomImageRepere('#2F7D32')).toBe('repere_2F7D32_normal');
    expect(nomImageRepere('#f47b20', 'choisi')).toBe('repere_F47B20_choisi');
    expect(nomImageRepere('#D9363E', 'attenue')).toBe('repere_D9363E_attenue');
    expect(hexSansDieze('#7b8580')).toBe('7B8580');
  });

  it('arrêt fait : toujours le repère gris avec coche', () => {
    expect(nomImageRepere('#0072B2', 'fait', 3)).toBe('repere_7B8580_fait');
  });

  it('arrêts numérotés : seulement la couleur du trajet, de 1 à 99', () => {
    expect(nomImageRepere('#0072B2', 'normal', 7)).toBe('repere_0072B2_normal_7');
    expect(nomImageRepere('#0072B2', 'prochain', 41)).toBe('repere_0072B2_prochain_41');
    expect(nomImageRepere('#0072B2', 'normal', 120)).toBe('repere_0072B2_normal');
    expect(nomImageRepere('#D55E00', 'normal', 7)).toBe('repere_D55E00_normal');
  });

  it('prochain sans numéro : repli sur une image qui existe', () => {
    expect(nomImageRepere('#009E73', 'prochain')).toBe('repere_009E73_prochain');
    expect(nomImageRepere('#2F7D32', 'prochain')).toBe('repere_2F7D32_normal');
    expect(nomImageRepere('#123456')).toBe('repere_0072B2_normal');
  });

  it('véhicule', () => {
    expect(NOM_IMAGE_VEHICULE).toBe('vehicule');
  });
});


describe('images des repères de groupe', () => {
  it('nombre dans la goutte, point rouge seulement si le groupe contient un élevé sans être rouge', () => {
    expect(nomImageGroupe('#2F7D32', 12, false)).toBe('groupe_2F7D32_12');
    expect(nomImageGroupe('#F47B20', 12, true)).toBe('groupe_F47B20_12_e');
    expect(nomImageGroupe('#D9363E', 12, true)).toBe('groupe_D9363E_12');
    expect(nomImageGroupe('#2F7D32', 250, false)).toBe('groupe_2F7D32_99plus');
    expect(nomImageGroupe('#2F7D32', 1, false)).toBe('groupe_2F7D32_2');
    expect(nomImageGroupe('#123456', 5, false)).toBe('groupe_2F7D32_5');
  });
});
