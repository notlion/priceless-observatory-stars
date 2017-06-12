const DOME_MESH = (() => {
  const lines = `
  v -3.9798 9.45967 2.89147
  v -1.44577 9.89154 4.44956
  v 1.52013 9.45967 4.67851
  v -4.67857 9.89154 5.83602e-06
  v 3.78505 9.89154 2.74997
  v 2.89152 11.6786 -9.01611e-06
  v 4.91934 9.45967 -1.68243e-05
  v -2.33927 11.6786 1.69957
  v 0.893512 11.6786 2.74997
  v -2.77537e-12 12.5 -1.20792e-06
  v -3.97981 9.45968 -2.89146
  v -2.33928 11.6786 -1.69956
  v -1.44579 9.89156 -4.44957
  v 3.78504 9.89155 -2.75
  v 0.8935 11.6786 -2.74998
  v 1.52011 9.45968 -4.67853
  f 9 3 5
  f 5 6 9
  f 10 9 6
  f 6 5 7
  f 8 1 2
  f 2 9 8
  f 10 8 9
  f 2 3 9
  f 12 11 4
  f 4 8 12
  f 10 12 8
  f 8 4 1
  f 15 16 13
  f 13 12 15
  f 10 15 12
  f 12 13 11
  f 6 7 14
  f 14 15 6
  f 10 6 15
  f 15 14 16
  `
  .match(/[vf] \S+ \S+ \S+/g)
  .map(l => l.split(/\s/));

  const vertices = lines
    .filter(l => l[0] === 'v')
    .reduce((acc, l) => acc.concat(l.slice(1).map(x => parseFloat(x))), []);

  const triangleIndices = lines
    .filter(l => l[0] === 'f')
    .reduce((acc, l) => acc.concat(l.slice(1).map(x => parseInt(x) - 1)), []);

  const edgeIndices = [];
  const e = triangleIndices;
  for (let i = 0; i < e.length; i += 3) {
    edgeIndices.push(e[i], e[i + 1], e[i + 1], e[i + 2], e[i + 2], e[i + 0]);
  }

  return {
    vertices,
    triangleIndices,
    edgeIndices
  };
})();
