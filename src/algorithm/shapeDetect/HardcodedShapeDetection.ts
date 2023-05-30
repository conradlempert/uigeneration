import PathShape from "../../dataTypes/PathShape";
import { std, median } from "mathjs";
import AbstractShapeDetection from "./AbstractShapeDetection";
import AutoShape, { CommandType } from "../../dataTypes/AutoShape";
import SvgDocument from "../../dataTypes/SvgDocument";

export default class HardcodedShapeDetection extends AbstractShapeDetection {

    public static async detectShapes(documents: SvgDocument[]): Promise<AutoShape[]> {

        const exampleRectangle = new PathShape(
            "example_rect",
            "M0,0 L50,0 L50,50 L0,50 Z",
            [
                { x0: 0, y0: 0, x: 50, y: 0},
                { x0: 50, y0: 0, x: 50, y: 50},
                { x0: 0, y0: 0, x: 50, y: 0},
                { x0: 0, y0: 0, x: 50, y: 0},
            ],
            [],
        )
        
        const rectangleAutoShape = new AutoShape(
            "rectangle",
            [],
            [exampleRectangle],
            [],
            [],
            [ CommandType.Line, CommandType.Line, CommandType.Line, CommandType.Line ],
            new Array(4).map(x => { return {min: -100, max: 100}}),
            4,
            1
        )

        exampleRectangle.representations.push({ autoShape: rectangleAutoShape, pathShapes: [exampleRectangle], automaticallyDetermined: true, parameters: []})
        return [rectangleAutoShape];
    }

    // public static detectShape(commands: (ArcCommand | LineCommand)[], currentId: string): ParametrizedShape | null {
    //     const shape = this._runShapeDetection(commands);
    //     if(shape !== null) {
    //         this._addMetaDataToShape(shape, commands, currentId);
    //         return shape;
    //     } else {
    //         return null;
    //     }
    // }

    // private static _addMetaDataToShape(shape: ParametrizedShape, commands: (ArcCommand | LineCommand)[], currentId: string) {
    //     shape.path = SvgToCommands._commandsToPath(commands);
    //     shape.id = currentId;
    //     shape.parametersValid = shape.type === "other" ? false : true;
    // }

    // private static _runShapeDetection(commands: (ArcCommand | LineCommand)[]): ParametrizedShape | null {
    //     if(commands.length === 0) {
    //         console.warn("NO COMMANDS");
    //         return null;
    //     }
    //     if(this._onlyArcs(commands)) {
    //         const arcCommands = commands as ArcCommand[];
    //         if(this._isCircle(arcCommands)) {
    //             return this._createCircleShape(arcCommands);
    //         }
    //     }
    //     if(this._onlyLines(commands)) {
    //         const lineCommands = commands as LineCommand[];
    //         if(this._isQuadriliteral(lineCommands)) {
    //             if(this._isRect(lineCommands)) {
    //                 return this._createRectShape(lineCommands);
    //             }
    //         }
    //     }
    //     if(this._isPillShape(commands)) {
    //         return this._createPillShape(commands);
    //     }
    //     if(this._isRoundtangle(commands)) {
    //         return this._createRoundtangleShape(commands);
    //     }
    //     return new ParametrizedShape("", 'other', {});
    // }

    // private static _getLineArcSignature(commands: (LineCommand|ArcCommand)[]): string {
    //     return commands.map(c => SvgToCommands.isArc(c) ? "A" : "L").join("");
    // }

    // private static _isQuadriliteral(commands: LineCommand[]): boolean {
    //     return commands.length === 4;
    // }

    public static _almostEqualRelative(numbers: number[], threshold = 0.05): boolean {
        const med = median(numbers);
        const dev = std(numbers) as any as number;
        return dev < threshold * med;
    }

    public static _almostEqualAbsolute(numbers: number[], threshold = 0.05): boolean {
        const dev = std(numbers) as any as number;
        return dev < threshold;
    }

    public static _almostZeroAbsolute(numbers: number[], threshold = 0.05): boolean {
        return numbers.every(n => n < 0.1);
    }

    public static _almostZeroRelative(numbers: number[], size: number, threshold = 0.05): boolean {
        return numbers.every(n => n < threshold * size);
    }

    // private static _isRect(commands: LineCommand[]): boolean {
    //     const lengths = this._linesToLengths(commands);
    //     return this._almostEqualRelative([lengths[0], lengths[2]]) && 
    //         this._almostEqualRelative([lengths[1], lengths[3]]);
    // }

    // private static _onlyArcs(commands: (LineCommand|ArcCommand)[]): boolean {
    //     return !this._getLineArcSignature(commands).includes("L");
    // }
    
    // private static _onlyLines(commands: (LineCommand|ArcCommand)[]): boolean {
    //     return !this._getLineArcSignature(commands).includes("A");
    // }

    // private static _linesToPoints(commands: LineCommand[]): Vector2[] {
    //     return commands.map(command => {
    //         return new Vector2(command['x0'], command['y0']);
    //     });
    // }

    // private static _linesToLengths(commands: LineCommand[]): number[] {
    //     const points = this._linesToPoints(commands);
    //     const lengths = points.map((p, i) => p.distanceTo(points[i === points.length - 1 ? 0 : i + 1]));
    //     return lengths;
    // }

    // private static _isCircle(commands: ArcCommand[]): boolean {

    //     const centers = commands.map(c => this._getCenter(c));
    //     const radii = commands.map(c => c.r);
    //     const distances: number[] = [];

    //     for (let i = 0; i < centers.length; i++) {
    //         for (let j = i+1; j < centers.length; j++) {
    //             distances.push(centers[i].distanceTo(centers[j]));
    //         }
    //     }
    //     if (this._almostEqualRelative(radii, 0.2) && this._almostZeroRelative(distances, radii[0], 0.2)) {
    //         // console.log("CIRCLE", radii, distances);
    //         return true;
    //     } else {
    //         // console.log("NO CIRCLE", radii, distances);
    //         return false;
    //     }
    // }
    // private static _createCircleShape(commands: ArcCommand[]): ParametrizedShape {

    //     const centers = commands.map(c => this._getCenter(c));
    //     const radii = commands.map(c => c.r);
    //     const medianRadius = median(radii);
    //     const center = new Vector2(median(centers.map(v => v.x)), median(centers.map(v => v.y)));
    //     const parameters: CircleParameters = {x: center.x, y: center.y, r: medianRadius};
            
    //     return new ParametrizedShape("", 'circle', parameters);

    // }

    // private static _getCenter(command: ArcCommand): Vector2 {
    //     return new Vector2(command.x, command.y);
    // }

    // private static _getLineCommands(commands: (LineCommand | ArcCommand)[]): LineCommand[] {
    //     return commands.filter(c => SvgToCommands.isLine(c)) as LineCommand[];
    // }

    // private static _getArcCommands(commands: (LineCommand | ArcCommand)[]): ArcCommand[] {
    //     return commands.filter(c => SvgToCommands.isArc(c)) as ArcCommand[];
    // }

    // private static _hasRoundtanglePattern(commands: (LineCommand | ArcCommand)[]): boolean {
    //     const sig = this._getLineArcSignature(commands);
    //     return sig === "ALALALAL" || sig === "LALALALA";
    // }

    // private static _hasPillShapePattern(commands: (LineCommand | ArcCommand)[]): boolean {
    //     const sig = this._getLineArcSignature(commands);
    //     return sig === "AALAAL" || sig === "ALAALA" || sig === "LAALAA";
    // }

    // private static _isPillShape(commands: (LineCommand | ArcCommand)[]): boolean {
    //     if(!this._hasPillShapePattern(commands)) {
    //         return false;
    //     }
    //     const lineCommands = this._getLineCommands(commands);
    //     const arcCommands = this._getArcCommands(commands);
    //     const lengths = this._linesToLengths(lineCommands);
    //     if(!this._almostEqualRelative([lengths[0], lengths[1]])) {
    //         return false;
    //     }
    //     if(!this._almostEqualRelative(arcCommands.map(c => c.r))) {
    //         return false;
    //     }
    //     return true;
    // }

    // private static _isRoundtangle(commands: (LineCommand | ArcCommand)[]): boolean {
    //     if(!this._hasRoundtanglePattern(commands)) {
    //         return false;
    //     }
    //     const lineCommands = this._getLineCommands(commands);
    //     const arcCommands = this._getArcCommands(commands);
    //     const lengths = this._linesToLengths(lineCommands);
    //     if(!this._almostEqualRelative([lengths[0], lengths[2]]) || !this._almostEqualRelative([lengths[1], lengths[3]])) {
    //         return false;
    //     }
    //     if(!this._almostEqualRelative(arcCommands.map(c => c.r))) {
    //         return false;
    //     }
    //     return true;
    // }

    // private static _getMiddleNormalIntersection(command1: LineCommand, command2: LineCommand): Vector2 {
    //     const line1 = this._lineCommandToLine(command1);
    //     const line2 = this._lineCommandToLine(command2);
    //     const norm1 = this._getLineNormal(line1);
    //     const norm2 = this._getLineNormal(line2);
    //     console.log(norm1, norm2);
    //     return norm1.intersect(norm2);
    // }

    // private static _getMiddleBetweenParallelLines(command1: LineCommand, command2: LineCommand): Vector2 {
    //     const line1 = this._lineCommandToLine(command1);
    //     const line2 = this._lineCommandToLine(command2);
    //     const norm1 = this._getLineNormal(line1);
    //     const norm2 = this._getLineNormal(line2);
    //     const l1n2 = line1.intersect(norm2);
    //     const l2n1 = line2.intersect(norm1);
    //     console.log(line1, line2, norm1, norm2, l1n2, l2n1);
    //     const intersectionLine = new Line(l1n2, l2n1);
    //     return intersectionLine.getMiddle();
    // }

    // private static _lineCommandToLine(command: LineCommand): Line {
    //     const start = new Vector2(command.x0, command.y0);
    //     const end = new Vector2(command.x, command.y);
    //     return new Line(start, end);
    // }

    // private static _getLineNormal(line: Line): Line {
    //     const p1 = line.getMiddle();
    //     const dir = line.toVector();
    //     const normalDir = new Vector2(dir.y, -dir.x);
    //     const p2 = p1.clone().add(normalDir);
    //     return new Line(p1, p2);
    // }
    
    // private static _createRectShape(commands: LineCommand[]): ParametrizedShape {
    //     const rectPoints = this._linesToPoints(commands);
    //     const lengths = this._linesToLengths(commands);
    //     let x = (rectPoints[0].x + rectPoints[1].x)/2;
    //     let y = (rectPoints[1].y + rectPoints[2].y)/2;
    //     //console.log("rect points", rectPoints);
    //     const parameters: RectangleParameters = {x: x, y: y, w: lengths[0], h: lengths[1], rot: 0};
    //     //console.log("parameters", parameters);
    //     return new ParametrizedShape("", 'rectangle', parameters);
    // }
    
    // private static _createRoundtangleShape(commands: (LineCommand|ArcCommand)[]): ParametrizedShape {
    //     console.log(commands);
    //     const lineCommands = this._getLineCommands(commands);
    //     const radius = this._getArcCommands(commands)[0].r;
    //     const middle = this._getMiddleNormalIntersection(lineCommands[0], lineCommands[1]);
    //     const lengths = this._linesToLengths(lineCommands);
    //     return new ParametrizedShape("", 'roundtangle', {x: middle.x, y: middle.y, w: lengths[0] + radius, h: lengths[1] + radius, r: radius, rot: 0});
    // }

    // private static _createPillShape(commands: (LineCommand|ArcCommand)[]): ParametrizedShape {
    //     console.log(commands);
    //     const lineCommands = this._getLineCommands(commands);
    //     const radius = this._getArcCommands(commands)[0].r;
    //     const middle = this._getMiddleBetweenParallelLines(lineCommands[0], lineCommands[1]);
    //     const lengths = this._linesToLengths(lineCommands);
    //     const angle = this._angleFromXAxisBetween0and180(lineCommands[0]);
    //     console.log("ANGLE", angle);
    //     return new ParametrizedShape("", 'pill', {x: middle.x, y: middle.y, w: lengths[0] + radius, r: radius, rot: angle});
    // }

    // private static _angleFromXAxisBetween0and180(cmd: LineCommand): number {
    //     const line = this._lineCommandToLine(cmd);
    //     const xAxis = new Line(new Vector2(0, 0), new Vector2(1, 0));
    //     return line.angleTo(xAxis);
    // }
}