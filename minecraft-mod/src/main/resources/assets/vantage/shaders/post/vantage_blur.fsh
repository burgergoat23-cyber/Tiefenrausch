#version 330

// Gauss-Weichzeichner in eine Richtung (zwei Durchgaenge = rundes Leuchten).
uniform sampler2D InSampler;

layout(std140) uniform ArsenalBlur {
    vec2 Dir;
    float Spread;
};

in vec2 texCoord;

out vec4 fragColor;

void main() {
    vec2 stepUv = Dir * Spread / vec2(textureSize(InSampler, 0));
    float w0 = 0.227027;
    float w[4] = float[](0.1945946, 0.1216216, 0.054054, 0.016216);
    vec3 sum = texture(InSampler, texCoord).rgb * w0;
    for (int i = 0; i < 4; i++) {
        float d = float(i + 1);
        sum += texture(InSampler, texCoord + stepUv * d).rgb * w[i];
        sum += texture(InSampler, texCoord - stepUv * d).rgb * w[i];
    }
    fragColor = vec4(sum, 1.0);
}
