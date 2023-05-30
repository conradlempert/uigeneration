import ToolSet from "../dataTypes/ToolSet";
import SvgDocument from "../dataTypes/SvgDocument";
import { ShapeHierarchy } from "../dataTypes/ShapeHierarchy";
import BeamSearchSubsetGenerator from "../subsetGen/BeamSearchSubsetGenerator";
import { CostWeights } from "../ui/ResultDisplay";
import AutoShape from "../dataTypes/AutoShape";
import { ShapeRepresentation } from "uiGeneration/dataTypes/PathShape";
export class FullRun {

    public static async fullRun(documents: SvgDocument[], shapeHierarchy: ShapeHierarchy, weights: CostWeights, documentsAsToolsAllowed: boolean = true): Promise<ToolSet[]> {
        const toolsets: ToolSet[] = [];    
        let allTools = shapeHierarchy.getAllTools();

        // REMOVE ALL DOCUMENT TOOLS
        const documentTools = Array.from(allTools).filter(t => t.shapeName.startsWith("document_"));
        for(const d of documents) {  
            d.pathShapes.forEach(s => s.representations.forEach(r => { if(r.autoShape.shapeName.startsWith("document_")) s.removeRepresentation(r)}));
        }
        documentTools.forEach(t => allTools.delete(t));

        // ADD DOCUMENT TOOLS IF NEEDED
        if(documentsAsToolsAllowed) {
            for(const d of documents) {
                const shape = new AutoShape("document_" + d.name, [], d.pathShapes, [], [], [], null, 0, 2);
                const rep: ShapeRepresentation = { autoShape: shape, pathShapes: d.pathShapes, parameters: [], automaticallyDetermined: true };
                d.pathShapes.forEach(s => s.representations.push(rep));
                allTools.add(shape);
            }
        }

        console.log("%cNumber of tools considered: " + allTools.size, "font-weight: bold");
        const subsetGenerator = new BeamSearchSubsetGenerator<AutoShape>(allTools);

        let set: AutoShape[];
        console.log("STEP 2: checking toolsets");
        while (set = subsetGenerator.next()) {
            let toolset = new ToolSet(set);
            toolset.evalOn(documents, weights);
            subsetGenerator.addResult(Array.from(toolset.getSet()), toolset.getTotalCost());
            toolsets.push(toolset);
        }
        return toolsets;
    }
}