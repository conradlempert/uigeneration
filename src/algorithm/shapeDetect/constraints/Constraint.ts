import { Vector2 } from "three";

export const pointEqualityDistance = 0.001;
export const angleEqualityDistance = 0.001;

export class Constraint {
    protected _description: string;
    protected _debugID: string;

    static _debugIDCounter = 0;

    public constructor() {
        this._debugID = Constraint._debugIDCounter.toString();
        Constraint._debugIDCounter++;

        console.log("Created constraint with id: " + this._debugID);
    }

    public get description(): string {
        return this._description;
    }

    static findAllInPoints(pointsToIds: Map<Vector2, string>): Constraint[] {
        throw new Error("Not implemented");
    }

    isSatisfied(points: Map<string, Vector2>): boolean {
        throw new Error("Not implemented");
    }

    getJsketcherConstraint(scale = 1): any {
        throw new Error("Not implemented");
    }

    
    concernsPoint(index: string): boolean {
        return this.constrainedPoints().includes(index);
    }

    constrainedPoints(): string[] {
        throw new Error("Method not implemented.");
    }

    get debugID(): string {
        return this._debugID;
    }
}