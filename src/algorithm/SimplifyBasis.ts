export default class SimplifyBasis {

    public static simplify(vectors: number[][]): number[][] {
        // row reduce left to right
        for (let i = 0; i < vectors.length; i++) {
            let reductionVector = vectors[i];

            let j = 0;
            while (j < reductionVector.length &&  Math.abs(reductionVector[j]) < 0.00001) j++;

            for (let k = i + 1; k < vectors.length; k++) {
                let a = -vectors[k][j] / reductionVector[j];
                vectors[k] = SimplifyBasis.lcomb(vectors[k], reductionVector, a);
            }
        }
        // row reduce right to left
        for (let i = vectors.length - 1; i >= 0; i--) {
            let reductionVector = vectors[i];

            let j = 0;
            while (j < reductionVector.length && Math.abs(reductionVector[j]) < 0.00001) j++;

            for (let k = i - 1; k >= 0; k--) {
                let a = -vectors[k][j] / reductionVector[j];
                vectors[k] = SimplifyBasis.lcomb(vectors[k], reductionVector, a);
            }
        }
        // normalize
        for (let i = 0; i < vectors.length; i++) {
            let vec = vectors[i];

            let absmax = vec.reduce((acc, x) => Math.max(acc, Math.abs(x)), 0);
            let sign = Math.sign(vec.reduce((acc, x) => acc + x, 0));

            vectors[i] = vec.map(x => x / absmax * sign);
        }
        return vectors;
    }

    private static lcomb(u: number[], v: number[], a: number): number[] {
        return u.map((x, i) => x + a * v[i]);
    }

    private static score(basis: number[][]): number {
        return basis.reduce((a, b) => 
            a + b.reduce((x, y) => x + (Math.abs(y) < 0.00001 ? 1 : 0), 0), 0);
    }

    private static prettyPrint(basis: number[][]): string {
        return basis.map(x => x.map(y => y.toFixed(2).padStart(6))).join("\n");
    }
}