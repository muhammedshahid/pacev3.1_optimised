const LOG_LUT_SIZE = 4096;
const LOG_LUT = new Float32Array(LOG_LUT_SIZE);

for (let i = 0; i < LOG_LUT_SIZE; i++) {
    const x = i / (LOG_LUT_SIZE - 1);
    LOG_LUT[i] = Math.log(x + 1e-6);
}

function fastLog(x) {
    const idx = (x * (LOG_LUT_SIZE - 1)) | 0;
    if (idx >= 0 && idx < LOG_LUT_SIZE) return LOG_LUT[idx];
    return Math.log(x);
}

const POW_LUT_SIZE = 4096;

const POW07 = new Float32Array(POW_LUT_SIZE);
const POW08 = new Float32Array(POW_LUT_SIZE);

for (let i = 0; i < POW_LUT_SIZE; i++) {

    const x = i / (POW_LUT_SIZE - 1);

    POW07[i] = x ** 0.7;
    POW08[i] = x ** 0.8;
}

function pow07(x) {
    const idx = (x * (POW_LUT_SIZE - 1)) | 0;
    if (idx >= 0 && idx < POW_LUT_SIZE) return POW07[idx];
    return x ** 0.7;
}

function pow08(x) {
    const idx = (x * (POW_LUT_SIZE - 1)) | 0;
    if (idx >= 0 && idx < POW_LUT_SIZE) return POW08[idx];
    return x ** 0.8;
}

const EPS = 1e-6;

export function applyBlending(L, Lclahe, width, height, maps, globalAlpha, perceptualParams) {

    const size = L.length;
    const Lenhanced = new Float32Array(size);

    const { lambda, beta, tau, edgeStabilizer } = perceptualParams;

    const edgeMap = maps.edgeMap;
    const skinDampMap = maps.skinDampMap;
    const structureMask = maps.structureMask;
    const Lsmall = maps.Lsmall;
    const Lmedium = maps.Lmedium;
    const alphaMap = maps.smoothLocalAlphaMap;

    const w = width;

    for (let y = 1; y < height - 1; y++) {

        let row = y * w;

        for (let x = 1; x < width - 1; x++) {

            const i = row + x;

            const Li = L[i];

            let a = alphaMap[i];
            if (a < 0) a = 0;
            else if (a > 1) a = 1;

            const finalAlpha = globalAlpha * (0.8 + 0.8 * a);

            // --- Retinex ---
            const reflectance =
                fastLog(Lsmall[i]) -
                fastLog(Lmedium[i]);

            let detailMask = reflectance * 0.8 + 0.5;

            if (detailMask < 0) detailMask = 0;
            else if (detailMask > 1) detailMask = 1;

            const structureBoost = pow07(structureMask[i]);

            // --- Laplacian ---
            const localMean =
                (Lsmall[i - 1] +
                 Lsmall[i + 1] +
                 Lsmall[i - w] +
                 Lsmall[i + w]) * 0.25;

            const edge = Math.abs(edgeMap[i]);

            const textureMask = edge / (edge + 0.015 + EPS);

            let deltaDetail = (Lsmall[i] - localMean) * textureMask;

            if (deltaDetail < -0.25) deltaDetail = -0.25;
            else if (deltaDetail > 0.25) deltaDetail = 0.25;

            const deltaClahe = Lclahe[i] - Li;

            const edgeAdaptive = edge / (edge + 0.03 + EPS);

            let delta =
                deltaClahe +
                0.45 *
                deltaDetail *
                detailMask *
                skinDampMap[i] *
                structureBoost *
                edgeAdaptive;

            if (delta < -0.5) delta = -0.5;
            else if (delta > 0.5) delta = 0.5;

            const deltaStable =
                delta / (1 + 2 * Math.abs(delta) + EPS);

            const deltaLimited =
                deltaStable /
                (1 + Math.abs(deltaStable) /
                (tau * (0.5 + Li)));

            const compressed =
                deltaLimited /
                (1 + lambda * Math.abs(deltaLimited));

            const kAdaptive = edgeStabilizer / (1 + finalAlpha);

            const edgeResponse =
                edge / (edge + kAdaptive + EPS);

            const edgeGain =
                pow08(edgeResponse) *
                (1 + 0.6 * edgeResponse);

            let lumMask = 1 - beta * Li;
            if (lumMask < 0.15) lumMask = 0.15;

            const contrastGain =
                1 + finalAlpha * (1 - 0.5 * Li);

            let enhanced =
                Li +
                compressed *
                edgeGain *
                lumMask *
                contrastGain;

            if (!Number.isFinite(enhanced))
                enhanced = Li;

            if (enhanced < 0) enhanced = 0;
            else if (enhanced > 1) enhanced = 1;

            Lenhanced[i] = enhanced;
        }
    }

    return Lenhanced;
}