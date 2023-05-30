import { Vector2 } from "three";
import { normalizeAngle } from "../../../util/Util";
import { angleEqualityDistance, Constraint, pointEqualityDistance } from "./Constraint";


function _getCCWAngleBetweenSlopes(alpha, beta) {
    let alphaNorm = normalizeAngle(alpha);
    let betaNorm = normalizeAngle(beta);

    if (alphaNorm > betaNorm) betaNorm += 2 * Math.PI;
    return (betaNorm - alphaNorm);
}


export class AngleConstraint extends Constraint
{
    // constraint is that angle APB is equal to angle

    indexP: string;
    indexA: string;
    indexB: string;

    angle: number;

    

    
    public constructor(indexP: string, indexA: string, indexB: string, angle: number) {
        super();
        this.indexP = indexP;
        this.indexA = indexA;
        this.indexB = indexB;
        this.angle = angle;
        this._description = "angle";
    }

    static findAllInPoints(pointsToIds: Map<Vector2, string>): Constraint[] {
        let constraints: Constraint[] = [];

        let pairs = Array.from(pointsToIds.entries());
        pairs.sort((a, b) => (a[1] > b[1]) ? 1 : -1);


        for (let [p, indexP] of pairs) {
            for (let [a, indexA] of pairs) {
                if (indexA === indexP) continue;

                for (let [b, indexB] of pairs) {
                    if (indexA === indexB)  break; 
                    //if (indexB >= indexA) continue;
                    if (indexB === indexP) continue;

                    let distancePA = p.distanceTo(a);
                    if (distancePA < pointEqualityDistance) continue;

                    let distancePB = p.distanceTo(b);
                    if (distancePB < pointEqualityDistance) continue;

                    const slopePA = Math.atan2(a.y - p.y, a.x - p.x);
                    const slopePB = Math.atan2(b.y - p.y, b.x - p.x);

                    const angle = _getCCWAngleBetweenSlopes(slopePA, slopePB);

                    if (AngleConstraint.anglesSame(angle, 0)) continue;

                    let constraint = new AngleConstraint(indexP, indexA, indexB, angle);
                    constraints.push(constraint);
                }
            }
        }

        return constraints;
    }

    isSatisfied(points: Map<string, Vector2>): boolean
    {
        const p = points.get(this.indexP);
        const a = points.get(this.indexA);
        const b = points.get(this.indexB);
        
        let distancePA = p.distanceTo(a);
        if (distancePA < pointEqualityDistance) return false;

        let distancePB = p.distanceTo(b);
        if (distancePB < pointEqualityDistance) return false;

        const slopePA = Math.atan2(a.y - p.y, a.x - p.x);
        const slopePB = Math.atan2(b.y - p.y, b.x - p.x);

        const angle = _getCCWAngleBetweenSlopes(slopePA, slopePB);  
        return AngleConstraint.anglesSame(angle, this.angle);
    }

    getJsketcherConstraint() {
        console.warn("not implemented");
        return null;
    }

    public static anglesSame(a1: number, a2: number) {
        if(a1 < 0) a1 = a1 + Math.PI * 2;
        if(a2 < 0) a2 = a2 + Math.PI * 2;
        const diff = Math.abs(a1 - a2);
        return diff < angleEqualityDistance || Math.abs(Math.PI * 2 - diff) < angleEqualityDistance;
    }

    constrainedPoints(): string[] {
        return [this.indexA, this.indexB, this.indexP];
    }
}