import SvgToCommands from "./SvgToCommands";
import AutoShape from "../dataTypes/AutoShape";
import SvgDocument from "../dataTypes/SvgDocument";
import EmptyShapeDetection from "./shapeDetect/EmptyShapeDetection";
import ConstraintShapeDetection from "./shapeDetect/ConstraintShapeDetection";

export default class DocumentCreator {

    public static async createDocuments(svgs: string[]): Promise<{documents: SvgDocument[], autoShapes: AutoShape[]}> {
        const documents: SvgDocument[] = [];

        for(const [i,svg] of svgs.entries()) {
            try {
                documents.push(await SvgToCommands.svgToCommands(svg));
                console.log("CONVERT TO COMMANDS: " + (100*i/svgs.length).toFixed(2) + " %");
            } catch (e) {
                console.warn("BROKEN SVG: ", e);
            }
        }

        console.log("DETECTING SHAPES");
        // Swap this out for the shape detection you want to use
        const autoShapes = await EmptyShapeDetection.detectShapes(documents);

        return { documents, autoShapes };
    }
}