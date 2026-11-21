import { Colors } from '../theme';

describe('theme', () => {
  it('a les mêmes clés de couleur en clair et en sombre', () => {
    expect(Object.keys(Colors.dark).sort()).toEqual(Object.keys(Colors.light).sort());
  });
});
