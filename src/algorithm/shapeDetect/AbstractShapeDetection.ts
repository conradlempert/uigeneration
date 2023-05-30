import AutoShape from "../../dataTypes/AutoShape";
import SvgDocument from "../../dataTypes/SvgDocument";

export default class AbstractShapeDetection {
    public static async detectShapes(documents: SvgDocument[]): Promise<AutoShape[]> {
        console.error("not implemented");
        return null;
    }
}