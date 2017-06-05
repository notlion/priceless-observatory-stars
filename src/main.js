const main = () => {
  createREGL({
    extensions: [
      'OES_texture_float'
    ],
    attributes: {
      alpha: false
    },
    onDone: start
  });
};

const start = (err, regl) => {
  const NUM_STARS = STAR_DATA.length / 4;

  const particleStates = new Float32Array(STAR_DATA);
  const particleIds = new Float32Array(NUM_STARS);
  for (let i = 0; i < NUM_STARS; ++i) particleIds[i] = i;

  const DOME_RADIUS = 5.5;

  const drawParticleSprites = regl({
    vert: `
    precision highp float;

    attribute vec4 state;
    attribute float id;

    varying vec3 color;

    uniform mat4 projection, view, model;
    uniform float time, radius;

    float nrand(vec2 n) {
      return fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);
    }

    void main () {
      vec3 n = normalize(state.xyz);
      vec3 p = n * radius;

      float b = state.w * state.w;
      float rc = nrand(vec2(id, id + 1.0));
      b *= mix(0.75, 1.0, sin(time * mix(1.0, 6.0, rc) + rc * ${Math.PI * 2}));
      b *= smoothstep(0.5, 0.6, dot(n, vec3(0.0, -1.0, 0.0)));

      color = vec3(b * 0.005);

      gl_Position = projection * view * model * vec4(p, 1.0);
      gl_PointSize = b * 0.2;
    }`,

    frag: `
    precision highp float;

    varying vec3 color;

    void main () {
      float b = 1.0 - 2.0 * distance(vec2(0.5), gl_PointCoord);
      gl_FragColor = b * b * b * b * vec4(color, 1.0);
    }`,

    attributes: {
      id: particleIds,
      state: particleStates
    },

    uniforms: {
      time: ({tick}) => tick / 60,
      radius: DOME_RADIUS,

      model: () => {
        return mat4.fromTranslation([], [0, 7, 0]);
      },
      view: () => {
        return mat4.lookAt([],
          [3.83257, 13.7549, 0.0],
          [5.50758, 1.0, 0.0],
          [0, -1, 0]);
      },
      projection: ({viewportWidth, viewportHeight}) => {
        const shift = mat4.fromTranslation([], [0, -1, 0]);
        const p = mat4.perspective([],
          38 * 2 * (Math.PI / 180),
          viewportWidth / viewportHeight,
          0.01,
          100);
        return mat4.mul([], shift, p);
      }
    },

    blend: {
      enable: true,
      equation: 'add',
      func: { src: 'src alpha', dst: 'one' }
    },

    depth: {
      enable: false
    },

    count: NUM_STARS,
    offset: 0,
    elements: null,
    primitive: 'points'
  });

  regl.frame(() => {
    regl.clear({
      color: () => [0, 0, 0, 1],
      depth: 1
    });

    drawParticleSprites();
  });
};
