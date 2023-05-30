import AbstractShapeDetection from "./AbstractShapeDetection";
import AutoShape, { CommandType } from "../../dataTypes/AutoShape";
import SvgDocument from "../../dataTypes/SvgDocument";

export default class EmptyShapeDetection extends AbstractShapeDetection {
    public static async detectShapes(documents: SvgDocument[]): Promise<AutoShape[]> {
        return [];
    }
}