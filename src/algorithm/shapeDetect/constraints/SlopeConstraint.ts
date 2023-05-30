import { Vector2 } from "three";
import PathShape from "../../../dataTypes/PathShape";
import { AngleConstraint } from "./AngleConstraint";
import { angleEqualityDistance, Constraint, pointEqualityDistance } from "./Constraint";

export class SlopeConstraint extends Constraint
{
    indexA: string;
    indexB: string;
    angle: number;

    public constructor(indexA: string, indexB: string, angle: number) {
        super();
        this.indexA = indexA;
        this.indexB = indexB;
        this.angle = angle;
        this._description = "slope";
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

                const angle = Math.atan2(b.y - a.y, b.x - a.x);

                let constraint = new SlopeConstraint(indexA, indexB, angle);
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

        if (dist < pointEqualityDistance) return false;

        const angle = Math.atan2(b.y - a.y, b.x - a.x);

        return AngleConstraint.anglesSame(angle, this.angle);
    }

    getJsketcherConstraint() {
        const i1 = parseInt(this.indexA.split(":")[0]);
        const i2 = parseInt(this.indexB.split(":")[0]);
        if(i1 === i2) {
            return {
                "typeId":"Angle",
                "objects":[i1.toString()],
                "constants":{"angle":180*this.angle/Math.PI},
                "stage":0,
                "annotations":[{"offset":20}],
                "debugData": this._debugID
            };
        } else {
            console.warn("unhandled slope case", this);
            return null;
        }
    }

    constrainedPoints(): string[] {
        return [this.indexA, this.indexB];
    }
}