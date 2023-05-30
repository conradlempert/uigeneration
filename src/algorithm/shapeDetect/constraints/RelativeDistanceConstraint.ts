import { Vector2 } from "three";
import PathShape from "../../../dataTypes/PathShape";
import { Constraint, pointEqualityDistance } from "./Constraint";

export class RelativeDistanceConstraint extends Constraint
{
    indexA: string;
    indexB: string;
    indexC: string;
    indexD: string;
    quotient: number;

    public constructor(indexA: string, indexB: string, indexC: string, indexD: string, quotient: number) {
        super();
        this.indexA = indexA;
        this.indexB = indexB;
        this.indexC = indexC;
        this.indexD = indexD;
        this.quotient = quotient;
        this._description = "relativeDistance";
    }

    static findAllInPoints(pointsToIds: Map<Vector2, string>): Constraint[] {
        let constraints: Constraint[] = [];

        const idsToPoints = new Map<string, Vector2>();
        for (let [point, index] of pointsToIds) {
            idsToPoints.set(index, point);
        }

        for (let [a, indexA] of pointsToIds) {
            for (let [b, indexB] of pointsToIds) {
                if (indexA === indexB) break; // ensure indexB before indexA

                for (let [c, indexC] of pointsToIds) {
                    for (let [d, indexD] of pointsToIds) {
                        if (indexC === indexD) break; // ensure indexD before indexC
                        if (indexA === indexC && indexB === indexD) continue; // ensure no self constraining
                        if (indexA >= indexC) continue; // ensure constraints only one way

                        let distAB = a.distanceTo(b);
                        let distCD = c.distanceTo(d);

                        if(distAB < pointEqualityDistance || distCD < pointEqualityDistance) continue;

                        let quotient = distAB / distCD;
                        if (quotient < pointEqualityDistance || quotient > 1 / pointEqualityDistance) continue;

                        // For now: limit to 1:1
                        if (Math.abs(quotient - 1) > pointEqualityDistance) continue;

                        let constraint = new RelativeDistanceConstraint(indexA, indexB, indexC, indexD, quotient);
                        constraints.push(constraint);
                    }
                }
            }
        }

        return constraints;
    }

    isSatisfied(points: Map<string, Vector2>): boolean
    {
        const a = points.get(this.indexA);
        const b = points.get(this.indexB);
        const c = points.get(this.indexC);
        const d = points.get(this.indexD);

        const dist1 = a.distanceTo(b);
        const dist2 = c.distanceTo(d);
        
        return Math.abs(dist1 / dist2 - this.quotient) < pointEqualityDistance;
    }

    getJsketcherConstraint() {
        const i1 = parseInt(this.indexA.split(":")[0]);
        const i2 = parseInt(this.indexB.split(":")[0]);
        const i3 = parseInt(this.indexC.split(":")[0]);
        const i4 = parseInt(this.indexD.split(":")[0]);
        if(i1 === i2 && i3 === i4 && Math.abs(this.quotient - 1) < pointEqualityDistance) {
            return {
                "typeId":"EqualLength",
                "objects":[i1.toString(),i2.toString()],
                "stage":0,
                "annotations":[],
                "debugData": this._debugID
            };
        } else {
            console.warn("unhandled relative distance case", this);
            return null;
        }
    }

    constrainedPoints(): string[] {
        return [this.indexA, this.indexB, this.indexC, this.indexD];
    }

    getFirstEdge(): [string, string] {
        return [this.indexA, this.indexB];
    }

    getSecondEdge(): [string, string] {
        return [this.indexC, this.indexD];
    }
}