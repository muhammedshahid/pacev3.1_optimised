// ./computeAdaptiveParameters.js

function computeLambda(features) {

    const { distribution, structure, noise } = features;

    const {
        variance,
        dynamicRange
    } = distribution;

    const {
        edgeDensity,
        textureIndex
    } = structure;

    const {
        noiseRatio,
        microContrast
    } = noise;

    // ---- contrast strength ----
    const contrastStrength =
        0.6 * Math.sqrt(variance) +
        0.5 * dynamicRange +
        0.4 * edgeDensity;

    // ---- noise energy ----
    const noiseEnergy =
        noiseRatio +
        0.7 * microContrast;

    // ---- lambda raw ----
    let lambda =
        0.3 +
        0.8 * (1 - contrastStrength) +
        1.2 * noiseEnergy +
        0.4 * textureIndex;

    // smooth clamp
    lambda = lambda / (1 + lambda);

    return lambda;
}

function computeBeta(features) {

    const {
        highlightRatio,
        shadowRatio,
        skewness,
        dynamicRange,
        mean
    } = features.distribution;

    const highlightDominance =
        highlightRatio +
        0.4 * Math.max(0, skewness) +
        0.3 * mean +
        0.2 * dynamicRange;

    const shadowCompensation =
        0.5 * shadowRatio;

    const x =
        highlightDominance - shadowCompensation;

    let beta =
        0.8 * (x / (1 + Math.abs(x)));

    return beta;
}

function computeTau(variance, entropy) {

    const contrastFactor = 1 - Math.sqrt(variance);
    const entropyFactor = 1 - entropy * 0.5;

    const tau =
        0.35 +
        0.8 * contrastFactor * entropyFactor;

    return Math.min(1.2, Math.max(0.35, tau));
}

function computeEdgeK(noiseRatio) {

    const k =
        0.015 + 0.25 * noiseRatio;

    return Math.min(0.25, Math.max(0.01, k));
}

function computePerceptualParams(features) {

    const lambda = computeLambda(features);
    const beta = computeBeta(features);
    const tau = computeTau(features.distribution.variance, features.distribution.entropy);
    const edgeStabilizer = computeEdgeK(features.noise.noiseRatio);

    return { lambda, beta, tau, edgeStabilizer };
}

function computeControlParams(features) {
    const {
        distribution,
        structure,
        noise
    } = features;

    const entropy = distribution.entropy;
    const dynamicRange = distribution.dynamicRange;
    const shadowRatio = distribution.shadowRatio;
    const highlightRatio = distribution.highlightRatio;

    const edgeDensity = structure.edgeDensity;
    const noiseRatio = noise.noiseRatio;

    // ---- Control Axes ----

    const contrastNeed =
        (1 - entropy) * (1 - dynamicRange);

    const structureConfidence =
        edgeDensity / (1 + noiseRatio);

    const imbalance =
        Math.abs(shadowRatio - highlightRatio);

    // ---- Alpha ----

    const alphaRaw =
        0.5 * imbalance +
        0.3 * contrastNeed +
        0.4 * structureConfidence;

    const globalAlpha =
        alphaRaw / (alphaRaw + 0.5);

    // ---- Tile Size ----

    const granularity =
        structureConfidence - 0.5 * noiseRatio;

    let tileSize =
        32 - 16 * granularity;

    tileSize = Math.max(8, Math.min(64, tileSize));

    // round to multiple of 8
    tileSize = Math.round(tileSize / 8) * 8;

    // ---- Clip Limit ----

    const clipLimit =
        0.02 + 0.08 * structureConfidence;

    return {
        globalAlpha,
        tileSize,
        clipLimit,
        internal: {
            contrastNeed,
            structureConfidence,
            imbalance
        }
    };
}

export function computeAdaptiveParams(features) {

    const controlParams = computeControlParams(features);
    const perceptualParams = computePerceptualParams(features);

    return {
        controlParams: controlParams,
        perceptualParams: perceptualParams
    }
}