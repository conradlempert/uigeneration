import { Line3, Vector2, Vector3 } from "three";
import { Arc, Bezier, Point } from "bezier-js";
import { optimize, OptimizedSvg } from 'svgo';
import { flatten } from "lodash";
import { parseSVG, makeAbsolute } from 'svg-path-parser';
import svgFlatten from "svg-flatten";
import arcToBezier, { Arc as Arc2, CubicBezierCurve } from 'svg-arc-to-cubic-bezier';
import HardcodedShapeDetection from "./shapeDetect/HardcodedShapeDetection";
import { string } from "mathjs";
import { FileHandling } from "../util/FileHandling";
import PathShape from "../dataTypes/PathShape";
import SvgDocument from "../dataTypes/SvgDocument";
import { normalizeAngle, svgArcToCenterParam } from "../util/Util";
import randomstring from "randomstring";
import { parse, Node as SvgNode, ElementNode } from 'svg-parser';
import * as intersect from 'line-intersection';

export interface ArcCommand {
    x: number;
    y: number;
    r: number;
    s: number;
    e: number
}

export interface ArcCommandEndPointRep {
    x0: number,
    y0: number,
    rx: number,
    ry: number,
    largeArc: 0 | 1,
    sweep: 0 | 1,
    x: number,
    y: number,
    xAxisRotation: number
}

export interface LineCommand {
    x0: number;
    y0: number;
    x: number;
    y: number;
}

const convertArcsBackAndForth = true;

export default class SvgToCommands {

    public static lastLinearizedSvg: {x: number, y: number}[][] = null;

    public static async svgToCommands(xmlString: string): Promise<SvgDocument> {
        return await this._ConvertAndStandardize(xmlString);
    }

    private static async _ConvertAndStandardize(xmlString: string): Promise<SvgDocument> {
        const idToCommandsMap = await this.svgToRawCommands(xmlString);
        const subshapeCommands = SvgToCommands._splitIntoSubshapes(idToCommandsMap);
        const standardizedCommands = new Map(Array.from(subshapeCommands.entries()).map(([id, commands]) => [id, SvgToCommands._standardizeCommands(commands)]));
        const pathShapes = new Map(Array.from(standardizedCommands.entries()).filter((v => v[1].length > 0)).map(([id, commands], index) => [id, new PathShape(id, this._commandsToPath(commands), commands, [])]));
        return new SvgDocument(Array.from(pathShapes.values()), randomstring.generate(10), xmlString);
    }

    private static _fitCommand(points: Vector2[]): LineCommand | ArcCommand {
        if (SvgToCommands._fitsLine(points)) {
            return {
                x0: points[0].x,
                y0: points[0].y,
                x: points[points.length - 1].x,
                y: points[points.length - 1].y
            };
        } else {
            const arc = SvgToCommands._fitArc(points);
            if (arc) return arc;
        }

        return null;
    }

    private static _fitsLine(points: Vector2[]): boolean {
        if (points.length < 2) return false;

        const a = points[0];
        const b = points[points.length - 1];

        for (const p of points) {
            // check if the point is on the line between the first and last point
            const distAB = Math.hypot(a.x - b.x, a.y - b.y);
            const distAP = Math.hypot(a.x - p.x, a.y - p.y);
            const distPB = Math.hypot(p.x - b.x, p.y - b.y);

            if (Math.abs(distAB - (distAP + distPB)) > 0.01) {
                return false;
            }
        }

        return true;
    }

    private static _findCircle(x1,  y1,  x2,  y2, x3, y3)
    {
        // based on https://www.geeksforgeeks.org/equation-of-circle-when-three-points-on-the-circle-are-given/


        var x12 = (x1 - x2);
        var x13 = (x1 - x3);
    
        var y12 =( y1 - y2);
        var y13 = (y1 - y3);
    
        var y31 = (y3 - y1);
        var y21 = (y2 - y1);
    
        var x31 = (x3 - x1);
        var x21 = (x2 - x1);
    
        //x1^2 - x3^2
        var sx13 = Math.pow(x1, 2) - Math.pow(x3, 2);
    
        // y1^2 - y3^2
        var sy13 = Math.pow(y1, 2) - Math.pow(y3, 2);
    
        var sx21 = Math.pow(x2, 2) - Math.pow(x1, 2);
        var sy21 = Math.pow(y2, 2) - Math.pow(y1, 2);
    
        var f = ((sx13) * (x12)
                + (sy13) * (x12)
                + (sx21) * (x13)
                + (sy21) * (x13))
                / (2 * ((y31) * (x12) - (y21) * (x13)));
        var g = ((sx13) * (y12)
                + (sy13) * (y12)
                + (sx21) * (y13)
                + (sy21) * (y13))
                / (2 * ((x31) * (y12) - (x21) * (y13)));
    
        var c = -(Math.pow(x1, 2)) -
        Math.pow(y1, 2) - 2 * g * x1 - 2 * f * y1;
    
        // eqn of circle be
        // x^2 + y^2 + 2*g*x + 2*f*y + c = 0
        // where centre is (h = -g, k = -f) and radius r
        // as r^2 = h^2 + k^2 - c
        var h = -g;
        var k = -f;
        var sqr_of_r = h * h + k * k - c;
    
        // r is the radius
        var r = Math.sqrt(sqr_of_r);
    
        return {
            x: h,
            y: k,
            r: r
        };
    }

    private static _fitArc(points: Vector2[]): ArcCommand {

        if (points.length < 3) return null;

        //if (points.length > 64) return null;

        // check if clockwise or counterclockwise
        let clockwise = true;
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            area += (p2.x - p1.x) * (p2.y + p1.y);
        }
        if (area < 0) clockwise = false;
        
        let a = points[0];
        let b = points[Math.floor(points.length / 2)];
        let c = points[points.length - 1];

        let startPoint = a;
        let endPoint = c;

        // catch circle edge case
        // TODO: improve this
        if (Math.hypot(a.x - c.x, a.y - c.y) < 0.01) {
            if (points.length > 3) c = points[points.length - 2];
            else return null;
        }

        let {x, y, r} = SvgToCommands._findCircle(a.x, a.y, b.x, b.y, c.x, c.y);

        let startAngle = Math.atan2(startPoint.y - y, startPoint.x - x);
        let endAngle = Math.atan2(endPoint.y - y, endPoint.x - x);

        // TODO: check if the arc is clockwise or counterclockwise, and adjust the angles accordingly
        if (!clockwise) {
            if (startAngle >= endAngle) endAngle += 2 * Math.PI;
        } else {
            if (endAngle >= startAngle) startAngle += 2 * Math.PI;
        }

        // check if points and midpoints between points are on the arc
        
        const absThreshold = 0.5;
        const relThreshold = 0.01;

        for (let i = 0; i < points.length - 1; i++) {
            //break;
            const p = points[i];
            const nextP = points[i + 1];

            const distPC = Math.hypot(p.x - x, p.y - y);
            const distNC = Math.hypot(nextP.x - x, nextP.y - y);

            // check both relative and absolute distance
            if (Math.abs(distPC / r - 1) > relThreshold || Math.abs(distNC / r - 1) > relThreshold) return null;
            if (Math.abs(distPC - r) > absThreshold || Math.abs(distNC - r) > absThreshold) return null;

            const midPoint = new Vector2((p.x + nextP.x) / 2, (p.y + nextP.y) / 2);
            const distMC = Math.hypot(midPoint.x - x, midPoint.y - y);

            if (Math.abs(distMC / r - 1) > relThreshold * 2) return null;
            if (Math.abs(distMC - r) > absThreshold * 2) return null;
        }

        return {
            x: x,
            y: y,
            r: r,
            s: startAngle,
            e: endAngle
        };
    }


    public static async svgToRawCommands(xmlString: string): Promise<Map<string, object[]>> {
        const pathifiedXml: string = (optimize(xmlString, { "plugins": [{ name: "convertShapeToPath", params: { "convertArcs": true } }]}) as OptimizedSvg).data;
        const flattenedAndTransformedXml = svgFlatten(pathifiedXml).pathify().flatten().transform().value() as string;
        const idsToPathStrings = SvgToCommands.svgToPaths(flattenedAndTransformedXml);
        const idToCommandsMap = new Map(Array.from(idsToPathStrings.entries()).map(([id, path]) => [id, parseSVG(path) as object[]]));
        Array.from(idToCommandsMap.values()).forEach(coms => makeAbsolute(coms));
        // SvgToCommands.centerCommands(flatten(Array.from(idToCommandsMap.values())));
        console.log(idToCommandsMap);
        return idToCommandsMap;
    }

    public static isArc(obj: ArcCommand | LineCommand | ArcCommandEndPointRep): obj is ArcCommand {
        return 'x' in obj && 'y' in obj && 'r' in obj && 's' in obj && 'e' in obj;
    }
    
    public static isLine(obj: ArcCommand | LineCommand | ArcCommandEndPointRep): obj is LineCommand {
        return 'x0' in obj && 'y0' in obj && 'x' in obj && 'y' in obj && !('sweep' in obj);
    }
    
    public static isArcEndPointRep(obj: ArcCommand | LineCommand | ArcCommandEndPointRep): obj is ArcCommandEndPointRep {
        return 'x' in obj && 
            'y' in obj && 
            'x0' in obj && 
            'y0' in obj && 
            'rx' in obj && 
            'ry' in obj && 
            'largeArc' in obj &&
            'sweep' in obj &&
            'xAxisRotation' in obj;
    }

    // just keep lines and arcs, throw away the rest
    private static _standardizeCommands(commands: object[]): (LineCommand | ArcCommand)[] {
        let standardizedCommands: (LineCommand | ArcCommand)[] = [];
        let bezierStack: Bezier[] = [];

        // Remove move command and empty close path
        commands = commands.filter(c => c['code'] !== 'M' && !(c['code'] === 'Z' && !this._isNonZeroZHVLCommand(c)));

        // If the path is split (=start/end) in between a curve, shift it until it starts with a line
        if(commands.some(c => this._isNonZeroZHVLCommand(c)) && 'ACQS'.includes(commands[0]['code']) && 'ACQS'.includes(commands[commands.length - 1]['code'])) {
            while(!this._isNonZeroZHVLCommand(commands[0])) {
                commands.push(commands.shift());
            }
        }

        commands.forEach((command, idx) => {
            // LINE
            if (this._isNonZeroZHVLCommand(command)) {
                standardizedCommands.push(this._createStandardizedLineCommand(command));
            // ARC
            } else if (command['code'] == "A") {
                if(convertArcsBackAndForth) {
                    const arc2 = this._arcCommandToArc2(command);
                    const cubic = arcToBezier(arc2);
                    const bezier = this._cubicBezierCurvesToBeziers(cubic, new Vector2(command['x0'], command['y0']))
                    bezierStack.push(...bezier);
                } else {
                    standardizedCommands.push(this._createArcFromSVGArc(command));
                }
            // BEZIER
            } else if ('CQS'.includes(command['code'])) {
                bezierStack.push(this._bezierCommandToBezier(command, commands[(idx - 1 + commands.length) % commands.length]));
            }
            // IF THE NEXT CURVE IS NEITHER BEZIER NOR ARC, EMPTY THE BEZIER STACK
            if(bezierStack.length > 0 && (!commands[idx + 1] || !'ACQS'.includes(commands[idx + 1]['code']))) {
                standardizedCommands.push(...this._beziersToArcCommands(bezierStack));
                //standardizedCommands.push(...flatten(bezierStack.map(b => this._bezierToCommands(b))));
                bezierStack = [];
            }
        });

        return standardizedCommands;
    }

    private static _beziersToArcCommands(beziers: Bezier[]): (ArcCommand | LineCommand)[] {
        function v2(point: Point): Vector2 {
            return new Vector2(point.x, point.y);
        }
        function v3(point: Point): Vector3 {
            return new Vector3(point.x, point.y, 0);
        }
        if(beziers.some(b => this._bezierIsStraightLine(b) || this._bezierIsVerySmall(b))) {
            console.warn("degenerated!");
            return [];
        }
        const last = beziers[beziers.length - 1];
        const startPoint = v2(beziers[0].get(0));
        const endPoint = v2(last.get(1));

        // CIRCLE (360° ARC)
        if(startPoint.distanceTo(endPoint) < 0.001) {
            const arcs = flatten(beziers.map(b => this._bezierToCommands(b)));
            const arc = arcs[0] as ArcCommand;
            return [
                { r: arc.r, x: arc.x, y: arc.y, s: 0, e: Math.PI, },
                { r: arc.r, x: arc.x, y: arc.y, s: Math.PI, e: Math.PI * 2}
            ]
        }

        const startNormal = v2(beziers[0].normal(0));
        const endNormal = v2(last.normal(1));
        const startExtraPoint = startPoint.clone().add(startNormal);
        const endExtraPoint = endPoint.clone().add(endNormal);
        const intersectionResult = intersect.findIntersection([ startPoint, startExtraPoint, endPoint, endExtraPoint ]);
        let intersection = v2(intersectionResult);

        // 180° ARC
        if(isNaN(intersection.x)) {
            console.log("180° ARC");
            intersection = new Vector2().lerpVectors(startPoint, endPoint, 0.5);
        }
        console.log(intersection);

        const d1 = intersection.distanceTo(startPoint);
        const d2 = intersection.distanceTo(endPoint);
        const canBeConnectedWithSingleArc = Math.abs(d1 - d2) < 0.001;
        if(canBeConnectedWithSingleArc) {
            const radius = (d1 + d2)/2;
            let a1 = v2(beziers[0].derivative(0)).angle() + Math.PI/2;
            let a2 = v2(last.derivative(1)).angle() + Math.PI/2;
            if(beziers[0].clockwise && a1 < a2) {
                a1 += Math.PI * 2;
            }
            if(!beziers[0].clockwise) {
                a1 += Math.PI;
                a2 += Math.PI;
            }
            if(!beziers[0].clockwise && a1 > a2) {
                a2 += Math.PI * 2;
            }
            return [{
                r: radius,
                x: intersection.x,
                y: intersection.y,
                s: a1,
                e: a2,
            } as ArcCommand]
        } else {
            return flatten(beziers.map(b => this._bezierToCommands(b)));
        }
    }

    private static svgToPaths(svg: string): Map<string, string> {
        const node = parse(svg);
        const recursivelyFindPaths = ((node: ElementNode): ElementNode[] => {
            if(node.type === "element" && node.tagName === "path") {
                return [node];
            } else if(node.type === "element" && node.children.length > 0) {
                const children = node.children.filter(c => !(c instanceof string)) as SvgNode[];
                return flatten(children.map(c => recursivelyFindPaths(c)));
            } else {
                return [];
            }
        })
        const svgNode = node.children.find(c => c.type === "element" && c.tagName === "svg") as ElementNode;
        const pathNodes = recursivelyFindPaths(svgNode);
        const map = new Map(pathNodes.map((n, i) => [n.properties.id + "_" + i.toString(), n.properties.d] as [string, string]));
        return map;
    }

    private static _splitIntoSubshapes(idToCommandsMap: Map<string, object[]>): Map<string, object[]> {
        let subShapes = new Map<string, object[]>();
        idToCommandsMap.forEach((coms, id) => {
            let numberOfSubshapes = 0;
            subShapes.set(id + numberOfSubshapes, []);
            coms.forEach((command, idx) => {
                // when we close a shape (Z command), then we start a new subshape
                subShapes.get(id + numberOfSubshapes).push(command);
                if (command['code'] == 'Z' && idx < coms.length - 1) {
                    numberOfSubshapes++;
                    subShapes.set(id + numberOfSubshapes, []);
                }
            });
        })
        return subShapes;
        
    }

    private static centerCommands(commands: object[]): void {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const xCoords = ["x", "x0", "x1", "x2"];
        const yCoords = ["y", "y0", "y1", "y2"];
        for(const command of commands) {
            const keys = Array.from(Object.keys(command));
            // we have to exclude x0 and y0 from moveto commands, as they don't represent geometry (they are always 0)
            const relevantXCoordinates = keys.filter(k => xCoords.includes(k) && !(command['command'] === "moveto" && k === "x0"));
            const relevantYCoordinates = keys.filter(k => yCoords.includes(k) && !(command['command'] === "moveto" && k === "y0"));
            for(const c of relevantXCoordinates) {
                const val = command[c] as number;
                minX = Math.min(val, minX);
                maxX = Math.max(val, maxX);
            }
            for(const c of relevantYCoordinates) {
                const val = command[c] as number;
                minY = Math.min(val, minY);
                maxY = Math.max(val, maxY);
            }
        }
        const xShift = -(minX + maxX) / 2;
        const yShift = -(minY + maxY) / 2;
        for(const command of commands) {
            const keys = Array.from(Object.keys(command));
            const relevantXCoordinates = keys.filter(k => xCoords.includes(k));
            const relevantYCoordinates = keys.filter(k => yCoords.includes(k));
            for(const c of relevantXCoordinates) {
                command[c] += xShift;
            }
            for(const c of relevantYCoordinates) {
                command[c] += yShift;
            }
        }
    }

    private static _bezierCommandToBezier(command: object, prevCommand: object): Bezier {
        if (!'CQS'.includes(command['code'])) {
            console.error("did not input Bezier command!");
        }
        if (command['code'] === "S") {
            const xDiff = command['x0'] - prevCommand['x2'];
            const yDiff = command['y0'] - prevCommand['y2'];
            command['x1'] = command['x0'] + xDiff;
            command['y1'] = command['y0'] + yDiff;
        }
        if (command['code'] === "Q") {
            command['x2'] = command['x1'];
            command['y2'] = command['y1'];
        }
        return new Bezier(command['x0'], command['y0'],command['x1'], command['y1'], command['x2'], command['y2'], command['x'], command['y']);
    }

    private static _arcCommandToArc2(command: object): Arc2 {
        return {
            px: command['x0'],
            py: command['y0'],
            cx: command['x'],
            cy: command['y'],
            rx: command['rx'],
            ry: command['ry'],
            xAxisRotation: command['xAxisRotation'],
            largeArcFlag: command['largeArc'] ? 1 : 0,
            sweepFlag: command['sweep'] ? 1 : 0,
        };
    }

    private static _cubicBezierCurvesToBeziers(cubicBezierCurves: CubicBezierCurve[], startPoint: Vector2): Bezier[] {
        return cubicBezierCurves.map((curve, idx) => {
            let x0: number, y0: number;
            if (idx === 0) {
                x0 = startPoint.x;
                y0 = startPoint.y;
            }
            else {
                x0 = cubicBezierCurves[idx-1]['x'];
                y0 = cubicBezierCurves[idx-1]['y'];
            }
            return new Bezier(
                x0, 
                y0,
                curve['x1'], 
                curve['y1'],
                curve['x2'], 
                curve['y2'],
                curve['x'], 
                curve['y']
            );
            
        });
    }

    private static _isNonZeroZHVLCommand(command: object): boolean {
        return "ZHVL".includes(command['code']) &&
            !isNaN(command['x0']) && !isNaN(command['y0']) && 
            !isNaN(command['x']) && !isNaN(command['y']) && (
                !HardcodedShapeDetection._almostEqualAbsolute([command['x0'], command['x']], .0001) || 
                !HardcodedShapeDetection._almostEqualAbsolute([command['y0'], command['y']], .0001)
            );
    }

    private static _bezierToCommands(bezier: Bezier): (LineCommand | ArcCommand)[] {
        if(this._bezierIsVerySmall(bezier)) {
            console.warn("VERY SMALL BEZIER", bezier);
            return [];
        }
        if(this._bezierIsStraightLine(bezier)) {
            console.warn("STRAIGHT BEZIER", bezier);
            return [this._straightBezierToLineCommand(bezier)];
        }
        const arcs = bezier.arcs(1000);
        if(bezier.clockwise) {
            arcs.forEach(arc => {
                const temp = arc.s;
                arc.s = arc.e;
                arc.e = temp;
            })
        }
        const commands = arcs.map(a => this._createStandardizedArcCommand(a));
        return commands;
    }

    private static _bezierIsVerySmall(bezier: Bezier): boolean {
        const firstPoint = new Vector2(bezier.points[0].x, bezier.points[0].y);
        const l = bezier.points.length - 1;
        const lastPoint = new Vector2(bezier.points[l].x, bezier.points[l].y);
        if(HardcodedShapeDetection._almostZeroAbsolute([firstPoint.distanceTo(lastPoint)])) {
            return true;
        }
    }

    private static _straightBezierToLineCommand(bezier: Bezier): LineCommand {
        const firstPoint = bezier.points[0];
        const l = bezier.points.length - 1;
        const lastPoint = bezier.points[l];
        const command: LineCommand = {
            x0: firstPoint.x,
            y0: firstPoint.y,
            x: lastPoint.x,
            y: lastPoint.y,
        }
        return command;
    }

    private static _bezierIsStraightLine(bezier: Bezier): boolean {
        const firstPoint = new Vector2(bezier.points[0].x, bezier.points[0].y);
        const l = bezier.points.length - 1;
        const lastPoint = new Vector2(bezier.points[l].x, bezier.points[l].y);
        const distance = firstPoint.distanceTo(lastPoint);
        return HardcodedShapeDetection._almostEqualRelative([bezier.length(), distance], 0.01);
    }

    private static _createStandardizedArcCommand(arc: Arc): ArcCommand {
        let newCommand: ArcCommand = {
            x: arc.x,
            y: arc.y,
            r: arc.r,
            s: arc.s,
            e: arc.e,
        }
        return newCommand;
    }

    private static _createStandardizedLineCommand(command: object): LineCommand {
        let newCommand: LineCommand = {
            x0: command['x0'],
            y0: command['y0'],
            x: command['x'],
            y: command['y']
        }
        return newCommand;
    }

    private static _createArcFromSVGArc(command: object): ArcCommand {
        const centerRep = svgArcToCenterParam(
            command["x0"], command["y0"],
            command["rx"], command["ry"],
            command["xAxisRotation"], 
            command["largeArc"], command["sweep"],
            command["x"], command["y"]);

        return {
            x: centerRep.x, 
            y: centerRep.y,
            r: centerRep.rx,
            s: centerRep.startAngle,
            e: centerRep.endAngle,
        };
    }

    private static _formatArcObject(arc: object): object {
        let newCommand = Object.assign({}, arc);
        newCommand['code'] = 'A';
        return newCommand;
    }

    // implemented from this approach: https://www.w3.org/TR/SVG/implnote.html#ArcConversionCenterToEndpoint
    public static _convertCenterRepToEndpointRep(arc: ArcCommand): ArcCommandEndPointRep {
        let phi = 0;
        let r = arc.r;
        let x = arc.x;
        let y = arc.y;
        let theta1 = arc.s;
        let theta2 = arc.e;
        let deltaTheta = theta2 - theta1;
        
        // first compute start point (x1, y1)
        // (equivalent to x0 and y0 in the SVG arc spec)
        let m1 = [[Math.cos(phi), -Math.sin(phi)], [Math.sin(phi), Math.cos(phi)]];
        let m2 = [[r*Math.cos(theta1)], [r*Math.sin(theta1)]];
        let m3 = [[x], [y]];
        let m4 = this._multiplyMatrices(m1, m2);
        let x1y1 = this._addMatrices(m4, m3);

        // then compute end point (x2, y2)
        // (equivalent to x and y in the SVG arc spec)
        let m5 = [[r*Math.cos(theta2)], [r*Math.sin(theta2)]];
        let m6 = this._multiplyMatrices(m1, m5);
        let x2y2 = this._addMatrices(m6, m3);

        // then compute the flags
        let largeArcFlag: 0 | 1 = Math.abs(deltaTheta) > Math.PI ? 1 : 0;
        let sweepFlag: 0 | 1 = deltaTheta > 0 ? 1 : 0;

        const result = {
            x0: x1y1[0][0],
            y0: x1y1[1][0],
            rx: r,
            ry: r,
            largeArc: largeArcFlag,
            sweep: sweepFlag,
            x: x2y2[0][0],
            y: x2y2[1][0],
            xAxisRotation: 0
        }
        return result;
    }
    
    private static _addMatrices(m1: number[][], m2: number[][]): number[][] {
        let result = [];
        for (let i = 0; i < m1.length; i++) {
            result.push([]);
            for (let j = 0; j < m1[i].length; j++) {
                result[i].push(m1[i][j] + m2[i][j]);
            }
        }
        return result;
    }

    private static _multiplyMatrices(m1: number[][], m2: number[][]): number[][] {
        var result = [];
        for (var i = 0; i < m1.length; i++) {
            result[i] = [];
            for (var j = 0; j < m2[0].length; j++) {
                var sum = 0;
                for (var k = 0; k < m1[0].length; k++) {
                    sum += m1[i][k] * m2[k][j];
                }
                result[i][j] = sum;
            }
        }
        return result;
    }

    private static _ensureEndPointRep(cmd: ArcCommand | ArcCommandEndPointRep | LineCommand): ArcCommandEndPointRep | LineCommand {
        if(this.isArc(cmd)) {
            return this._convertCenterRepToEndpointRep(cmd);
        } else {
            return cmd;
        }
    }

    public static _commandsToPath(data: (ArcCommand | ArcCommandEndPointRep | LineCommand)[]): string {
        if(data.length === 0) return "";
        let result = "";
        const firstCommand = this._ensureEndPointRep(data[0]);
        result += "M" + firstCommand.x0 + "," + firstCommand.y0 + ",";
        data.forEach(cmd => {
            const eCmd = this._ensureEndPointRep(cmd);
            if(this.isLine(eCmd)) {
                result += "L" + eCmd.x + "," + eCmd.y + ",";
            } else {
                const aCmd = eCmd as ArcCommandEndPointRep;
                result += "A" + aCmd.rx + "," + aCmd.ry + "," + aCmd.xAxisRotation + "," + aCmd.largeArc + "," + aCmd.sweep + "," + aCmd.x + "," + aCmd.y + ",";
            }
        });
        result += "Z";
        return result;
    }
}



