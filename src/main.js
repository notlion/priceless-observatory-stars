const main = () => {
  createREGL({
    extensions: [
      'OES_texture_float'
    ],
    attributes: {
      alpha: false
    },
    onDone: load
  });
};

const load = (err, regl) => {
  loadImage('img/star.png').then(image => {
    start(regl, image);
  });
};

const start = (regl, starImage) => {
  const PARTICLES_SIZE = Math.floor(Math.sqrt(STAR_DATA.length / 4));
  const MAX_PARTICLES = PARTICLES_SIZE * PARTICLES_SIZE;

  const particleState = new Float32Array(STAR_DATA.slice(0, MAX_PARTICLES * 4));

  const particleCoord = new Float32Array(MAX_PARTICLES * 2);
  for (let i = 0; i < MAX_PARTICLES * 2;) {
    particleCoord[i++] = (i % PARTICLES_SIZE) / PARTICLES_SIZE;
    particleCoord[i++] = Math.floor(i / PARTICLES_SIZE) / PARTICLES_SIZE;
  }

  const drawParticleSprites = regl({
    vert: `
    precision highp float;
    
    attribute vec2 coord;
    attribute vec4 state;
    
    varying vec3 color;
    
    uniform mat4 projection, view;
    uniform float time;

    float nrand(vec2 n) {
      return fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);
    }

    void main () {
      float b = state.w * state.w;
      float rc = nrand(coord);
      b *= mix(0.75, 1.0, sin(time * mix(1.0, 6.0, rc) + rc * ${Math.PI * 2}));
      color = vec3(b * 0.005);
      gl_Position = projection * view * vec4(state.xyz * 0.1, 1.0);
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
      coord: particleCoord,
      state: particleState
    },

    uniforms: {
      time: ({tick}) => tick / 60.0,
      view: ({tick}) => {
        const t = 0.001 * tick
        return mat4.lookAt([],
          [0, 0, 0],
          [5 * Math.cos(t), 0, 5 * Math.sin(t)],
          [0, 1, 0]);
      },
      projection: ({viewportWidth, viewportHeight}) => {
        return mat4.perspective([],
          Math.PI / 3,
          viewportWidth / viewportHeight,
          0.01,
          1000);
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

    count: MAX_PARTICLES,
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
