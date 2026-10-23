import { describe, expect, it } from 'vitest';
import { cleanAddresses, isAddressLine, localParse, looksClean, parseModelText } from '../supabase/functions/_shared/extract.ts';

describe('isAddressLine', () => {
  it.each([
    '12 rue de la Paix 75002 Paris',
    '8 Boulevard du Port 80000 Amiens',
    'Rue 50',
    '75002 Paris Opéra',
    '12 rue du Chemin Vert 75011 Paris',
    'Résidence Les Jardins du Parc, bâtiment B, 12 avenue du Général de Gaulle 75002 Paris',
  ])('accepte : %s', (l) => expect(isAddressLine(l)).toBe(true));

  it.each([
    'Total : 12 colis',
    'Tel 06 12 34 56 78',
    'contact@exemple.fr',
    'https://exemple.fr/rue-de-la-paix',
    '75002',
    '',
    'Bonjour,',
    "Salut ! Voilà les livraisons demain, merci d'avance :) Dupont rue 70, Martin rue 20, Durand rue 90 et Petit rue 40. À demain",
    '12 rue A 75001 Paris puis 8 rue B 75002 Paris puis 5 rue C 75003 Paris',
  ])('rejette : %s', (l) => expect(isAddressLine(l)).toBe(false));
});

describe('localParse', () => {
  it('lit une liste à puces et numérotée, ignore le bruit', () => {
    const text = `Bonjour, voici la tournée de demain :
- 12 rue de la Paix 75002 Paris
2) 8 avenue Foch 75116 Paris
3 - 5 place Bellecour 69002 Lyon
Merci et bonne journée !
Tel 06 12 34 56 78`;
    expect(localParse(text)).toEqual([
      '12 rue de la Paix 75002 Paris',
      '8 avenue Foch 75116 Paris',
      '5 place Bellecour 69002 Lyon',
    ]);
  });

  it('retire le téléphone en fin de ligne et les préfixes « Adresse : »', () => {
    expect(localParse('Adresse : 3 rue Victor Hugo 33000 Bordeaux 06 11 22 33 44')).toEqual(['3 rue Victor Hugo 33000 Bordeaux']);
  });

  it('lit des lignes de tableur (tabulations / point-virgule) en sautant noms et téléphones', () => {
    const text = 'Dupont\t06 11 22 33 44\t12 rue des Lilas\t75020\tParis\nMartin;0123456789;4 allée des Pins;69003;Lyon';
    expect(localParse(text)).toEqual(['12 rue des Lilas 75020 Paris', '4 allée des Pins 69003 Lyon']);
  });

  it('dédoublonne sans tenir compte de la casse et ignore les commentaires', () => {
    expect(localParse('# test\n12 Rue de la Paix 75002 Paris\n12 rue de la paix 75002 paris')).toHaveLength(1);
  });
});

describe('looksClean', () => {
  it('vrai pour une liste propre, faux dès qu\'une ligne n\'est pas une adresse', () => {
    expect(looksClean('12 rue A 75001 Paris\n8 rue B 75002 Paris')).toBe(true);
    expect(looksClean('Bonjour,\n12 rue A 75001 Paris')).toBe(false);
    expect(looksClean('   \n')).toBe(false);
    expect(looksClean("Salut ! Voilà les livraisons demain, merci d'avance :) Dupont rue 70, Martin rue 20")).toBe(false);
  });
});

describe('cleanAddresses / parseModelText', () => {
  it('nettoie, dédoublonne, limite', () => {
    expect(cleanAddresses(['  a  b ', 'A B', 42, '', 'rue x'], 10)).toEqual(['a b', 'rue x']);
    expect(cleanAddresses(Array.from({ length: 200 }, (_, i) => `adresse ${i}`))).toHaveLength(98);
    expect(cleanAddresses('pas un tableau')).toEqual([]);
  });

  it('lit le JSON du modèle, même entouré de texte', () => {
    expect(parseModelText('{"addresses":["1 rue A 75001 Paris"]}')).toEqual(['1 rue A 75001 Paris']);
    expect(parseModelText('Voici : {"addresses":["2 rue B 75002 Paris"]} fin')).toEqual(['2 rue B 75002 Paris']);
    expect(parseModelText('rien de JSON')).toEqual([]);
  });
});
