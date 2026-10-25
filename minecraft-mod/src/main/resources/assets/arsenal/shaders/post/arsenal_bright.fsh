#version 330

// Helle Stellen herausfiltern (fuer das Leuchten / Bloom), dabei leicht weichzeichnen.
uniform sampler2D InSampler;

layout(std140) uniform BrightConfig {
    float Threshold;
    float Knee;
};

in vec2 texCoord;

out vec4 fragColor;

void main() {
    vec2 o = 1.0 / vec2(textureSize(InSampler, 0));
    vec3 c = texture(InSampler, texCoord + vec2(-o.x, -o.y)).rgb
           + texture(InSampler, texCoord + vec2( o.x, -o.y)).rgb
           + texture(InSampler, texCoord + vec2(-o.x,  o.y)).rgb
           + texture(InSampler, texCoord + vec2( o.x,  o.y)).rgb;
    c *= 0.25;
    float l = max(c.r, max(c.g, c.b));
    float w = smoothstep(Threshold, Threshold + Knee, l);
    fragColor = vec4(c * w, 1.0);
}
