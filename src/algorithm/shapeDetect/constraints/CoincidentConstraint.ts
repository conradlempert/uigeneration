import { Vector2 } from "three";
import PathShape from "../../../dataTypes/PathShape";
import { Constraint, pointEqualityDistance } from "./Constraint";

export class CoincidentConstraint extends Constraint
{
    indexA: string;
    indexB: string;

    public constructor(indexA: string, indexB: string) {
        super();
        this.indexA = indexA;
        this.indexB = indexB;
        this._description = "coincident";
    }

    static findAllInPoints(pointsToIds: Map<Vector2, string>): Constraint[] {
        let constraints: Constraint[] = [];

        const idsToPoints = new Map<string, Vector2>();
        for (let [point, index] of pointsToIds) {
            idsToPoints.set(index, point);
        }

        for (let [a, indexA] of pointsToIds) {
            for (let [b, indexB] of pointsToIds) {
                if (indexA === indexB) break;

                let constraint = new CoincidentConstraint(indexA, indexB);
                
                if (constraint.isSatisfied(idsToPoints)) {
                    constraints.push(constraint);
                }
            }
        }

        return constraints;
    }

    isSatisfied(points: Map<string, Vector2>): boolean
    {
        const a = points.get(this.indexA);
        const b = points.get(this.indexB);
        const dist = a.distanceTo(b);

        return dist < pointEqualityDistance;
    }

    getJsketcherConstraint(): any {
        return {
            "typeId": "PCoincident",
            "objects": [
                this.indexA,
                this.indexB,
            ],
            "stage": 0,
            "annotations": [],
            "debugData": this._debugID
        }
    }

    constrainedPoints(): string[] {
        return [this.indexA, this.indexB];
    }
}