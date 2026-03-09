// ./debugEnhancementMap.js
/* 
What the Heatmap Shows
Brightness indicates where enhancement is strongest.

Pixel-brightness	    Meaning
dark	                no-enhancement
gray	                moderate-contrast-change
bright	                strong-enhancement

You should typically see: in pacev3.js
edges → bright
texture → medium
flat areas → dark

Optional Super Debug Trick (very useful for pacev3.js to tune paramters like tau, k, alpha, beta, lamda)
You can also debug each gate separately.

Example:
debuggingEnhancementMap(
    edgeGainMap,
    edgeGainMap,
    edgeGainMap,
    edgeGainMap,
    width,
    height
);
This shows only the edge gate behavior.

Do the same for:
compressed
lumMask
alphaMap
*/
export function debuggingEnhancementMap(
    edgeGain,
    compressed,
    lumMask,
    contrastGain,
    width,
    height
) {

    const n = width * height;

    const debugMap = new Float32Array(n);

    let maxVal = 0;

    // compute enhancement strength
    for (let i = 0; i < n; i++) {

        const enhancement =
            Math.abs(
                edgeGain[i] *
                compressed[i] *
                lumMask[i] *
                contrastGain[i]
            );

        debugMap[i] = enhancement;

        if (enhancement > maxVal) maxVal = enhancement;
    }

    const heatmap = new Uint8ClampedArray(n * 4);

    const invMax = 1 / (maxVal + 1e-12);

    // normalize + convert to grayscale RGBA
    for (let i = 0; i < n; i++) {

        const v = Math.floor(debugMap[i] * invMax * 255);

        const p = i * 4;

        heatmap[p] = v;
        heatmap[p + 1] = v;
        heatmap[p + 2] = v;
        heatmap[p + 3] = 255;
    }

    return new ImageData(heatmap, width, height);

}


export function visualizeAlphaMap(alphaMap, width, height) {
    const alphaVis = new Uint8ClampedArray(width * height * 4);

    for (let i = 0; i < alphaMap.length; i++) {

        const v = Math.floor(alphaMap[i] * 255);

        const p = i * 4;

        alphaVis[p] = v;
        alphaVis[p + 1] = v;
        alphaVis[p + 2] = v;
        alphaVis[p + 3] = 255;
    }
    return new ImageData(alphaVis, width, height);
}