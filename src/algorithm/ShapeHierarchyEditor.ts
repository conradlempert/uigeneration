import AutoShape from "../dataTypes/AutoShape";
import SvgDocument from "../dataTypes/SvgDocument";

export default class ShapeHierarchyExtractor {
    static extractShapeHierarchyFromDocuments(documents: SvgDocument[]): AutoShape[] {
        const paths = [];
        for (const document of documents) {
            for (const shape of document.pathShapes) {
                paths.push(shape.path);
            }
        }
        return [];
    }
}