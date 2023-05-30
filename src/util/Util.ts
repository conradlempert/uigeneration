import { Vector2 } from "three";

export function lineRectIntersect(from: Vector2, to: Vector2, origin: Vector2, extent: Vector2): Vector2 {
    const direction = new Vector2(to.x - from.x, to.y - from.y);

    const log = false && origin.x < 450 && origin.y < 450;

    let factors = [
        1,
        (origin.x + 0.5 * extent.x - from.x) / direction.x,
        (origin.x - 0.5 * extent.x - from.x) / direction.x,
        (origin.y + 0.5 * extent.y - from.y) / direction.y,
        (origin.y - 0.5 * extent.y - from.y) / direction.y
    ];

    factors = factors.filter(value => (value >= 0) && (value <= 1) && Number.isFinite(value));

    let points = factors.map(factor => new Vector2(
            direction.x * factor + from.x,
            direction.y * factor + from.y)
    );

    let factor = factors.filter((value, index) => {
            const p = points[index];
            return Math.abs(p.x - origin.x) <= (extent.x / 2 + 1e-3)
                && Math.abs(p.y - origin.y) <= (extent.y / 2 + 1e-3);
        }).reduce((prev, curr) => Math.min(prev, curr), 1);

    return new Vector2(
        direction.x * factor + from.x,
        direction.y * factor + from.y
    );
}


// **** BASED ON: https://stackoverflow.com/a/12329083 ****

//conversion_from_endpoint_to_center_parameterization
// svg : [A | a] (rx ry x-axis-rotation large-arc-flag sweep-flag x y)+

//sample :  svgArcToCenterParam(200,200,50,50,0,1,1,300,200)
// x1 y1 rx ry φ fA fS x2 y2
export function svgArcToCenterParam(x1: number, y1: number, rx: number, ry: number, phi: number, fA: boolean | number, fS: boolean | number, x2: number, y2: number) {

    var cx: number, cy: number, startAngle: number, deltaAngle: number, endAngle: number;
    var PIx2 = Math.PI * 2.0;

    if (rx < 0) {
        rx = -rx;
    }
    if (ry < 0) {
        ry = -ry;
    }
    if (rx == 0.0 || ry == 0.0) { // invalid arguments
        throw Error('rx and ry can not be 0');
    }

    var s_phi = Math.sin(phi);
    var c_phi = Math.cos(phi);
    var hd_x = (x1 - x2) / 2.0; // half diff of x
    var hd_y = (y1 - y2) / 2.0; // half diff of y
    var hs_x = (x1 + x2) / 2.0; // half sum of x
    var hs_y = (y1 + y2) / 2.0; // half sum of y

    // F6.5.1
    var x1_ = c_phi * hd_x + s_phi * hd_y;
    var y1_ = c_phi * hd_y - s_phi * hd_x;

    // F.6.6 Correction of out-of-range radii
    //   Step 3: Ensure radii are large enough
    var lambda = (x1_ * x1_) / (rx * rx) + (y1_ * y1_) / (ry * ry);
    if (lambda > 1) {
        rx = rx * Math.sqrt(lambda);
        ry = ry * Math.sqrt(lambda);
    }

    var rxry = rx * ry;
    var rxy1_ = rx * y1_;
    var ryx1_ = ry * x1_;
    var sum_of_sq = rxy1_ * rxy1_ + ryx1_ * ryx1_; // sum of square
    if (!sum_of_sq) {
        throw Error('start point can not be same as end point');
    }
    var coe = Math.sqrt(Math.abs((rxry * rxry - sum_of_sq) / sum_of_sq));
    if (fA == fS) { coe = -coe; }

    // F6.5.2
    var cx_ = coe * rxy1_ / ry;
    var cy_ = -coe * ryx1_ / rx;

    // F6.5.3
    cx = c_phi * cx_ - s_phi * cy_ + hs_x;
    cy = s_phi * cx_ + c_phi * cy_ + hs_y;

    var xcr1 = (x1_ - cx_) / rx;
    var xcr2 = (x1_ + cx_) / rx;
    var ycr1 = (y1_ - cy_) / ry;
    var ycr2 = (y1_ + cy_) / ry;

    // F6.5.5
    startAngle = radian(1.0, 0.0, xcr1, ycr1);
    
    while (startAngle > PIx2) { startAngle -= PIx2; }
    while (startAngle < 0.0) { startAngle += PIx2; }

    // F6.5.6
    deltaAngle = radian(xcr1, ycr1, -xcr2, -ycr2);
    while (deltaAngle > PIx2) { deltaAngle -= PIx2; }
    while (deltaAngle < 0.0) { deltaAngle += PIx2; }
    if (fS == false || fS == 0) { deltaAngle -= PIx2; }
    endAngle = startAngle + deltaAngle;
    //while (endAngle > PIx2) { endAngle -= PIx2; }
    //while (endAngle < 0.0) { endAngle += PIx2; }

    var outputObj = { /* cx, cy, startAngle, deltaAngle */
        rx: rx,
        ry: ry,
        x: cx,
        y: cy,
        startAngle: startAngle,
        deltaAngle: deltaAngle,
        endAngle: endAngle,
        phi: phi,
        clockwise: (fS == true || fS == 1)
    }

    return outputObj;
}


 function radian( ux: number, uy: number, vx: number, vy: number ): number {
    var  dot = ux * vx + uy * vy;
    var  mod = Math.sqrt( ( ux * ux + uy * uy ) * ( vx * vx + vy * vy ) );
    var  rad = Math.acos( dot / mod );
    if( ux * vy - uy * vx < 0.0 ) {
        rad = -rad;
    }
    return rad;
}


export function normalizeAngle(angle: number): number {
    while (angle < 0) {
        angle += Math.PI * 2;
    }
    while (angle > Math.PI * 2) {
        angle -= Math.PI * 2;
    }
    return angle;
}