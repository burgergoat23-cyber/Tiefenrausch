#version 330

#moj_import <minecraft:globals.glsl>

// Endbild: Leuchten (Bloom) + Belichtung + Filmkurve (ACES) + Farbstimmung + Vignette + Korn.
uniform sampler2D InSampler;
uniform sampler2D BloomSampler;

layout(std140) uniform GradeConfig {
    vec4 ShadowTint;
    vec4 HighlightTint;
    vec4 Balance;
    float Exposure;
    float Contrast;
    float Saturation;
    float Vibrance;
    float BloomStrength;
    float Vignette;
    float Sharpen;
    float Grain;
    float Aberration;
    float Tonemap;
    float NightVision;
    float Fade;
    float Posterize;
    float Outline;
};

in vec2 texCoord;

out vec4 fragColor;

vec3 aces(vec3 x) {
    const float a = 2.51;
    const float b = 0.03;
    const float c = 2.43;
    const float d = 0.59;
    const float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 size = vec2(textureSize(InSampler, 0));
    vec2 px = 1.0 / size;
    vec2 uv = texCoord;

    // Farbsaum am Bildrand (wie bei einer echten Linse)
    vec3 c;
    if (Aberration > 0.0) {
        vec2 dir = (uv - 0.5) * Aberration;
        c = vec3(texture(InSampler, uv + dir).r, texture(InSampler, uv).g, texture(InSampler, uv - dir).b);
    } else {
        c = texture(InSampler, uv).rgb;
    }

    // Nachschaerfen ohne helle Raender (begrenzt auf die Nachbarn)
    vec3 n1 = texture(InSampler, uv + vec2(px.x, 0.0)).rgb;
    vec3 n2 = texture(InSampler, uv - vec2(px.x, 0.0)).rgb;
    vec3 n3 = texture(InSampler, uv + vec2(0.0, px.y)).rgb;
    vec3 n4 = texture(InSampler, uv - vec2(0.0, px.y)).rgb;
    if (Sharpen > 0.0) {
        vec3 mn = min(min(n1, n2), min(n3, n4));
        vec3 mx = max(max(n1, n2), max(n3, n4));
        vec3 avg = (n1 + n2 + n3 + n4) * 0.25;
        c = clamp(c + (c - avg) * Sharpen * 2.0, mn, mx * 1.05 + 0.02);
    }

    // Leuchten dazu
    c += texture(BloomSampler, uv).rgb * BloomStrength;

    // Weissabgleich und Belichtung
    c *= Balance.rgb * Exposure;

    // Filmkurve
    if (Tonemap > 0.0) {
        c = mix(c, aces(c * 1.35), Tonemap);
    }

    // Kontrast (weiche S-Kurve)
    c = clamp(c, 0.0, 1.0);
    if (Contrast >= 1.0) {
        c = mix(c, c * c * (3.0 - 2.0 * c), clamp((Contrast - 1.0) * 2.5, 0.0, 1.0));
    } else {
        c = mix(vec3(0.5), c, Contrast);
    }

    // Farbstimmung: Schatten und Lichter getrennt toenen
    float l = luma(c);
    float ws = 1.0 - smoothstep(0.0, 0.55, l);
    float wh = smoothstep(0.45, 1.0, l);
    c += (ShadowTint.rgb - vec3(dot(ShadowTint.rgb, vec3(1.0 / 3.0)))) * ShadowTint.a * ws;
    c += (HighlightTint.rgb - vec3(dot(HighlightTint.rgb, vec3(1.0 / 3.0)))) * HighlightTint.a * wh;

    // Saettigung + Lebendigkeit (bunte Stellen weniger, graue mehr)
    l = luma(c);
    float sat = max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b));
    c = mix(vec3(l), c, Saturation * (1.0 + Vibrance * (1.0 - sat)));

    // Nachtsichtgeraet
    if (NightVision > 0.0) {
        float nl = pow(clamp(luma(c) * 2.4, 0.0, 1.0), 0.75);
        vec3 nv = mix(vec3(0.01, 0.05, 0.02), vec3(0.62, 1.0, 0.68), nl);
        nv *= 0.93 + 0.07 * sin(uv.y * size.y * 1.8);
        float tube = smoothstep(0.62, 0.38, length((uv - 0.5) * vec2(size.x / size.y, 1.0)));
        c = mix(c, nv * tube, NightVision);
    }

    // Comic: Farbstufen und dunkle Umrisse
    if (Posterize > 1.0) {
        c = floor(c * Posterize + 0.5) / Posterize;
    }
    if (Outline > 0.0) {
        float e = abs(luma(n1) - luma(n2)) + abs(luma(n3) - luma(n4));
        c *= 1.0 - smoothstep(0.08, 0.25, e) * Outline;
    }

    // Verblasste Schwarztoene (Film-Look)
    c = c * (1.0 - Fade) + Fade;

    // Vignette
    if (Vignette > 0.0) {
        vec2 d = (uv - 0.5) * vec2(size.x / size.y, 1.0);
        c *= 1.0 - Vignette * smoothstep(0.35, 1.0, length(d) * 1.25);
    }

    // Filmkorn (bewegt sich mit der Spielzeit)
    if (Grain > 0.0) {
        float g = hash(uv * size + fract(GameTime * 1200.0) * 517.0) - 0.5;
        c += g * Grain;
    }

    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
