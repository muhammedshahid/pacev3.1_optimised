// ./maps.js
import * as blur from "../utils/blur_optimised.js";

const EPS = 1e-12;

function computeGradient(L, width, height) { 
    const gx = new Float32Array(L.length);
    const gy = new Float32Array(L.length);

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

export function computeLocalAlphaMap(L, width, height, globalAlpha, globalNoiseRatio, tileSize) {

    const alphaMap = new Float32Array(width * height);

    const k = 0.7 * globalNoiseRatio + 0.05;

    const strength = 1.2; // local modulation strength

    for (let ty = 0; ty < height; ty += tileSize) {
        for (let tx = 0; tx < width; tx += tileSize) {

            const xEnd = Math.min(tx + tileSize, width);
            const yEnd = Math.min(ty + tileSize, height);

            let sumGrad = 0;
            let sumGradSq = 0;
            let sumNoise = 0;
            let sumL = 0;
            let count = 0;

            for (let y = ty + 1; y < yEnd - 1; y++) {
                for (let x = tx + 1; x < xEnd - 1; x++) {

                    const i = y * width + x;

                    // gradient
                    const gx = L[i] - L[i - 1];
                    const gy = L[i] - L[i - width];

                    const ax = Math.abs(gx);
                    const ay = Math.abs(gy);

                    const max = ax > ay ? ax : ay;
                    const min = ax > ay ? ay : ax;

                    const grad = max + 0.25 * min;

                    sumGrad += grad;
                    sumGradSq += grad * grad;

                    // local noise
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

            const meanGrad = sumGrad / count;
            const gradVar = sumGradSq / count - meanGrad * meanGrad;
            const coherence = meanGrad / (Math.sqrt(gradVar) + 1e-6);
            const noiseMean = sumNoise / count;
            const meanL = sumL / count;

            // const S = meanGrad / (1 + noiseMean);
            const S = (meanGrad * coherence) / (1 + noiseMean);

            const structureConfidence = S / (S + k + EPS);

            // const luminanceFactor = Math.sqrt(meanL);
            const luminanceFactor = 0.6 + 0.4 * Math.sqrt(meanL);

            const localConfidence = structureConfidence * luminanceFactor;

            // ---- centered alpha model ----

            const tileAlpha = globalAlpha * (1 + strength * (localConfidence - 0.5));

            const clampedAlpha = Math.max(0.05, Math.min(2.0 * globalAlpha, tileAlpha));

            for (let y = ty; y < yEnd; y++) {
                for (let x = tx; x < xEnd; x++) {
                    alphaMap[y * width + x] = clampedAlpha;
                }
            }
        }
    }

    return alphaMap;
}

export function computeEdgeMap(L, width, height) {

    const edge = new Float32Array(width * height);

    for (let y = 1; y < height; y++) {
        for (let x = 1; x < width; x++) {

            const i = y * width + x;

            // gradient
            const gx = L[i] - L[i - 1];
            const gy = L[i] - L[i - width];

            const ax = Math.abs(gx);
            const ay = Math.abs(gy);

            const max = ax > ay ? ax : ay;
            const min = ax > ay ? ay : ax;

            edge[i] = max + 0.25 * min;
        }
    }

    return edge;
}


export function computeSkinDampMap(L, width, height) {

    const n = width * height
    const map = new Float32Array(n)

    const mid = 0.5
    const sigma = 0.18
    const denom = 2 * sigma * sigma

    for (let i = 0; i < n; i++) {

        const d = L[i] - mid
        const suppression = Math.exp(-(d * d) / denom)

        map[i] = 1 - 0.7 * suppression
    }

    return map
}

export function computeStructureMask(L, width, height) {
    const mask = new Float32Array(L.length);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {

            const i = y * width + x;

            //gradient
            const gx = L[i + 1] - L[i - 1];
            const gy = L[i + width] - L[i - width];

            const grad = Math.sqrt(gx * gx + gy * gy);

            mask[i] = grad;
        }
    }

    // normalize
    let max = 0;
    for (let i = 0; i < mask.length; i++) {
        if (mask[i] > max) max = mask[i];
    }

    for (let i = 0; i < mask.length; i++) {
        mask[i] = mask[i] / (max + 1e-6);
    }

    return mask;
}

export function computeControlMaps(L, width, height, globalAlpha, globalNoiseRatio, tileSize) {
    const localAlphaMap = computeLocalAlphaMap(L, width, height, globalAlpha, globalNoiseRatio, tileSize);
    const edgeMap = computeEdgeMap(L, width, height);
    const skinDampMap = computeSkinDampMap(L, width, height);
    const structureMask = computeStructureMask(L, width, height);

    const smoothLocalAlphaMap = blur.guidedAlphaSmoothing(localAlphaMap, L, width, height);
    const Lsmall = blur.smooth3x3(L, width, height);  // noise suppression
    const Lmedium = blur.smooth5x5(Lsmall, width, height); // illumination estimate for retinex
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
