import { Vector2 } from "three";
import PathShape from "../../../dataTypes/PathShape";
import { Constraint, pointEqualityDistance } from "./Constraint";

export class DistanceConstraint extends Constraint
{
    indexA: string;
    indexB: string;
    distance: number;

    public constructor(indexA: string, indexB: string, distance: number) {
        super();
        this.indexA = indexA;
        this.indexB = indexB;
        this.distance = distance;
        this._description = "distance";
    }

    static findAllInPoints(pointsToIds: Map<Vector2, string>): Constraint[] {
        let constraints: Constraint[] = [];

        const idsToPoints = new Map<string, Vector2>();
        for (let [point, index] of pointsToIds) {
            idsToPoints.set(index, point);
        }

        for (let [a, indexA] of pointsToIds) {
            for (let [b, indexB] of pointsToIds) {
                if (indexA === indexB) break; // only one way

                let distance = a.distanceTo(b);
                if (distance < pointEqualityDistance) continue;

                let constraint = new DistanceConstraint(indexA, indexB, distance);
                constraints.push(constraint);
            }
        }

        return constraints;
    }

    isSatisfied(points: Map<string, Vector2>): boolean
    {
        const a = points.get(this.indexA);
        const b = points.get(this.indexB);
        const dist = a.distanceTo(b);

        return Math.abs(dist - this.distance) < pointEqualityDistance;
    }

    getJsketcherConstraint(scale = 1) {
        return {
            "typeId":"DistancePP",
            "objects":[this.indexA, this.indexB],
            "constants":{"distance": (this.distance * scale).toString()},
            "stage":0,
            "annotations":[],
            "debugData": this._debugID
        }
    }

    constrainedPoints(): string[] {
        return [this.indexA, this.indexB];
    }
}