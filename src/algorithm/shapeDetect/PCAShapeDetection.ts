import { flatten } from "lodash";
import PCAShapeExtractor from "../PCAShapeExtractor";
import AutoShape from "../../dataTypes/AutoShape";
import SvgDocument from "../../dataTypes/SvgDocument";
import PathShape from "../../dataTypes/PathShape";
import SvgToCommands, { ArcCommand, LineCommand } from "../SvgToCommands";
import AbstractShapeDetection from "./AbstractShapeDetection";

export default class PCAShapeDetection extends AbstractShapeDetection {

    public static async detectShapes(documents: SvgDocument[]): 
        Promise<AutoShape[]> {

        let allShapes: PathShape[] = flatten(documents.map(d => d.pathShapes));

        let topologies = PCAShapeDetection.groupByTopology(allShapes);
        let autoShapes : AutoShape[] = [];

        for (const [topology, shapesWithTopology] of topologies) {

            if (topology == "") continue;

            const autoShape = PCAShapeExtractor.run(shapesWithTopology);
            autoShapes.push(autoShape);
            shapesWithTopology.forEach(shape => {
                shape.representations.push({ autoShape, pathShapes: [shape], automaticallyDetermined: true, parameters: []}) // TODO FIX PARAMS
            })

            // shapeExtractor.getSpecializations(5000).forEach((shape, i) => {
            //     shapeExtractors.push(shape);
            // });
        }

        return autoShapes;
    }

    static getStringPath(shapeCommands: (LineCommand | ArcCommand)[]): string {
        return SvgToCommands._commandsToPath(shapeCommands);
    }

    public static groupByTopology(shapes: PathShape[]): Map<string, PathShape[]> {
        let topologies = new Map();

        for (const shape of shapes) {
            let regShape = this.regularizeShape(shape.commands);
            let topology = this.getTopology(regShape);

            let topologyMatched = false;
            for (let i = 0; i < topology.length; i++) {
                const topologyPermutation = topology.slice(i) + topology.slice(0, i);
                if (topologies.has(topologyPermutation)) {
                    let shapePermutation = regShape.slice(i).concat(regShape.slice(0, i));
                    shape.commands = shapePermutation;
                    topologies.get(topologyPermutation).push(shape);
                    topologyMatched = true;
                    break;
                }
            }

            if (!topologyMatched) {
                shape.commands = regShape;
                topologies.set(topology, [shape]);
            }
        }

        return topologies;
    }

    // this should probably be done earlier
    static regularizeShape(shape: (LineCommand | ArcCommand)[]): (LineCommand | ArcCommand)[] {
        return this.makeCCW(shape);
    }

    static _linesCanBeCollapsed(a: LineCommand, b: LineCommand): boolean {
        // Check if second point of a is equal to first of b
        if (Math.max(Math.abs(b.x0 - a.x), Math.abs(b.y0 - a.y)) > 1) return false;
        // Check if the line commands are collinear
        return Math.abs((b.x0 - a.x0) * (b.y - a.y0) - (b.y0 - a.y0) * (b.x - a.x0)) < 1;
    }

    static _arcCanBeCollapsed(a: ArcCommand, b: ArcCommand): boolean {
        // Check if center and radius of a is equal to b and they are adjacent
        if (Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) > 1) return false;
        if (Math.abs(b.r - a.r) > 1) return false;

        
        const normAngle = (angle: number) => {
            while (angle < 0) angle += 2 * Math.PI;
            while (angle > 2 * Math.PI) angle -= 2 * Math.PI;
            return angle;
        }

        // Check if the arc commands are adjacent and have the same direction
        if (Math.abs(normAngle(a.e) - normAngle(b.s)) > 0.01) return false;
        if (Math.sign(a.e - a.s) != Math.sign(b.e - b.s)) return false;

        // only collapse arcs with less than 180 degrees
        if (Math.abs((a.e - a.s) + (b.e - b.s)) > Math.PI) return false;

        return true;
    }



    static makeCCW(shapeCommands: (LineCommand | ArcCommand)[]): (LineCommand | ArcCommand)[] {
        // compute angle of traversal

        if (shapeCommands.length <= 1) {
            return shapeCommands;
        }

        let angle = 0;
        let lastAngle;

        const lastCommand = shapeCommands[shapeCommands.length - 1];
        if (SvgToCommands.isArc(lastCommand)) {
            lastAngle = lastCommand.e;
        } else {
            lastAngle = Math.atan2(lastCommand.y - lastCommand.y0, lastCommand.x - lastCommand.x0);
        }

        for (const command of shapeCommands) {
            if (SvgToCommands.isArc(command)) {
                let dAngle = command.e - lastAngle;
                dAngle = dAngle > Math.PI ? dAngle - 2 * Math.PI : dAngle;

                angle += dAngle;
                lastAngle = command.e;
            } else {
                const currAngle = Math.atan2(command.y - command.y0, command.x - command.x0);
                let dAngle = currAngle - lastAngle;
                dAngle = (dAngle + 2 * Math.PI) % (2 * Math.PI);
                dAngle = dAngle > Math.PI ? dAngle - 2 * Math.PI : dAngle;

                angle += dAngle;
                lastAngle = currAngle;
            }
        }

        if (angle >= 0) return shapeCommands;
        return this.reverseCommands(shapeCommands);
    }

    static reverseCommands(shapeCommands: (LineCommand | ArcCommand)[]) {
        const reversedCommands: (LineCommand | ArcCommand)[] = [];

        for (let i = shapeCommands.length - 1; i >= 0; i--) {
            const command = shapeCommands[i];
            if (SvgToCommands.isArc(command)) {
                reversedCommands.push({
                    x: command.x,
                    y: command.y,
                    r: command.r,
                    s: command.e,
                    e: command.s,
                });
            } else {
                reversedCommands.push({
                    x: command.x0,
                    y: command.y0,
                    x0: command.x,
                    y0: command.y,
                });
            }
        }

        return reversedCommands;
    }

    static getTopology(commands: (LineCommand | ArcCommand)[]): string {
        return commands.map(
            shape => SvgToCommands.isArc(shape) ? "A" : "L"
        ).join("");
    }
}