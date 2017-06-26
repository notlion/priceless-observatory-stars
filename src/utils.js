const mix = (a, b, t) => a + (b - a) * t;

const loadTexture = (regl, url, opts) => {
  const img = new Image();
  img.src = url;

  const defaults = {
    data: img,
    min: 'linear',
    mag: 'linear',
  };

  if (opts !== undefined) {
    for (let k in opts) defaults[k] = opts[k];
  }

  let tex = regl.texture({ data: null, width: 1, height: 1 });
  img.addEventListener('load', () => {
    tex = regl.texture(defaults);
  });

  return () => tex;
};

const loadCube = (regl, url) => {
  let cube = regl.cube(4);

  const faces = [];
  let numComplete = 0;
  const onLoad = i => {
    if (++numComplete == 6) {
      cube = regl.cube({
        faces: [
          faces[1], // posx
          faces[3], // negx
          faces[4], // posy
          faces[5], // negy
          faces[0], // posz
          faces[2], // negz
        ],
        min: 'linear mipmap linear',
        mag: 'linear'
      });
    }
  };

  for (let i = 0; i < 6; ++i) {
    const img = new Image();
    img.src = url.replace('{}', i);
    img.addEventListener('load', () => onLoad(i));
    faces.push(img);
  }

  return () => cube;
};
