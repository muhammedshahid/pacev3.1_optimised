export function boxBlurAlphaMap(alphaMap, width, height) {
    const out = new Float32Array(alphaMap.length);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            let sum = 0;
            sum += alphaMap[i];
            sum += alphaMap[i - 1];
            sum += alphaMap[i + 1];
            sum += alphaMap[i - width];
            sum += alphaMap[i + width];
            sum += alphaMap[i - width - 1];
            sum += alphaMap[i - width + 1];
            sum += alphaMap[i + width - 1];
            sum += alphaMap[i + width + 1];
            out[i] = sum / 9;
        }
    }
    return out;
} 
/* Recommended parameters Start with: sigma = 0.1 radius = 1 If alpha transitions look too sharp: sigma = 0.15 If edges leak: sigma = 0.05 */
export function guidedAlphaSmoothing(alphaMap, L, width, height) {
    const out = new Float32Array(alphaMap.length);
    const sigma = 0.1; // edge sensitivity 
    const radius = 1; // 3x3 window 
    for (let y = radius; y < height - radius; y++) {
        for (let x = radius; x < width - radius; x++) {
            const i = y * width + x;
            const centerL = L[i];
            let sum = 0;
            let wsum = 0;
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dx = -radius; dx <= radius; dx++) {
                    const j = (y + dy) * width + (x + dx);
                    const diff = L[j] - centerL;
                    const w = Math.exp(-(diff * diff) / sigma);
                    sum += alphaMap[j] * w;
                    wsum += w;
                }
            }
            out[i] = sum / (wsum + 1e-12);
        }
    }
    return out;
}
export function smooth3x3(L, width, height) {
    const out = new Float32Array(L.length);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const sum = L[i] * 4 + (L[i - 1] + L[i + 1] + L[i - width] + L[i + width]) * 2 + (L[i - width - 1] + L[i - width + 1] + L[i + width - 1] + L[i + width + 1]);
            out[i] = sum / 16;
        }
    }
    return out;
}
export function smooth5x5(L, width, height) {
    const out = new Float32Array(L.length);
    for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
            const i = y * width + x;
            let sum = 0;
            let count = 0;
            for (let dy = -2; dy <= 2; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    sum += L[i + dy * width + dx];
                    count++;
                }
            }
            out[i] = sum / count;
        }
    }
    return out;
}
export function smooth7x7(L, width, height) {
    const temp = new Float32Array(L.length);
    const out = new Float32Array(L.length);
    const w0 = 1,
        w1 = 6,
        w2 = 15,
        w3 = 20;
    const norm = 64; 
    // horizontal pass 
    for (let y = 0; y < height; y++) {
        for (let x = 3; x < width - 3; x++) {
            const i = y * width + x;
            temp[i] = (w0 * (L[i - 3] + L[i + 3]) + w1 * (L[i - 2] + L[i + 2]) + w2 * (L[i - 1] + L[i + 1]) + w3 * L[i]) / norm;
        }
    } 
    // vertical pass 
    for (let y = 3; y < height - 3; y++) {
        for (let x = 0; x < width; x++) {
            const i = y * width + x;
            out[i] = (w0 * (temp[i - 3 * width] + temp[i + 3 * width]) + w1 * (temp[i - 2 * width] + temp[i + 2 * width]) + w2 * (temp[i - width] + temp[i + width]) + w3 * temp[i]) / norm;
        }
    }
    return out;
}