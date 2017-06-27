// Ripped from Kali's amazing Fractal Anxiety shader: https://www.shadertoy.com/view/4tBXRh
// Modified for dome projection and reduced anxiety.

const SECRET_SHADER_FRAG = `
  vec3 secret_palette[7]; // the color secret_palette is stored here

  // get a gradient of the secret_palette based on c value, with a "smooth" parameter (0...1)
  vec3 secret_getsmcolor(float c, float s) {
    s *= .5;
    c = mod(c - .5, 7.);
    vec3 color1 = vec3(0.0), color2 = vec3(0.0);
    for (int i = 0; i < 7; i++) {
      if (float(i) - c <= .0) {
        color1 = secret_palette[i];
        color2 = secret_palette[(i + 1 > 6) ? 0 : i + 1];
      }
    }
    // smooth mix the two colors
    return mix(color1, color2, smoothstep(.5 - s, .5 + s, fract(c)));
  }
  vec3 secret_render(in vec3 dir, float time) {
    secret_palette[6] = vec3(255, 000, 000) / 255.;
    secret_palette[5] = vec3(255, 127, 000) / 255.;
    secret_palette[4] = vec3(255, 255, 000) / 255.;
    secret_palette[3] = vec3(150, 050, 050) / 255.;
    secret_palette[2] = vec3(000, 050, 50) / 255.;
    secret_palette[1] = vec3(075, 000, 130) / 255.;
    secret_palette[0] = vec3(143, 000, 255) / 255.;

    vec3 color = vec3(0.);
    vec2 p = dir.xz / (1.0 + dir.y);
    p *= 2.0;

    // fractal
    float a = time * .01;
    float b = 0.0; // time*60.;
    float ot = 1000.;
    mat2 rot = mat2(cos(a), sin(a), -sin(a), cos(a));
    p += sin(b) * .005;
    float l = length(p);
    for (int i = 0; i < 20; i++) {
      p *= rot;
      p = abs(p) * 1.2 - 1.;
      ot = min(ot, abs(dot(p, p) - sin(b + l * 20.) * .015 - .15)); // orbit trap
    }
    ot = max(0., .1 - ot) / .1; // orbit trap
    color = secret_getsmcolor(ot * 4. + l * 10. - time * 0.2, 1.) * (1. - .4 * step(.5, 1. - dot(p, p)));
    // color*=1.-pow(l*1.1,5.); color+=pow(max(0.,.2-l)/.2,3.)*1.2; // center glow

    return color * min(1., time * .3);
  }
  `;
