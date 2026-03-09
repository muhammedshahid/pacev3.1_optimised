// ./computeGlobalFeatures.js
const HIST_BINS = 512;
const LOG2_BINS = 9; // log2(512)
const EPS = 1e-12;

function computeDistribution(L) {

    const n = L.length;
    const hist = new Float32Array(HIST_BINS);

    let sum = 0;
    let sumSq = 0;

    for (let i = 0; i < n; i++) {
        const v = L[i];
        sum += v;
        sumSq += v * v;

        const bin = Math.min(HIST_BINS - 1, (v * (HIST_BINS - 1)) | 0);
        hist[bin]++;
    }

    const mean = sum / n;
    const variance = Math.max(0, (sumSq / n) - (mean * mean));
    const std = Math.sqrt(variance);

    // Higher moments
    let skewAcc = 0;
    let kurtAcc = 0;

    for (let i = 0; i < n; i++) {
        const d = L[i] - mean;
        const d2 = d * d;
        skewAcc += d2 * d;
        kurtAcc += d2 * d2;
    }

    const skewness = skewAcc / (n * Math.pow(std + EPS, 3));
    const kurtosis = kurtAcc / (n * Math.pow(std + EPS, 4));

    // Entropy + CDF
    let entropy = 0;
    const invN = 1 / n;
    let cumulative = 0;

    let p5 = 0;
    let p95 = 0;
    let shadowCount = 0;
    let highlightCount = 0;

    for (let i = 0; i < HIST_BINS; i++) {
        const p = hist[i] * invN;

        if (p > 0) {
            entropy -= p * Math.log2(p + EPS);
        }

        cumulative += p;

        if (!p5 && cumulative >= 0.05) {
            p5 = i / (HIST_BINS - 1);
        }

        if (!p95 && cumulative >= 0.95) {
            p95 = i / (HIST_BINS - 1);
        }
    }

    const dynamicRange = p95 - p5;
    const normalizedEntropy = entropy / LOG2_BINS;

    for (let i = 0; i < n; i++) {
        if (L[i] < 0.2) shadowCount++;
        if (L[i] > 0.8) highlightCount++;
    }

    return {
        mean,
        variance,
        std,
        skewness,
        kurtosis,
        entropy: normalizedEntropy,
        dynamicRange,
        shadowRatio: shadowCount / n,
        highlightRatio: highlightCount / n
    };
}

function computeStructure(L, width, height) {
    let sumGrad = 0;
    let sumGradSq = 0;
    let count = 0;

    for (let y = 1; y < height; y++) {
        for (let x = 1; x < width; x++) {

            const i = y * width + x;

            const gx = L[i] - L[i - 1];
            const gy = L[i] - L[i - width];

            // using Alpha-Max + Beta-Min approx. technique instead of Euclidean distance for speed & cost
            const ax = Math.abs(gx);
            const ay = Math.abs(gy);

            const max = ax > ay ? ax : ay;
            const min = ax > ay ? ay : ax;

            const grad = max + 0.25 * min;

            sumGrad += grad;
            sumGradSq += grad * grad;
            count++;
        }
    }

    const meanGradient = sumGrad / count;
    const gradientVariance = (sumGradSq / count) - (meanGradient * meanGradient);

    // Normalize edge density (empirical scaling) this approach is not true
    // const edgeDensity = Math.min(1, meanGradient * 4);

    const textureIndex = gradientVariance / (meanGradient + EPS);

    return {
        meanGradient,
        gradientVariance,
        // edgeDensity,
        textureIndex
    };
}

function computeNoise(L, width, height, variance_L) {

    let sumNoise = 0;
    let sumLocalVar = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {

            const i = y * width + x;

            const localMean =
                (L[i - 1] +
                    L[i + 1] +
                    L[i - width] +
                    L[i + width]) * 0.25;

            const diff = Math.abs(L[i] - localMean);

            sumNoise += diff;
            sumLocalVar += diff * diff;
            count++;
        }
    }

    const noiseMean = sumNoise / count;
    const noiseRatio = noiseMean / (variance_L + EPS);
    const microContrast = sumLocalVar / count;

    return {
        noiseMean,
        noiseRatio,
        microContrast
    };
}

export function extractGlobalFeatures(L, width, height) {

    const distribution = computeDistribution(L);
    const structure = computeStructure(L, width, height);
    const noise = computeNoise(L, width, height, distribution.variance);

    const rawEdge = structure.meanGradient;
    const noiseAdjusted = rawEdge / (1 + 0.5 * noise.noiseRatio);
    const edgeDensity = noiseAdjusted / (noiseAdjusted + 0.25); // soft normalization
    structure.edgeDensity = edgeDensity;

    const featureVector = [
        distribution.mean,
        distribution.variance,
        distribution.skewness,
        distribution.kurtosis,
        distribution.entropy,
        distribution.dynamicRange,
        distribution.shadowRatio,
        distribution.highlightRatio,
        structure.edgeDensity,
        structure.textureIndex,
        noise.noiseRatio,
        noise.microContrast
    ];

    return {
        distribution,
        structure,
        noise,
        featureVector
    };
}