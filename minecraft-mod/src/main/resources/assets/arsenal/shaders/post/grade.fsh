#version 330

uniform sampler2D InSampler;

in vec2 texCoord;

layout(std140) uniform SamplerInfo {
    vec2 OutSize;
    vec2 InSize;
};

layout(std140) uniform GradeConfig {
    vec4 Tint;
    float Saturation;
    float Contrast;
    float Brightness;
    float Vignette;
    float Sharpen;
    float Posterize;
    float Gamma;
};

out vec4 fragColor;

void main() {
    vec2 px = 1.0 / InSize;
    vec3 c = texture(InSampler, texCoord).rgb;
    if (Sharpen > 0.0) {
        vec3 n = texture(InSampler, texCoord + vec2(px.x, 0.0)).rgb
               + texture(InSampler, texCoord - vec2(px.x, 0.0)).rgb
               + texture(InSampler, texCoord + vec2(0.0, px.y)).rgb
               + texture(InSampler, texCoord - vec2(0.0, px.y)).rgb;
        c = c + Sharpen * (c * 4.0 - n);
    }
    c = pow(max(c, vec3(0.0)), vec3(Gamma));
    c *= Brightness;
    c = (c - 0.5) * Contrast + 0.5;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, Saturation);
    c = mix(c, c * Tint.rgb, Tint.a);
    if (Posterize > 1.0) {
        c = floor(c * Posterize + 0.5) / Posterize;
    }
    if (Vignette > 0.0) {
        vec2 d = texCoord - 0.5;
        c *= 1.0 - Vignette * smoothstep(0.3, 0.85, length(d) * 1.3);
    }
    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
