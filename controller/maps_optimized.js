// ./maps.js
// import * as blur from "../utils/blur_optimised.js";
import { blur } from "../utils/index.js"

const EPS = 1e-12;

/* -------------------------------------------------- */
/* Skin LUT (computed once) */
/* -------------------------------------------------- */

const LUT_SIZE = 1024;
const skinLUT = new Float32Array(LUT_SIZE);

const mid = 0.5;
const sigma = 0.18;
const denom = 2 * sigma * sigma;

for (let i = 0; i < LUT_SIZE; i++) {
    const L = i / (LUT_SIZE - 1);
    const d = L - mid;
    skinLUT[i] = 1 - 0.7 * Math.exp(-(d * d) / denom);
}

/* -------------------------------------------------- */
/* Gradient computation (single pass) */
/* -------------------------------------------------- */

// function computeGradient(L, width, height) {
//     const n = L.length;
//     const gx = new Float32Array(n);
//     const gy = new Float32Array(n);

//     for (let y = 1; y < height - 1; y++) {
//         const row = y * width;

//         for (let x = 1; x < width - 1; x++) {
//             const i = row + x;

//             // central diff
//             gx[i] = L[i + 1] - L[i - 1];
//             gy[i] = L[i + width] - L[i - width];
//         }
//     }
//     return { gx, gy };
// }

function computeGradient(L, width, height) {
    const n = L.length;
    const gx = new Float32Array(n);
    const gy = new Float32Array(n);

    for (let y = 1; y < height; y++) {
        const row = y * width;

        for (let x = 1; x < width; x++) {
            const i = row + x;

            // forward diff
            gx[i] = L[i] - L[i - 1];
            gy[i] = L[i] - L[i - width];
        }
    }
    return { gx, gy };
}

/* -------------------------------------------------- */
/* Edge + Structure + Skin in single traversal */
/* -------------------------------------------------- */

function computeMaps(L, gx, gy, width, height) {

    const n = L.length;

    const edgeMap = new Float32Array(n);
    const structureMask = new Float32Array(n);
    const skinDampMap = new Float32Array(n);

    let maxStruct = 0;

    for (let i = 0; i < n; i++) {

        const ax = Math.abs(gx[i]);
        const ay = Math.abs(gy[i]);

        const max = ax > ay ? ax : ay;
        const min = ax > ay ? ay : ax;

        const grad = max + 0.25 * min;

        edgeMap[i] = grad;

        const struct = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
        structureMask[i] = struct;

        if (struct > maxStruct) maxStruct = struct;

        const idx = (L[i] * (LUT_SIZE - 1)) | 0;
        skinDampMap[i] = skinLUT[idx];
    }

    const invMax = 1 / (maxStruct + 1e-6);

    for (let i = 0; i < n; i++) {
        structureMask[i] *= invMax;
    }

    return { edgeMap, structureMask, skinDampMap };
}

/* -------------------------------------------------- */
/* Local Alpha Map */
/* -------------------------------------------------- */

function computeLocalAlphaMap(L, gx, gy, width, height, globalAlpha, globalNoiseRatio, tileSize) {

    const alphaMap = new Float32Array(width * height);

    const k = 0.7 * globalNoiseRatio + 0.05;
    const strength = 1.2;

    for (let ty = 0; ty < height; ty += tileSize) {

        const yEnd = Math.min(ty + tileSize, height);

        for (let tx = 0; tx < width; tx += tileSize) {

            const xEnd = Math.min(tx + tileSize, width);

            let sumGrad = 0;
            let sumGradSq = 0;
            let sumNoise = 0;
            let sumL = 0;
            let count = 0;

            for (let y = ty + 1; y < yEnd - 1; y++) {

                const row = y * width;

                for (let x = tx + 1; x < xEnd - 1; x++) {

                    const i = row + x;

                    const ax = Math.abs(gx[i]);
                    const ay = Math.abs(gy[i]);

                    const max = ax > ay ? ax : ay;
                    const min = ax > ay ? ay : ax;

                    const grad = max + 0.25 * min;

                    sumGrad += grad;
                    sumGradSq += grad * grad;

                    const localMean =
                        (L[i - 1] +
                            L[i + 1] +
                            L[i - width] +
                            L[i + width]) * 0.25;

                    const diff = Math.abs(L[i] - localMean);

                    sumNoise += diff;

                    sumL += L[i];

                    count++;
                }
            }

            if (count === 0) continue;

            const invCount = 1 / count;

            const meanGrad = sumGrad * invCount;
            const gradVar = sumGradSq * invCount - meanGrad * meanGrad;
            const coherence = meanGrad / (Math.sqrt(gradVar) + 1e-6);
            const noiseMean = sumNoise * invCount;
            const meanL = sumL * invCount;

            const S = (meanGrad * coherence) / (1 + noiseMean);

            const structureConfidence = S / (S + k + EPS);

            const luminanceFactor = 0.6 + 0.4 * Math.sqrt(meanL);

            const localConfidence = structureConfidence * luminanceFactor;

            const tileAlpha = globalAlpha * (1 + strength * (localConfidence - 0.5));

            const clampedAlpha = Math.max(0.05, Math.min(2 * globalAlpha, tileAlpha));

            for (let y = ty; y < yEnd; y++) {

                const row = y * width;

                for (let x = tx; x < xEnd; x++) {

                    alphaMap[row + x] = clampedAlpha;
                }
            }
        }
    }

    return alphaMap;
}

/* -------------------------------------------------- */
/* Control Maps Pipeline */
/* -------------------------------------------------- */

export function computeControlMaps(L, width, height, globalAlpha, globalNoiseRatio, tileSize) {

    const { gx, gy } = computeGradient(L, width, height);

    const { edgeMap, structureMask, skinDampMap } = computeMaps(L, gx, gy, width, height);

    const localAlphaMap = computeLocalAlphaMap(L, gx, gy, width, height, globalAlpha, globalNoiseRatio, tileSize);

    const smoothLocalAlphaMap = blur.guidedAlphaSmoothing(localAlphaMap, L, width, height);

    const Lsmall = blur.smooth3x3(L, width, height);
    const Lmedium = blur.smooth5x5(Lsmall, width, height);

    return {
        localAlphaMap,
        edgeMap,
        skinDampMap,
        structureMask,
        smoothLocalAlphaMap,
        Lsmall,
        Lmedium
    };
}