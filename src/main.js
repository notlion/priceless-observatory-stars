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
  const PARTICLES_SIZE = Math.floor(Math.sqrt(STAR_DATA.length / 4));
  const MAX_PARTICLES = PARTICLES_SIZE * PARTICLES_SIZE;

  const particleStateInit = new Float32Array(STAR_DATA.slice(0, MAX_PARTICLES * 4));

  const particleState = new Array(3).fill().map(() => {
    return regl.framebuffer({
      color: regl.texture({
        shape: [PARTICLES_SIZE, PARTICLES_SIZE, 4],
        type: 'float',
        data: particleStateInit
      }),
      depthStencil: false
    });
  });

  const particleCoord = new Float32Array(MAX_PARTICLES * 2);
  for (let i = 0; i < MAX_PARTICLES * 2;) {
    particleCoord[i++] = (i % PARTICLES_SIZE) / PARTICLES_SIZE;
    particleCoord[i++] = Math.floor(i / PARTICLES_SIZE) / PARTICLES_SIZE;
  }

  const drawParticleSprites = regl({
    vert: `
    precision highp float;
    
    attribute vec2 coord;
    
    varying vec3 color;
    
    uniform sampler2D particleState[2];
    uniform mat4 projection, view;

    uniform float time;

    float nrand(vec2 n) {
      return fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);
    }

    void main () {
      vec4 state0 = texture2D(particleState[0], coord);
      vec4 state1 = texture2D(particleState[1], coord);
      float b = state0.w * state0.w;
      float rc = nrand(coord);
      b *= mix(0.75, 1.0, sin(time * mix(1.0, 6.0, rc) + rc * ${Math.PI * 2}));
      color = vec3(b * 0.005);
      gl_Position = projection * view * vec4(state0.xyz * 0.1, 1.0);
      gl_PointSize = b * 0.02;
    }`,

    frag: `
    precision highp float;
    
    varying vec3 color;

    void main () {
      gl_FragColor = vec4(color, 1.0);
    }`,

    attributes: {
      coord: particleCoord
    },

    uniforms: {
      'particleState[0]': () => particleState[0],
      'particleState[1]': () => particleState[1],
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
