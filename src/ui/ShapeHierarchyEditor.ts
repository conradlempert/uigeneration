import * as go from "gojs";
import AutoShape from "../dataTypes/AutoShape";
export default class ShapeHierarchyEditor {

    public static shapeLibrary: AutoShape[];

    public static initialize(shapeLibrary: AutoShape[], shapeImages: Map<string, string>) {
        this.shapeLibrary = shapeLibrary;
        let wrapper = document.createElement("div"); // test this
        wrapper.id = "shapeHierarchyEditor";
        wrapper.style.width = "95%";
        wrapper.style.height = "95%";
        wrapper.style.position = "absolute";
        wrapper.style.top = "2%";
        wrapper.style.left = "2%";
        wrapper.style.zIndex = "10000";
        wrapper.style.backgroundColor = "white";
        wrapper.style.overflowY = "auto";
        document.body.appendChild(wrapper);

        const $ = go.GraphObject.make;

        var roundedRectangleParams = {
            parameter1: 2,  // set the rounded corner
            spot1: go.Spot.TopLeft, spot2: go.Spot.BottomRight  // make content go all the way to inside edges of rounded corners
          };
        

        let diagram = new go.Diagram("shapeHierarchyEditor");
        diagram.layout = new go.LayeredDigraphLayout();
        // define the Node template
        diagram.nodeTemplate =
        $(go.Node, "Auto",
            {
            locationSpot: go.Spot.Top,
            isShadowed: true, shadowBlur: 1,
            shadowOffset: new go.Point(0, 1),
            shadowColor: "rgba(0, 0, 0, .14)"
            },
            new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
            // define the node's outer shape, which will surround the TextBlock
            $(go.Shape, "RoundedRectangle", roundedRectangleParams,
            {
                name: "SHAPE", fill: "#aaaaaa", strokeWidth: 0,
                stroke: null,
                portId: "",  // this Shape is the Node's port, not the whole Node
                fromLinkable: true,
                toLinkable: true,
                cursor: "pointer"
            }),
            $(go.Picture, {background: "white", margin: 10, width: 100, height: 100},
            new go.Binding("source").makeTwoWay()),
            $(go.TextBlock, {}, new go.Binding("text","key")),
        );

        
        let links = [];
        for (let shapeA of shapeLibrary) {
            shapeA.specializedBy.forEach(shapeBName => {
                links.push({from:shapeBName.shapeName , to:shapeA.shapeName });
            });
        }

        diagram.model = new go.GraphLinksModel(
            shapeLibrary.map(
                shapeType => {return {key: shapeType.shapeName, source: shapeImages[shapeType.shapeName]};}),
            links  // one link data, in an Array
        );

        diagram.commandHandler.stopCommand = () => {
            document.body.removeChild(wrapper);
        }

        diagram.addDiagramListener("LinkDrawn", e => {
            const link = e.subject.qb;
            this.addLink(link.from, link.to);
        });

        diagram.addDiagramListener("SelectionDeleted", e => {
            e.subject.each(node => {
                const link = node.qb;
                this.removeLink(link.from, link.to);
            });
        });
    }

    private static getShape(shapeName: string) {
        for (let shape of this.shapeLibrary) {
            if (shape.shapeName === shapeName) {
                return shape;
            }
        }
        return null;
    }

    private static addLink(from: string, to: string) {
        const toTool = this.getShape(to);
        toTool.specializedBy.push(this.getShape(from));
    }

    private static removeLink(from: string, to: string) {
        const toTool = this.getShape(to);
        toTool.specializedBy = toTool.specializedBy.filter(
            shape => {return shape.shapeName !== from;});
    }
}