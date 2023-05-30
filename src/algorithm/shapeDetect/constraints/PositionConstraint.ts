import { Vector2 } from "three";
import PathShape from "../../../dataTypes/PathShape";
import { Constraint, pointEqualityDistance } from "./Constraint";

export class PositionConstraint extends Constraint
{
    index: string;
    position: Vector2;

    public constructor(index: string, position: Vector2) {
        super();
        this.index = index;
        this.position = position;
        this._description = "position";
    }

    static findAllInPoints(pointsToIds: Map<Vector2, string>): Constraint[] {
        let constraints: Constraint[] = [];

        for (let [point, index] of pointsToIds) {
            constraints.push(new PositionConstraint(index, point));
        }

        return constraints;
    }

    isSatisfied(points: Map<string, Vector2>): boolean
    {
        const p = points.get(this.index);
        const dist = p.distanceTo(this.position);

        return dist < pointEqualityDistance;
    }

    getJsketcherConstraint(scale = 1) {
        return {
            "typeId":"LockPoint",
            "objects":[this.index],
            "constants":{
                "x": (this.position.x * scale).toString(),
                "y": (this.position.y * scale).toString()
            },
            "stage":0,
            "annotations":[],
            "debugData": this._debugID
        }
    }

    constrainedPoints(): string[] {
        return [this.index];
    }
}
