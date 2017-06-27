const EARTH_EQUATORIAL_REVOLUTIONS_PER_DAY = 1.0027378;
const EARTH_OBLIQUITY = 0.4093;
const BELDEN_LAT = 40.005997;
const BELDEN_LON = -121.249132;

const DEG_TO_RAD = Math.PI / 180;

const params = {
  drawSphere: false,
  drawDomeWireframe: false,
  drawConstellation: false,

  constellationOpacity: 1,
  twinkleOpacity: 1,
  skyOpacity: 1,
  cloudOpacity: 0.1,

  secretReveal: 0,

  cameraFOV: 38,
  cameraEyeX: 5.5,
  cameraEyeY: 1.0,
  cameraEyeZ: 0.0,
  cameraTargetX: 3.8,
  cameraTargetY: 10.0,
  cameraTargetZ: 0.0,

  domeRotationY: 0.0,
  skyRotationY: 0.0,

  timeDays: 0.1,

  latitude: BELDEN_LAT,
  longitude: BELDEN_LON,
};

const main = () => {
  createREGL({
    extensions: [
      'OES_texture_float',
      'EXT_shader_texture_lod',
    ],
    attributes: {
      alpha: false
    },
    onDone: start
  });
};

const start = (err, regl) => {
  const gui = new dat.GUI();
  gui.useLocalStorage = true;
  gui.remember(params);
  gui.add(params, 'drawSphere');
  gui.add(params, 'drawDomeWireframe');
  gui.add(params, 'drawConstellation');
  gui.add(params, 'constellationOpacity', 0, 2).step(0.01);
  gui.add(params, 'twinkleOpacity', 0, 2).step(0.01);
  gui.add(params, 'skyOpacity', 0, 2).step(0.01);
  gui.add(params, 'cloudOpacity', 0, 1).step(0.01);
  gui.add(params, 'secretReveal', 0, 1).step(0.01);
  gui.add(params, 'cameraFOV', 10, 50).step(0.01);
  gui.add(params, 'cameraEyeX').step(0.01);
  gui.add(params, 'cameraEyeY').step(0.01);
  gui.add(params, 'cameraEyeZ').step(0.01);
  gui.add(params, 'cameraTargetX').step(0.01);
  gui.add(params, 'cameraTargetY').step(0.01);
  gui.add(params, 'cameraTargetZ').step(0.01);
  gui.add(params, 'domeRotationY');
  gui.add(params, 'skyRotationY');
  gui.add(params, 'latitude');
  gui.add(params, 'longitude');
  gui.add(params, 'timeDays');

  // sample date: "9/23/2007 1730"
  const dateRegex = /(\d+)\/(\d+)\/(\d+) (\d+)/;
  const dateSecret = '6/30/2017 1430';

  let timeDaysInterp = params.timeDays;
  let timeDaysPrev = timeDaysInterp;
  let constellationOpacityInterp = params.constellationOpacity;
  let secretRevealInterp = params.secretReveal;

  const setDateString = dateStr => {
    params.drawConstellation = dateStr === dateSecret;

    const split = dateRegex.exec(dateStr);
    const m = parseInt(split[1]);
    const d = parseInt(split[2]);
    const y = parseInt(split[3]);
    const t = parseInt(split[4]);
    const date = new Date(y, m, d, Math.floor(t / 100), t % 60);
    params.timeDays = date.getTime() / (1000 * 60 * 60 * 24);
  };

  const startConnection = () => {
    const ws = new WebSocket("ws://localhost:8080");
    ws.onmessage = event => setDateString(event.data);
    ws.onclose = () => setTimeout(() => startConnection(), 1000);
  };
  startConnection();

  const NUM_SAMPLES = 4;
  const DOME_RADIUS = 5.5;
  const DOME_CENTER = [0, 7, 0];

  const visibleSkyTexture = loadCube(regl, 'img/stars_visible_cube_{}.png');
  const taurusTexture = loadTexture(regl, 'img/taurus_4096.png');
  const randomTexture = loadTexture(regl, 'img/random.png', {
    mipmap: true,
    min: 'linear mipmap linear',
    wrap: 'repeat',
  });

  const BLEND_ADDITIVE = {
    enable: true,
    equation: 'add',
    func: { src: 'src alpha', dst: 'one' }
  };

  const DEPTH_DISABLED = { enable: false };

  const eyePos = () => [params.cameraEyeX,
                        params.cameraEyeY,
                        params.cameraEyeZ];
  const eyeTargetPos = () => [params.cameraTargetX,
                              params.cameraTargetY,
                              params.cameraTargetZ];

  const viewMatrix = ({tick}) => {
    return mat4.lookAt([], eyePos(tick), eyeTargetPos(), [-1, 0, 0]);
  };

  const cameraFOV = () => params.cameraFOV * DEG_TO_RAD;
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

  const orientationQuat = t => {
    const td = mix(timeDaysInterp, timeDaysPrev, t);
    const equatorialAngle = EARTH_EQUATORIAL_REVOLUTIONS_PER_DAY * -td * Math.PI * 2;
    const equatorial = quat.setAxisAngle([], [0, 1, 0], equatorialAngle);

    const povAngle = (90 - params.latitude) * DEG_TO_RAD;
    const pov = quat.setAxisAngle([], [0, 0, 1], povAngle);

    const north = quat.setAxisAngle([], [0, 1, 0], params.skyRotationY * DEG_TO_RAD);

    return quat.mul([], north, quat.mul([], pov, equatorial));
  };

  const orientationInvMatrix = i => {
    return mat3.fromQuat([], quat.invert([], orientationQuat(i / NUM_SAMPLES)));
  }

  const modelMatrix = (ctx) => {
    return mat4.fromRotation([], params.domeRotationY * DEG_TO_RAD, [0, 1, 0]);
  };

  const modelViewProjMatrix = (ctx) => {
    return mat4.mul([], viewProjMatrix(ctx), modelMatrix(ctx));
  };

  const drawDome = regl({
    frag: `
    #extension GL_EXT_shader_texture_lod : require

    precision highp float;

    ${SECRET_SHADER_FRAG}

    #define NUM_SAMPLES ${NUM_SAMPLES}

    uniform mat3 orientationInv[NUM_SAMPLES];
    uniform vec3 center;
    uniform float time, skyTime, secretReveal;
    uniform float constellationOpacity, twinkleOpacity, skyOpacity, cloudOpacity;
    uniform bool drawSphere;
    uniform sampler2D taurusTex, randomTex;
    uniform samplerCube visibleSkyTex;

    varying vec3 pos;

    const float PI = ${Math.PI};
    const vec3 UP = vec3(0.0, 1.0, 0.0);
    const vec2 EQUIRECT_RAD_TO_UNIT = 1.0 / vec2(PI * 2.0, PI);

    vec2 toPolar(in vec3 p) {
      return EQUIRECT_RAD_TO_UNIT * vec2(atan(p.z, p.x) + PI, acos(dot(p, UP)));
    }

    void main() {
      vec3 dir = normalize(pos - center);

      vec3 c = vec3(0.0);

      if (length(dir.xz) < secretReveal) {
        c = secret_render(dir, time);
      }
      else {
        // Render Sky

        for (int i = 0; i < NUM_SAMPLES; ++i) {
          c += textureCube(visibleSkyTex, (orientationInv[i] * dir).zyx).rgb;
        }
        c *= skyOpacity / float(NUM_SAMPLES);

        vec3 odir = orientationInv[0] * dir;
        vec2 a = toPolar(odir);
        c += constellationOpacity * texture2D(taurusTex, a).rgb;

        if (drawSphere) {
          vec2 grid = smoothstep(vec2(0.45), vec2(0.5), abs(fract(a * 20.0) - 0.5));
          c += 0.5 * max(grid.x, grid.y) * mix(vec3(1.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), a.y);
        }
      }

      c *= smoothstep(0.52, 0.62, dir.y);

      gl_FragColor = vec4(c, 1.0);
    }`,

    vert: `
    precision highp float;

    uniform mat4 model, modelViewProj;
    uniform float time;

    attribute vec3 position;

    varying vec3 pos;

    void main() {
      pos = vec3(model * vec4(position, 1.0));
      gl_Position = modelViewProj * vec4(position, 1.0);
    }`,

    attributes: {
      position: DOME_MESH.vertices
    },

    uniforms: (() => {
      const u = {
        time: ({tick}) => (tick / 60) % (60 * 60),
        skyTime: () => timeDaysInterp * (60 * 60 * 24),
        center: DOME_CENTER,
        drawSphere: () => params.drawSphere,
        visibleSkyTex: visibleSkyTexture,
        taurusTex: taurusTexture,
        randomTex: randomTexture,
        constellationOpacity: () => constellationOpacityInterp,
        twinkleOpacity: () => params.twinkleOpacity,
        skyOpacity: () => params.skyOpacity,
        cloudOpacity: () => params.cloudOpacity,
        secretReveal: () => secretRevealInterp,
        model: modelMatrix,
        modelViewProj: modelViewProjMatrix,
      };
      for (let i = 0; i < NUM_SAMPLES; ++i) {
        u[`orientationInv[${i}]`] = () => orientationInvMatrix(i);
      }
      return u;
    })(),

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

    timeDaysPrev = timeDaysInterp;
    timeDaysInterp = mix(timeDaysInterp, params.timeDays, 0.01);

    constellationOpacityInterp = mix(constellationOpacityInterp,
                                     params.drawConstellation ? params.constellationOpacity : 0.0,
                                     0.05);

    secretRevealInterp = mix(secretRevealInterp, params.secretReveal, 0.01);

    drawDome();
    if (params.drawDomeWireframe) drawDomeEdges();
  });
};
