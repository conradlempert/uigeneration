import * as PCA from "pca-js";
import SimplifyBasis from "./SimplifyBasis";
import * as math from "mathjs";
import SvgToCommands, { ArcCommand, LineCommand } from "./SvgToCommands";
import PathShape from "../dataTypes/PathShape";
import AutoShape, { CommandType } from "../dataTypes/AutoShape";
export default class PCAShapeExtractor {

    public static run(shapeData: PathShape[]): AutoShape {

        console.log("shapeData", shapeData);

        if (!shapeData) return;
        if (shapeData.length == 0) return;

        const topology = shapeData[0].commands.map(
            command => SvgToCommands.isArc(command) ? 
                CommandType.Arc : CommandType.Line
        );

        const shapeDataVectors: {name: string, vector: number[]}[] = new Array();

        for (const pathShape of shapeData) {
            const shapeCommands = pathShape.commands;
            if (shapeCommands.length != topology.length) {
                throw new Error("Shapes must have the same topology");
            }

            for (let i = 0; i < shapeCommands.length; i++) {
                if (!SvgToCommands.isArc(shapeCommands[i]) && !SvgToCommands.isLine(shapeCommands[i])) {
                    throw new Error("Shape must be composed of lines and arcs");
                }

                if (SvgToCommands.isArc(shapeCommands[i]) && topology[i] != CommandType.Arc) {
                    throw new Error("Shapes must have the same topology");
                }

                if (SvgToCommands.isLine(shapeCommands[i]) && topology[i] != CommandType.Line) {
                    throw new Error("Shapes must have the same topology");
                }
            }

            shapeDataVectors.push({name: pathShape.id, vector: pathShape.vectorizeCommands()});
        }

        console.log("shapeDataVectors", shapeDataVectors);

        const {basis, offset, paramRanges} = this.computeParameters(shapeDataVectors);
        const shape = new AutoShape(
            topology.map(t => t === CommandType.Arc ? "A" : "L").join(""),
            [],
            [shapeData[0]],
            basis,
            offset,
            topology,
            paramRanges,
            paramRanges.length,
            1
        )
        shape.findHandles();
        return shape;
    }

    private static computeAverage(data: number[][]) {
        const sum = data.reduce(
            (prev, curr) => prev.map(
                (val, i) => val + curr[i]
            ), data[0].map(x => 0)
        );

        return sum.map(x => x / data.length);
    }

    private static computeParameters(shapeDataVectors: {name: string, vector: number[]}[]): {
        basis: number[][],
        offset: number[],
        paramRanges: {min: number, max: number}[],
    } {
        const vectors = Array.from(shapeDataVectors.map(x => x.vector));

        const eigenvectors: {eigenvalue: number, vector: number[]}[] = this.getParametersFromShapes(vectors, 0.000001);
        const basis = SimplifyBasis.simplify(eigenvectors.map(ev => ev.vector));
        const offset = this.computeAverage(vectors);
        const paramRanges = basis.map(v => {return {min: -100, max:100}});
        return {basis, offset, paramRanges};
    }

    public static getParametersFromShapes(data: number[][], tolerance: number): {eigenvalue: number, vector: number[]}[] {
        console.log("data", data.length, data[0].length);
        const eigenvecs: {eigenvalue: number, vector: number[]}[] = PCA.getEigenVectors(data);

        console.log("Eigenvecs", eigenvecs);

        let computeAvgAlong1stAxis = (a: number[][]) => {
            let sum = a.reduce(
                (prev, curr) => prev.map((x, i) => x + curr[i]), 
                a[0].map(x => 0)
            );

            return sum.map(x => x / a.length);
        };

        let computeMSEAlong1stAxis = (a: number[][], b: number[][]) => {
            let squaredDifferences = a.map((vec, i) => {
                return vec.map((x, j) => x - b[i][j]).map(x => x*x)
            });

            return computeAvgAlong1stAxis(squaredDifferences);
        };

        // avg stuff still broken!!

        let avgData = computeAvgAlong1stAxis(data);

        let stdDev = computeMSEAlong1stAxis(
            data,
            data.map(x => avgData)
        );

        console.log("data", data, "avgData", data.map(x => avgData), "stdDev", stdDev);

        if (stdDev.filter(x => x > 1e-16).length == 0) return [];

        let params;
        for (let i = 1; i < eigenvecs.length; i++) {
            params = eigenvecs.slice(0, i);

            const adData = PCA.computeAdjustedData(data, ...params);

            const reconstructed: number[][] = PCA.computeOriginalData(
                adData.adjustedData, 
                adData.selectedVectors, 
                adData.avgData).originalData;


            // mse for every dimension (some are x / y and some are angles)
            const mse = computeMSEAlong1stAxis(reconstructed, data);
            console.log("mse", mse);

            // stddev of original data to threshold more intelligently
            // const stdDev = computeMSEAlong2ndAxis(data, adData.avgData);

            if (mse.filter(x => x > 1e-16).length == 0) break;
        }

        return params;
    }

    // private cloneFromSubset(subset: string[]) {
    //     const newExtractor = new PCAShapeExtractor();

    //     const shapeDataVectorsSubset = new Map<string, number[]>();

    //     for (const shapeName of subset) {
    //         shapeDataVectorsSubset.set(shapeName, this.shapeDataVectors.get(shapeName));
    //     }

    //     newExtractor.shapeDataVectors = shapeDataVectorsSubset;
    //     newExtractor.topology = this.topology;
    //     newExtractor.computeParameters();
    //     newExtractor.generalizedBy.push(this);
    //     newExtractor.name = this.name + "-" + this.specializedBy.length;

    //     this.specializedBy.push(newExtractor);

    //     return newExtractor;
    // }

    /*private static computeParamRanges(vectors: number[][]) {
         const ranges: {min: number, max: number}[] = [];

        
        const adData = PCA.computeAdjustedData(vectors, ...this.basis.map(b => {
            return {vector: b, eigenvalue: 0}; 
        }));
        console.log("Adjusted data: ", adData); 

        for (let i = 0; i < adData.adjustedData.length; i++) {
            let min = Infinity;
            let max = -Infinity;

            const paramValues = adData.adjustedData[i];

            for (const value of paramValues) {
                min = Math.min(min, value);
                max = Math.max(max, value);
            }

            ranges.push({min: min, max: max});
        }

        return vectors.map(b => {
            return {min: -100, max: 100};
        });
    }*/

    // public getSpecializations(maxIterations: number, eqThreshold = 1e-4) {

    //     if (this.basis.length <= 1) 
    //         return [];

    //     const subsets = this.findSimplerSubsets(maxIterations, this.basis.length - 1, eqThreshold);

    //     const specialized = [];
    //     for (const subset of subsets) {
    //         const extractor = this.cloneFromSubset(subset);
    //         specialized.push(extractor);

    //         extractor.getSpecializations(maxIterations, eqThreshold)
    //             .forEach(s => specialized.push(s));
    //     }

    //     return specialized;
    // }

    // public findSimplerSubsets(maxIterations: number, paramCount: number, eqThreshold = 1e-4) {

    //     let parameterSubsets = [];

    //     let remainingShapeNames = Array.from(this.shapeDataVectors.keys());

    //     //console.log("Starting with ", vectors.length, " vectors");
        
    //     let i = 0;
    //     while (remainingShapeNames.length > paramCount && i < maxIterations) {
    //         try {
    //             const samples = [...remainingShapeNames]
    //                 .sort(() => Math.random() - 0.5).slice(0, paramCount + 1);

    //             let o = this.shapeDataVectors[samples[0]];
    //             let a = math.transpose(samples.slice(1)
    //                 .map(shapeName => math.subtract(this.shapeDataVectors[shapeName], o)));

    //             // calculate orthogonal projection matrix
    //             const aT = math.transpose(a);
    //             const aTa = math.multiply(aT, a);

    //             const aTaInv = math.inv(aTa);
    //             const proj = math.multiply(math.multiply(a, aTaInv), aT);

    //             const remainingShapeVectors = remainingShapeNames.map(shapeName => this.shapeDataVectors[shapeName]);

    //             // calculate projection of each vector onto the subspace
    //             const projVectors = remainingShapeVectors.map(
    //                 v => math.add(o, math.multiply(proj, math.subtract(v, o))));
                
    //             const projectionError = math.subtract(remainingShapeVectors, projVectors)
    //                 .map(v => math.norm(v));

    //             const explainedShapes = remainingShapeNames.filter((v, i) => projectionError[i] < eqThreshold);

    //             // interesting samples explain more than themselves
    //             if (explainedShapes.length > samples.length + 2) {
    //                 parameterSubsets.push(explainedShapes);
    //                 //console.log("Found subset", parameterSubsets.length, "with", explainedVectors.length, "vectors");
    //                 remainingShapeNames = remainingShapeNames.filter(v => !explainedShapes.includes(v));
    //                 i = 0;
    //             } else {
    //                 i++;
    //             }
    //         } catch (error) {
    //             i++;
    //             //console.log("Error in subset search", error);
    //         }
    //     }

    //     return parameterSubsets;
    // }
}