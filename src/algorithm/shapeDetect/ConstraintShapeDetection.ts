import { flatten, hasIn, intersection, invert, maxBy, minBy, reverse, union } from "lodash";
import { Vector2 } from "three/src/math/Vector2";
import AutoShape from "../../dataTypes/AutoShape";
import PathShape from "../../dataTypes/PathShape";
import SvgDocument from "../../dataTypes/SvgDocument";
import PowersetSubsetGenerator from "../../subsetGen/PowersetSubsetGenerator";
import AbstractShapeDetection from "./AbstractShapeDetection";
import { AngleConstraint } from "./constraints/AngleConstraint";
import { CoincidentConstraint } from "./constraints/CoincidentConstraint";
import { Constraint, pointEqualityDistance } from "./constraints/Constraint";
import { DistanceConstraint } from "./constraints/DistanceConstraint";
import { PositionConstraint } from "./constraints/PositionConstraint";
import { RelativeDistanceConstraint } from "./constraints/RelativeDistanceConstraint";
import { SlopeConstraint } from "./constraints/SlopeConstraint";
import PCAShapeDetection from "./PCAShapeDetection";
import randomstring from "randomstring";
import { initializeSketcherApplication } from "sketcher";
import UIGenerationMenu from "uiGenerationShapeMenu/uiGenerationMenu";


const constraintTypes = [
    PositionConstraint, 
    CoincidentConstraint, 
    DistanceConstraint, 
    RelativeDistanceConstraint,
    SlopeConstraint,
    AngleConstraint
];

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default class ConstraintShapeDetection extends AbstractShapeDetection {

    public static async detectShapes(documents: SvgDocument[]): Promise<AutoShape[]> {
        //console.log(documents);
        const autoShapes: AutoShape[] = [];

        autoShapes.push(...(await this.findLevel1AutoShapes(documents)));
        //autoShapes.push(...this.findLevel2AutoShapes(documents));
        autoShapes.forEach(a => this.printShapeConstraintReport(a));

        return autoShapes;
    }


    public static async findLevel1AutoShapes(documents: SvgDocument[]): Promise<AutoShape[]> {
        
        let allShapes: PathShape[] = flatten(documents.map(d => d.pathShapes));
        let topologies = PCAShapeDetection.groupByTopology(allShapes);

        const groupShapes = new Map<string, PathShape[][]>();
        for (const [groupName, shapes] of topologies) groupShapes.set(groupName, shapes.map(s => [s]));
        
        let shapePoints = new Map<PathShape[], Map<Vector2, string>[]>();
        for (const shapes of groupShapes.values()) {
            for (const shape of shapes) {
                // do this to ensure consistent array reference
                shapePoints.set(shape, this.pathShapeToPoints(shape[0]));
            }
        }

        return await this.findAutoShapesInGroups(groupShapes, shapePoints, 1);
    }

    public static async findLevel2AutoShapes(documents: SvgDocument[], maxL1Shapes = 4): Promise<AutoShape[]> {

        const groups = new Map<string, PathShape[][]>();
        const pointData = new Map<PathShape[], Map<Vector2, string>[]>();

        let allShapes: PathShape[] = flatten(documents.map(d => d.pathShapes));
        const shapeTopologies = this.getShapeTopologies(allShapes);

        for (const document of documents) {
            const gen = new PowersetSubsetGenerator(document.pathShapes);

            let subset: PathShape[];
            while (subset = gen.next()) {
                if (subset.length < 2) continue;
                if (subset.length > maxL1Shapes) break;

                let bestTopology;
                let bestTopologyPoints: Map<Vector2, string>[] = [];
                let bestTopologyShapes: PathShape[];

                for (const permutation of this.getPermutations(subset)) {
                    const points = new Map<Vector2, string>();

                    let i = 0;
                    for (const shape of permutation) {
                        points.set(shape.getCenterPoint(), (i++).toString());
                    }

                    const topologyName = permutation.map(x => shapeTopologies.get(x))
                        .reduce((prev, curr) => prev + "_" + curr, "");

                    if (!bestTopology) {
                        bestTopology = topologyName;
                    } else if (groups.has(topologyName) && !groups.has(bestTopology)) {
                        bestTopology = topologyName;
                        bestTopologyPoints = [];
                    }

                    if (topologyName == bestTopology) {
                        bestTopologyPoints.push(points);
                        bestTopologyShapes = permutation;
                    }
                }

                if (!groups.has(bestTopology)) groups.set(bestTopology, []);

                groups.get(bestTopology).push(bestTopologyShapes);
                pointData.set(bestTopologyShapes, bestTopologyPoints);
            }
        }

        return await this.findAutoShapesInGroups(groups, pointData, 2);
    }

    private static getPermutations(arr: any[]): any[][] {
        if (arr.length <= 2) return arr.length === 2 ? [arr, [arr[1], arr[0]]] : arr;

        return arr.reduce(
            (acc, item, i) =>
            acc.concat(
                this.getPermutations([...arr.slice(0, i), ...arr.slice(i + 1)]).map(val => [
                item,
                ...val,
                ])
            ),
            []
        );
    }

    private static getShapeTopologies(shapes: PathShape[]) {
        let groupedShapes = PCAShapeDetection.groupByTopology(shapes);

        const topologyDict = new Map<PathShape, string>();
        for (const [topology, shapes] of groupedShapes) {
            for (const shape of shapes) {
                topologyDict.set(shape, topology);
            }
        }

        return topologyDict;
    }

    private static async findAutoShapesInGroups(groups: Map<string, PathShape[][]>, groupsPointData: Map<PathShape[], Map<Vector2, string>[]>, level: (1|2)) {

        let autoShapes: AutoShape[] = [];

        for(const groupName of groups.keys()) {
            const groupShapes: PathShape[][] = groups.get(groupName);
            const groupConstraints = new Map<PathShape[][], Constraint[]>();
            
            for(const shapes of groupShapes) {
                const points = groupsPointData.get(shapes);
                console.log("shapes", shapes, "points", points);
                groupConstraints.set([shapes], this.findConstraints(points[0]));
            }

            // measure the time it takes to find all group constraints
            const start = new Date().getTime();

            let dedupTime = 0;

            let currentSize = 1;
            while(currentSize < groupShapes.length) { // brute force all combinations (can this be done not exponentially?)
                const currentElements = Array.from(groupConstraints.keys()).filter(k => k.length === currentSize);
                for(const element of currentElements) {
                    const otherShapes = groupShapes.filter(s => !element.includes(s));
                    for(const shapes of otherShapes) {
                        const newArr = [...element, shapes];
                        //const newConstraints = this.combineConstraints(groupConstraints.get(element), this.findConstraints(shape));
                        const newConstraints = this.filterAgainstPoints(groupConstraints.get(element), groupsPointData.get(shapes));
                        groupConstraints.set(newArr, newConstraints);
                    }
                }

                currentSize++;
                const beforeDedup = new Date().getTime();
                this.deduplicateByConstraints(groupConstraints, groupsPointData);
                dedupTime += new Date().getTime() - beforeDedup;
            }
            console.log("Done, took " + (new Date().getTime() - start) + " ms");
            console.log("Dedup took " + dedupTime + " ms");

            groupConstraints.forEach((value, key) => {
                const minimized = this.minimizeConstraints(value);
                groupConstraints.set(key, minimized)
            });

            //console.log(groupConstraints);

            const topologyAutoShapes: AutoShape[] = [];
            for(const [groupShapes, constraints] of groupConstraints.entries()) {
                const exampleShape = this.findRepresentativeExampleShape(groupShapes, Array.from(groupConstraints.keys()));
                const autoShape = new AutoShape(
                    "temp",
                    [],
                    exampleShape,
                    [],
                    [],
                    [],
                    [],
                    0,
                    level,
                    constraints,
                )
                //this.computeDOFHeuristic(autoShape);

                autoShape.shapeName = groupName + "_" + autoShape.cost + "_" + randomstring.generate(4);
                topologyAutoShapes.push(autoShape);
                for(const shapes of groupShapes) {
                    for (const shape of shapes) 
                        shape.representations.push({ autoShape, automaticallyDetermined: true, parameters: [], pathShapes: shapes});
                }
            }

            for(const autoShape of topologyAutoShapes) {
                for(const autoShape2 of topologyAutoShapes) {
                    if(autoShape === autoShape2) continue;
                    // we can use element 0 here, because any level 2 autoshape will be present in all the shapes of the relevant array
                    const pathShapes1 = groupShapes.filter(s => s[0].representations.some(r => r.autoShape === autoShape));
                    const pathShapes2 = groupShapes.filter(s => s[0].representations.some(r => r.autoShape === autoShape2));
                    if(pathShapes1.length === union(pathShapes1, pathShapes2).length && pathShapes1.length > pathShapes2.length) {
                        autoShape.specializedBy.push(autoShape2);
                    }
                }
            }

            this.performTransitiveReduction(topologyAutoShapes);
            autoShapes.push(...topologyAutoShapes);
        }

        await this.removeRedundantConstraintsAndComputeDOF(autoShapes);
        
        return autoShapes;
    }

    public static jSketcherIndexFromPointIndex(pointIndex: number, shape: PathShape) {

    }

    // this is not accurate, but enough to run UI generation
    public static computeDOFHeuristic(autoShape: AutoShape): void {

        let amountOfPoints;

        if (autoShape.level === 1) {
            amountOfPoints = this.pathShapeToPoints(autoShape.exampleShape[0]).length;
        } else if (autoShape.level === 2) {
            amountOfPoints = autoShape.exampleShape.length;
        } else {
            throw new Error("Invalid level");
        }

        let DOF = amountOfPoints * 2;
        const minimized = this.minimizeConstraints(autoShape.constraints);
        const positionConstraints = minimized.filter(c => c.description === "position").length;
        const slopeConstraints = minimized.filter(c => c.description === "slope").length;
        DOF -= positionConstraints * 2;
        DOF -= slopeConstraints;
        autoShape.cost = Math.max(DOF, 0);
    }

    public static async removeRedundantConstraintsAndComputeDOF(autoShapes: AutoShape[]) {
        initializeSketcherApplication();
        //UIGenerationMenu.createUI();
        
        for(const autoShape of autoShapes) {
            console.log("Computing DOF for autoshape", autoShape);

            const serialized = autoShape.serialize();
            serialized.previewIcon = "";
            
            UIGenerationMenu.loadJson("test", JSON.stringify([serialized]));
            UIGenerationMenu.addShape(0);

            const redundant = Array.from(UIGenerationMenu.viewer.parametricManager.algNumSystem.redundant);
            const allConstraints = Array.from(UIGenerationMenu.viewer.parametricManager.algNumSystem.allConstraints);

            console.log("AutoShape constraints before removing redundant:", autoShape.constraints);

            console.log("All constraints:", allConstraints);
            console.log("Redundant:", redundant);

            let nonRedundantConstraints = [];
            for(const constraint of autoShape.constraints) {
                let isRedundant = false;
                for (const algNumC of redundant) {
                    if (algNumC.uigenDebugData == constraint.debugID) {
                        isRedundant = true;
                        break;
                    }
                }

                let isInAllConstraints = false;
                for (const algNumC of allConstraints) {
                    if (algNumC.uigenDebugData == constraint.debugID) {
                        isInAllConstraints = true;
                        break;
                    }
                }

                if (!isRedundant && isInAllConstraints) {
                    nonRedundantConstraints.push(constraint);
                }
            }

            autoShape.constraints = nonRedundantConstraints;

            const isolationDOF = UIGenerationMenu.viewer.parametricManager.algNumSystem.polynomialIsolations.reduce((a, b) => a + b.dof, 0);


            autoShape.cost = isolationDOF;

            /*
            console.log("AutoShape constraints after removing redundant:", autoShape.constraints);


            //console.log(UIGenerationMenu.viewer);

            //await sleep(1000);
            
            //TODO: Functionality
            console.log("allConstraints:", UIGenerationMenu.viewer.parametricManager.allConstraints);
            console.log("polynomialIsolations:", UIGenerationMenu.viewer.parametricManager.algNumSystem.polynomialIsolations);
            console.log("dof:", UIGenerationMenu.viewer.parametricManager.algNumSystem.dof);
            console.log("isolations dof: " + isolationDOF);
            console.log("redundant:", Array.from(UIGenerationMenu.viewer.parametricManager.algNumSystem.redundant));

            //debugger;*/

            (window as any).viewer.removeEverything();

            console.log("Done computing DOF for autoshape", autoShape);
        }


    }

    public static performTransitiveReduction(autoShapes: AutoShape[]): void {
        // helper function for transitive reduction
        function hasAsChild(autoShape1: AutoShape, autoShape2: AutoShape): boolean {
            if(autoShape1.specializedBy.includes(autoShape2)) {
                return true;
            } else {
                return autoShape1.specializedBy.some(s => hasAsChild(s, autoShape2));
            }
        }

        // transitive reduction, can probably be optimized
        for(const autoShape1 of autoShapes) {
            for(const [idx, autoShape2] of autoShape1.specializedBy.entries()) {
                if(autoShape1.specializedBy.some(s => s !== null && hasAsChild(s, autoShape2))) {
                    autoShape1.specializedBy[idx] = null;
                }
            }
            autoShape1.specializedBy = autoShape1.specializedBy.filter(s => s !== null);
        }
    }

    public static deduplicateByConstraints(groupConstraints: Map<PathShape[][], Constraint[]>, pointData: Map<PathShape[], Map<Vector2, string>[]>): void {
        const keys = Array.from(groupConstraints.keys());
        
        const inverted = reverse(keys);
        for(let i = 0; i < inverted.length; i++) {
            for(let j = i+1; j < inverted.length; j++) {
                const shape1 = keys[i];
                const shape2 = keys[j];

                const c1 = groupConstraints.get(shape1);
                const c2 = groupConstraints.get(shape2);

                if (!c1 || !c2) continue; // shape already deleted
                if(c1.length !== c2.length) continue;

                // assuming, that every constraint set is maximally constrained for the shapes in the set
                // if all constraints of one set hold for the other set, and vice versa, the constraint sets are the same
                // this reduces quadratic complexity (e.g. checking both sets contain same constrains) to linear
                // without hashing or similar optimizations

                let allConstraintsHold = true;

                for (const shape of shape1) {
                    const points = pointData.get(shape);
                    const filtered = this.filterAgainstPoints(c2, points);

                    if(filtered.length !== c2.length) {
                        allConstraintsHold = false;
                        break;
                    }
                }

                if(!allConstraintsHold) {
                    continue;
                }

                for (const shape of shape2) {
                    const points = pointData.get(shape);
                    const filtered = this.filterAgainstPoints(c1, points);

                    if(filtered.length !== c1.length) {
                        allConstraintsHold = false;
                        break;
                    }
                }

                if (allConstraintsHold) groupConstraints.delete(shape2);
            }
        }
    }

    public static printShapeConstraintReport(autoShape: AutoShape): void {
        console.log(autoShape.shapeName);
        console.log(autoShape.constraints);
        const typesAmount = new Map<string, number>();
        for(const c of autoShape.constraints) {
            if(typesAmount.has(c.description)) {
                typesAmount.set(c.description, typesAmount.get(c.description) + 1);
            } else {
                typesAmount.set(c.description, 1);
            }
        }
        for(const [key, value] of Array.from(typesAmount.entries())) {
            console.log(key, value);
        }
    }

    public static findRepresentativeExampleShape(group: PathShape[][], allGroups: PathShape[][][]): PathShape[] {
        const shapeOccurences = new Map<PathShape[], number>();
        for(const otherGroup of allGroups) {
            for(const shape of group) {
                if(otherGroup.includes(shape)) {
                    if(shapeOccurences.has(shape)) {
                        shapeOccurences.set(shape, shapeOccurences.get(shape) + 1);
                    } else {
                        shapeOccurences.set(shape, 1);
                    }
                }
            }
        }
        const bestShape = minBy(group, shape => shapeOccurences.get(shape));
        return bestShape;
    }
    public static findConstraints(points: Map<Vector2, string>): Constraint[] {
        const result: Constraint[] = [];
        if(points.size > 40) {
            console.warn("CANT PROCESS SHAPE BECAUSE TOO COMPLICATED", points.size);
            return [];
        }
        constraintTypes.forEach(constraintType => {
            result.push(...constraintType.findAllInPoints(points));
        });

        return result;
    }
    public static pathShapeToPoints(shape: PathShape): Map<Vector2, string>[] {
        // THE RESULTS WILL APPEAR REDUNDANT BECAUSE ALL IDENTICAL ROTATIONS OF THE TOPOLOGY ARE STORED
        const topologyStartIndices = shape.getStartIndicesWithSameTopology();
        const result: Map<Vector2, string>[] = [];
        for(const startIndex of topologyStartIndices) {
            const points = new Map<Vector2, string>();
            let jSketcherPrimitives = shape.getJSketcherPrimitives();
            jSketcherPrimitives = [...jSketcherPrimitives.slice(startIndex), ...jSketcherPrimitives.slice(0, startIndex)];
            jSketcherPrimitives.forEach((primitive, i) => {
                if (primitive.type === "Segment") {
                    points.set(new Vector2(primitive.data.a.x, primitive.data.a.y), i.toString() + ":A");
                    points.set(new Vector2(primitive.data.b.x, primitive.data.b.y), i.toString() + ":B");
                }
                if (primitive.type === "Arc") {
                    points.set(new Vector2(primitive.data.a.x, primitive.data.a.y), i.toString() + ":A");
                    points.set(new Vector2(primitive.data.b.x, primitive.data.b.y), i.toString() + ":B");
                    points.set(new Vector2(primitive.data.c.x, primitive.data.c.y), i.toString() + ":C");
                }
            })
            result.push(points);
        }
        
        return result;
    }

    public static filterAgainstPoints(constraints: Constraint[], pointsForStartIndices: Map<Vector2, string>[]): Constraint[] {

        const constraintResults: Constraint[][] = [];

        for(const points of pointsForStartIndices) {
            let idsToPoints = new Map<string, Vector2>();
            points.forEach((v, k) => idsToPoints.set(v, k));
            constraintResults.push(constraints.filter(constraint => constraint.isSatisfied(idsToPoints)));
        }

        return maxBy(constraintResults, c => c.length);
    }

    public static minimizeConstraints(constraints: Constraint[]): Constraint[] {
        return constraints;

        // helper datastructure to quickly check for present constraints
        const constraintGraph = new Map<string, Array<Constraint>>();
        for (const constraint of constraints) {
            for (const pointIndex of constraint.constrainedPoints()) {
                if (!constraintGraph.has(pointIndex)) {
                    constraintGraph.set(pointIndex, [constraint]);
                } else {
                    constraintGraph.get(pointIndex).push(constraint);
                }
            }
        }

        let minimalConstraintSet = new Set(constraints);

        let constraintPresent = (desc: string, points: string[], needsToBeInSet = false) => {
            for (const constraint of constraintGraph.get(points[0])) {
                if (constraint.description != desc) continue;

                // think, whether you wanna check if you have already removed a relevant constraint
                if (needsToBeInSet && !minimalConstraintSet.has(constraint)) continue;

                let allPresent = true;
                for (const point of points) {
                    if (!constraint.concernsPoint(point)) {
                        allPresent = false;
                        break;
                    }
                }

                if (allPresent) return true;
            }

            return false;
        }

        let sameEdge = (edgeA, edgeB) => {
            return edgeA[0] == edgeB[0] && edgeA[1] == edgeB[1]
                || edgeA[0] == edgeB[1] && edgeA[1] == edgeB[0];
        }

        // more advanced search function respecting edges
        let relativeDistanceConstraintPresent = (edgeA: [string, string], edgeB: [string, string], needsToBeInSet = false) => {
            for (const constraint of constraints) {
                if (constraint.description != "relativeDistance") continue;
                let relDistConstraint = constraint as RelativeDistanceConstraint;

                // think, whether you wanna check if you have already removed a relevant constraint
                if (needsToBeInSet && !minimalConstraintSet.has(constraint)) continue;

                if (sameEdge(edgeA, relDistConstraint.getFirstEdge()) && sameEdge(edgeB, relDistConstraint.getSecondEdge())
                    || sameEdge(edgeB, relDistConstraint.getFirstEdge()) && sameEdge(edgeA, relDistConstraint.getSecondEdge())) {
                    return true;
                }
            }

            return false;
        }

        //console.log("Reducing " + constraints.length + " constraints");

        // remove constraints covered by coincident
        for (let i = 0; i < constraints.length; i++) {
            if (!minimalConstraintSet.has(constraints[i])) continue;
            const constraint = (constraints[i] as CoincidentConstraint)
            if (!constraint) continue;
            if (constraint.description != "coincident") continue;

            for (const obsoleteConstraint of constraintGraph.get(constraint.indexB)) {
                if (obsoleteConstraint == constraint) continue;
                if (minimalConstraintSet.has(obsoleteConstraint)) {
                    minimalConstraintSet.delete(obsoleteConstraint);
                }
            }
        }

        // remove angle constraints in triangles with constrained distances
        const angleConstraints = Array.from(minimalConstraintSet)
            .filter(c => c.description == "angle")
            .map(c => (c as AngleConstraint));

        for (const constraint of angleConstraints) {
            if (!constraintPresent("distance", [constraint.indexA, constraint.indexB])) continue;
            if (!constraintPresent("distance", [constraint.indexB, constraint.indexP])) continue;
            if (!constraintPresent("distance", [constraint.indexP, constraint.indexA])) continue;

            minimalConstraintSet.delete(constraint);
        }

        // remove angle constraint if the slopes are constrained
        const angleConstraints2 = Array.from(minimalConstraintSet)
            .filter(c => c.description == "angle")
            .map(c => (c as AngleConstraint));

        for (const constraint of angleConstraints2) {
            if (!constraintPresent("slope", [constraint.indexB, constraint.indexP])) continue;
            if (!constraintPresent("slope", [constraint.indexP, constraint.indexA])) continue;

            minimalConstraintSet.delete(constraint);
        }

        // remove relative distance constraints when both distances already constrained
        let relativeDistanceConstraints = Array.from(minimalConstraintSet)
            .filter(c => c.description == "relativeDistance")
            .map(c => (c as RelativeDistanceConstraint));

        for (const constraint of relativeDistanceConstraints) {
            if (!constraintPresent("distance", [constraint.indexA, constraint.indexB])) continue;
            if (!constraintPresent("distance", [constraint.indexC, constraint.indexD])) continue;

            minimalConstraintSet.delete(constraint);
        }

        
        // remove transitive relative distance constraints
        let relativeDistanceRoots: ([string, string])[] = [];

        relativeDistanceConstraints = Array.from(minimalConstraintSet)
            .filter(c => c.description == "relativeDistance")
            .map(c => (c as RelativeDistanceConstraint));

        for (const constraint of relativeDistanceConstraints) {
            let transitivelyRedundant = false;
            let newRoot = true;

            for (const edge of relativeDistanceRoots) {
                const edgeA = constraint.getFirstEdge();
                const edgeB = constraint.getSecondEdge();


                if (sameEdge(edge, edgeA) || sameEdge(edge, edgeB)) {
                    newRoot = false;
                    break; // valid edge, no new root needed
                }

                if (relativeDistanceConstraintPresent(edge, edgeA, false) 
                    || relativeDistanceConstraintPresent(edge, edgeB, false)) {
                    transitivelyRedundant = true;
                    break;
                }
            }

            if (transitivelyRedundant) {
                minimalConstraintSet.delete(constraint);
            } else if (newRoot) {
                relativeDistanceRoots.push(constraint.getFirstEdge());
            }
        }
        

        // remove distance and slope constraints when both points have constrained positions
        const distanceConstraints = Array.from(minimalConstraintSet)
            .filter(c => c.description == "distance")
            .map(c => (c as DistanceConstraint));

        const slopeConstraints = Array.from(minimalConstraintSet)
            .filter(c => c.description == "slope")
            .map(c => (c as SlopeConstraint));

        for (const constraint of [...distanceConstraints, ...slopeConstraints]) {
            if (!constraintPresent("position", [constraint.indexA])) continue;
            if (!constraintPresent("position", [constraint.indexB])) continue;

            minimalConstraintSet.delete(constraint);
        }

        //console.log("to" + minimalConstraintSet.size);

        //console.log("originalConstraints:", constraints, "reducedConstraints:", minimalConstraintSet);

        return Array.from(minimalConstraintSet);

    }
}