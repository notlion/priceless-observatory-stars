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

const loadTexture = (regl, url) => {
  const img = new Image();
  img.src = url;

  let tex = regl.texture({ data: null, width: 1, height: 1 });
  img.addEventListener('load', () => {
    tex = regl.texture({
      data: img,
      min: 'linear',
      mag: 'linear',
    });
  });
  return () => tex;
};

const start = (err, regl) => {
  const guiParams = {};
  const gui = new dat.GUI();
  const guiAddFloat = (k, d, r) => {
    guiParams[k] = d;
    if (r !== undefined)
      gui.add(guiParams, k, d - r, d + r, 0.01);
    else
      gui.add(guiParams, k, d);
  };
  const guiAddBool = (k, d) => {
    guiParams[k] = d;
    gui.add(guiParams, k);
  };
  guiAddBool('Draw Sphere', false);
  guiAddBool('Draw Dome Wireframe', false);
  guiAddFloat('Camera FOV', 38, 10);
  guiAddFloat('Camera Eye X', 5.5, 3);
  guiAddFloat('Camera Eye Y', 1.0, 3);
  guiAddFloat('Camera Eye Z', 0.0, 3);
  guiAddFloat('Camera Target X', 3.8, 5);
  guiAddFloat('Camera Target Y', 10.0, 5);
  guiAddFloat('Camera Target Z', 0.0, 5);
  guiAddFloat('Dome Rotation Y', 0.0, 180);
  guiAddFloat('Time Days', 0.1);
  gui.remember(guiParams);

  const EARTH_EQUATORIAL_REVOLUTIONS_PER_DAY = 1.0027378;
  const EARTH_OBLIQUITY = 0.4093;
  const BELDEN_LAT = 40.005997;
  const BELDEN_LON = -121.249132;

  const NUM_STARS = STAR_DATA.length / 4;

  const particleStates = new Float32Array(STAR_DATA);
  const particleIds = new Float32Array(NUM_STARS);
  for (let i = 0; i < NUM_STARS; ++i) particleIds[i] = i;

  const DOME_RADIUS = 5.5;
  const DOME_CENTER = [0, 7, 0];

  const visibleSkyTexture = loadTexture(regl, 'img/stars_visible_4096.png');

  const BLEND_ADDITIVE = {
    enable: true,
    equation: 'add',
    func: { src: 'src alpha', dst: 'one' }
  };

  const DEPTH_DISABLED = { enable: false };

  const eyePos = (tick) => {
    return [guiParams['Camera Eye X'],
            guiParams['Camera Eye Y'],
            guiParams['Camera Eye Z']];
  }
  const eyeTargetPos = () => [guiParams['Camera Target X'],
                              guiParams['Camera Target Y'],
                              guiParams['Camera Target Z']];

  const viewMatrix = ({tick}) => {
    return mat4.lookAt([], eyePos(tick), eyeTargetPos(), [-1, 0, 0]);
  };

  const cameraFOV = () => guiParams['Camera FOV'] * (Math.PI / 180);
  const cameraProjectionMatrix = (ctx) => {
    return mat4.perspective([], cameraFOV(), ctx.viewportWidth / ctx.viewportHeight, 0.01, 100);
  };

  const projectionMatrix = (ctx) => {
    const p = cameraProjectionMatrix(ctx);
    const t = mat4.fromTranslation([], [0, -1, 0]);
    return mat4.mul([], t, p);
  };

  const viewProjMatrix = (ctx) => {
    return mat4.mul([], projectionMatrix(ctx), viewMatrix(ctx));
  };

  const viewProjInvMatrix = (ctx) => {
    return mat4.invert([], viewProjMatrix(ctx));
  };

  const orientationMatrix = (ctx) => {
    const days = guiParams['Time Days'];
    const equatorialAngle = EARTH_EQUATORIAL_REVOLUTIONS_PER_DAY * days * Math.PI * 2;
    const equatorial = mat4.fromRotation([], equatorialAngle, [0, 1, 0]);
    return mat3.fromMat4([], equatorial);
  };

  const modelMatrix = (ctx) => {
    return mat4.fromRotation([], guiParams['Dome Rotation Y'] * (Math.PI / 180), [0, 1, 0]);
  };

  const modelViewProjMatrix = (ctx) => {
    return mat4.mul([], viewProjMatrix(ctx), modelMatrix(ctx));
  };

  const drawParticleSprites = regl({
    vert: `
    precision highp float;

    attribute vec4 state;
    attribute float id;

    varying vec3 color;

    uniform mat4 modelViewProj;
    uniform mat3 orientation;
    uniform vec3 center;
    uniform float time, radius, pointScale;

    float nrand(vec2 n) {
      return fract(sin(dot(n.xy, vec2(12.9898, 78.233)))* 43758.5453);
    }

    void main() {
      vec3 n = orientation * normalize(state.xyz);
      vec3 p = n * radius;

      float b = state.w * state.w;
      float rc = nrand(vec2(id, id + 1.0));
      b *= mix(0.9, 1.0, sin(time * mix(1.0, 10.0, rc) + rc * ${Math.PI * 2}));
      b *= smoothstep(0.5, 0.6, dot(n, vec3(0.0, 1.0, 0.0)));

      color = vec3(b * 0.005);

      gl_Position = modelViewProj * vec4(center + p, 1.0);
      gl_PointSize = b * pointScale;
    }`,

    frag: `
    precision highp float;

    varying vec3 color;

    void main() {
      float b = 1.0 - 2.0 * distance(vec2(0.5), gl_PointCoord);
      gl_FragColor = b * b * b * b * vec4(color, 1.0);
    }`,

    attributes: {
      id: particleIds,
      state: particleStates
    },

    uniforms: {
      time: ({tick}) => tick / 60,
      pointScale: ({pixelRatio}) => pixelRatio * 0.2,
      radius: DOME_RADIUS,
      center: DOME_CENTER,
      modelViewProj: viewProjMatrix,
      orientation: orientationMatrix,
    },

    blend: BLEND_ADDITIVE,
    depth: { enable: false },

    count: NUM_STARS,
    primitive: 'points'
  });

  const drawDome = regl({
    frag: `
    precision highp float;

    uniform mat3 orientationInv;
    uniform vec3 center;
    uniform float time;
    uniform bool drawSphere;
    uniform sampler2D visibleSkyTex;

    varying vec3 pos;

    #define PI ${Math.PI}

    void main() {
      vec3 p = orientationInv * normalize(pos - center);
      vec2 a = vec2(atan(p.z, p.x) + PI, acos(dot(p, vec3(0.0, 1.0, 0.0))))
               / vec2(PI * 2.0, PI);
      vec2 grid = smoothstep(vec2(0.45), vec2(0.5), abs(fract(a * 20.0) - 0.5));

      vec3 c = texture2D(visibleSkyTex, a).rgb;
      if (drawSphere)
        c += 0.5 * max(grid.x, grid.y) * mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), a.y);

      gl_FragColor = vec4(c, 1.0);
    }`,

    vert: `
    precision highp float;

    uniform mat4 modelViewProj;
    uniform float time;

    attribute vec3 position;

    varying vec3 pos;

    void main() {
      pos = position;
      gl_Position = modelViewProj * vec4(position, 1.0);
    }`,

    attributes: {
      position: DOME_MESH.vertices
    },

    uniforms: {
      time: ({tick}) => tick / 60,
      center: DOME_CENTER,
      drawSphere: () => guiParams['Draw Sphere'],
      visibleSkyTex: visibleSkyTexture,
      modelViewProj: modelViewProjMatrix,
      orientationInv: ctx => mat3.invert([], orientationMatrix(ctx)),
    },

    blend: BLEND_ADDITIVE,
    depth: DEPTH_DISABLED,

    elements: DOME_MESH.triangleIndices,
    primitive: 'triangles'
  });

  const COLOR_FRAG = `
  precision highp float;

  uniform vec4 color;

  void main() {
    gl_FragColor = color;
  }`;

  const COLOR_VERT = `
  precision highp float;

  uniform mat4 matrix;

  attribute vec3 position;

  void main() {
    gl_Position = matrix * vec4(position, 1.0);
  }`;

  const drawDomeEdges = regl({
    frag: COLOR_FRAG,
    vert: COLOR_VERT,

    attributes: {
      position: DOME_MESH.vertices
    },

    uniforms: {
      matrix: modelViewProjMatrix,
      color: [0, 1, 0, 1]
    },

    blend: BLEND_ADDITIVE,
    depth: DEPTH_DISABLED,

    elements: DOME_MESH.edgeIndices,
    primitive: 'lines'
  });

  regl.frame(() => {
    regl.clear({
      color: () => [0, 0, 0, 1],
      depth: 1
    });

    // drawParticleSprites();
    drawDome();
    if (guiParams['Draw Dome Wireframe']) drawDomeEdges();
  });
};
