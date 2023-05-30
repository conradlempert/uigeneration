import AutoShape from "./AutoShape";
import PathShape from "./PathShape";

export class ShapeHierarchy {
    shapeTools: Map<string, AutoShape>;

    constructor() {
        this.shapeTools = new Map<string, AutoShape>();
    }

    public addShapeTool(shapeTool: AutoShape) {
        this.shapeTools.set(shapeTool.shapeName, shapeTool);
    }

    public getShapeTool(shapeName: string): AutoShape {
        return this.shapeTools.get(shapeName);
    }

    public getAllTools(): Set<AutoShape> {
        return new Set(this.shapeTools.values());
    }

    public addShapeToolsFromShapeLibrary(shapeLibrary: AutoShape[], exampleShapes: PathShape[]) {
        for(const shapeType of shapeLibrary) {
            this.addShapeTool(shapeType);
        }
    }

}