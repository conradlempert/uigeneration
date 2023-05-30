import SvgDocument from "../dataTypes/SvgDocument";
import SvgToCommands, { ArcCommand, LineCommand } from "../algorithm/SvgToCommands";
import {svgArcToCenterParam, normalizeAngle} from "../util/Util";

export default class SVGCommandView {

    private static svgCommandCanvas: HTMLCanvasElement;
    private static svgLinearizedCanvas: HTMLCanvasElement;
    private static svgProcessedCanvas: HTMLCanvasElement;

    private static mapX: (number) => number;
    private static mapY: (number) => number;
    private static mapXScale: (number) => number;
    private static mapYScale: (number) => number;

    private static opened: boolean = false;

    private static lastDrawnCommand: object = null;
    private static closeListener: (e: any) => void;

    public static async initialize(svgDocument: SvgDocument) {

        if (this.opened) {
            throw new Error("SVGCommandView already opened");
        }
        this.opened = true;
        
        const wrapper = document.createElement("div");
        wrapper.id = "svgCommandView";
        wrapper.style.width = "100%";
        wrapper.style.height = "100%";
        wrapper.style.position = "absolute";
        wrapper.style.top = "0px";	
        wrapper.style.left = "0px";
        wrapper.style.zIndex = "10000";
        wrapper.style.backgroundColor = "white";
        wrapper.style.overflowY = "auto";
        document.body.appendChild(wrapper);

        this.svgCommandCanvas = document.createElement("canvas");
        this.svgCommandCanvas.style.width = "800px";
        this.svgCommandCanvas.style.height = "800px";
        this.svgCommandCanvas.width = 800;
        this.svgCommandCanvas.height = 800;
        this.svgCommandCanvas.style.border = "1px solid black";
        this.svgCommandCanvas.style.margin = "10px";
        this.svgCommandCanvas.style.position = "relative";
        this.svgCommandCanvas.id = "svgCommandCanvas";
        wrapper.appendChild(this.svgCommandCanvas);

        this.svgLinearizedCanvas = document.createElement("canvas");
        this.svgLinearizedCanvas.style.width = "800px";
        this.svgLinearizedCanvas.style.height = "800px";
        this.svgLinearizedCanvas.width = 800;
        this.svgLinearizedCanvas.height = 800;
        this.svgLinearizedCanvas.style.border = "1px solid black";
        this.svgLinearizedCanvas.style.margin = "10px";
        this.svgLinearizedCanvas.style.position = "relative";
        this.svgLinearizedCanvas.id = "svgLinearizedCanvas";
        wrapper.appendChild(this.svgLinearizedCanvas);

        this.svgProcessedCanvas = document.createElement("canvas");
        this.svgProcessedCanvas.style.width = "800px";
        this.svgProcessedCanvas.style.height = "800px";
        this.svgProcessedCanvas.width = 800;
        this.svgProcessedCanvas.height = 800;
        this.svgProcessedCanvas.style.border = "1px solid black";
        this.svgProcessedCanvas.style.margin = "10px";
        this.svgProcessedCanvas.style.position = "relative";
        this.svgProcessedCanvas.id = "svgProcessedCanvas";
        wrapper.appendChild(this.svgProcessedCanvas);

        this.closeListener = (e) => {
            if(e.key == "Escape") this.close();
        };

        // close on escape key
        document.addEventListener('keydown', this.closeListener);

        
        const rawSVGCommands = Array.from(
            (await SvgToCommands.svgToRawCommands(svgDocument.originalSvgString)).values()
            ).reduce((a, b) => a.concat(b), []);

        const linearizedSVG = svgDocument.pathShapes.map((x) => x.linearizedShape)
            .filter(x => x != undefined);
        const processedSVG = svgDocument.pathShapes.map((x) => x.commands);

        console.log(rawSVGCommands);

        this.fitCanvasSizeToSVG(processedSVG);
        
        await this.drawSVGCommands(rawSVGCommands);
        await this.drawLinearizedSVG(linearizedSVG);
        await this.drawProcessedSVG(processedSVG);

        console.log("processedSVG", processedSVG);

        //console.log(svgDocument);
    }

    public static close() {
        if (!this.opened) {
            throw new Error("SVGCommandView already closed");
        }

        document.removeEventListener('keydown', this.closeListener);

        this.opened = false;
        const wrapper = document.getElementById("svgCommandView");
        document.body.removeChild(wrapper);
    }

    private static async drawSVGCommands(rawSVGCommands: object[]) {
        
        const ctx = this.svgCommandCanvas.getContext("2d");

        this.clearCanvas(ctx);
        this.drawLegend(ctx);

        ctx.lineWidth = 2;
        for (const command of rawSVGCommands) {
            this.drawCommand(command, ctx);
        }
    }

    static drawProcessedSVG(processedSVG: (LineCommand | ArcCommand)[][]) {
        const ctx = this.svgProcessedCanvas.getContext("2d");

        this.clearCanvas(ctx);
        this.drawLegend(ctx);

        ctx.lineWidth = 2;
        for (const segment of processedSVG) {
            for (const command of segment) {
                if (SvgToCommands.isLine(command)) {
                    this.drawLineCommand(command, ctx);
                } else {
                    try {
                        this.drawCenterRepArcCommand(command, ctx);
                    }
                    catch (e) {
                        console.log(e);
                        console.log(command);
                    }
                }
            }
        }
    }


    private static fitCanvasSizeToSVG(svgComands: (ArcCommand | LineCommand)[][]) {

        // compute bounding box
        let minX = 1000; //Number.MAX_VALUE;
        let minY = 1000; //Number.MAX_VALUE;
        let maxX = -1000; //Number.MIN_VALUE;
        let maxY = -1000; //Number.MIN_VALUE;
        
        
        for (const segment of svgComands) {
            for (const command of segment) {
                if (SvgToCommands.isArc(command)) {
                    const arcCommand = command as ArcCommand;
                    minX = Math.min(minX, command.x - arcCommand.r);
                    minY = Math.min(minY, command.y - arcCommand.r);
                    maxX = Math.max(maxX, command.x + arcCommand.r);
                    maxY = Math.max(maxY, command.y + arcCommand.r);
                } else { 
                    if (command.x < minX) minX = command.x;
                    if (command.y < minY) minY = command.y;
                    if (command.x > maxX) maxX = command.x;
                    if (command.y > maxY) maxY = command.y;
                }
            }
        }

        const width = maxX - minX;
        const height = maxY - minY;

        const scale = Math.min(this.svgCommandCanvas.width / width, this.svgCommandCanvas.height / height);

        this.mapX = (x) => (x - minX - 0.5 * width) * scale * 0.8 + 0.5 * this.svgCommandCanvas.width;
        this.mapY = (y) => (y - minY - 0.5 * height) * scale * 0.8 + 0.5 * this.svgCommandCanvas.height;

        this.mapXScale = (x) => x * scale * 0.8;
        this.mapYScale = (y) => y * scale * 0.8;
    }

    static clearCanvas(ctx: CanvasRenderingContext2D) {
        ctx.clearRect(0, 0, this.svgCommandCanvas.width, this.svgCommandCanvas.height);
    }

    static drawCommand(command: object, ctx: CanvasRenderingContext2D) {
        const commandType = command["code"];

        switch (commandType) {
            case "M":
                this.drawMoveCommand(command, ctx);
                break;
            case "L":
            case "H":
            case "V":
                this.drawLineCommand(command, ctx);
                break;
            case "C":
                this.drawCubicBezierCommand(command, ctx);
                break;
            case "S":
                this.drawSmoothCubicBezierCommand(command, ctx);
                break;
            case "A":
                this.drawEllipticalArcCommand(command, ctx);
                break;
            case "Z":
                this.drawLineCommand(command, ctx, false, "green");
                break;
            default:
                console.log("Unknown command type: " + commandType);
                break;
        }

        this.lastDrawnCommand = command;
    }

    static drawMoveCommand(command: object, ctx: CanvasRenderingContext2D) {
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "gray";
        ctx.moveTo(this.mapX(0), this.mapY(0));
        ctx.lineTo(this.mapX(command["x"]), this.mapY(command["y"]));
        ctx.stroke();

        this.drawArrowheadFrom(this.mapX(command["x"]), this.mapY(command["y"]), this.mapX(0), this.mapY(0), "gray", ctx);
    }

    static drawLineCommand(command: object, ctx: CanvasRenderingContext2D, dashed: boolean = false, color = "black") {
        ctx.beginPath();
        ctx.setLineDash(dashed ? [5, 15] : []);
        ctx.strokeStyle = color;
        ctx.moveTo(this.mapX(command["x0"]), this.mapY(command["y0"]));
        ctx.lineTo(this.mapX(command["x"]), this.mapY(command["y"]));
        ctx.stroke();

        this.drawArrowheadFrom(this.mapX(command["x"]), this.mapY(command["y"]), this.mapX(command["x0"]), this.mapY(command["y0"]), color, ctx);
    }

    static drawCubicBezierCommand(command: object, ctx: CanvasRenderingContext2D, color = "cyan") {
        const x0 = this.mapX(command["x0"]);
        const y0 = this.mapY(command["y0"]);
        const x1 = this.mapX(command["x1"]);
        const y1 = this.mapY(command["y1"]);
        const x2 = this.mapX(command["x2"]);
        const y2 = this.mapY(command["y2"]);
        const x = this.mapX(command["x"]);
        const y = this.mapY(command["y"]);

        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = color;
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x1, y1, x2, y2, x, y);
        ctx.stroke();

        // adjust arrowhead angle to match curve

        const t = 1.0 - 4 / Math.hypot(x - x2, y - y2); // approximate t value for the arrowhead

        let bezierEQ = (a, b, c, d, t) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d;

        const xT = bezierEQ(x0, x1, x2, x, t);
        const yT = bezierEQ(y0, y1, y2, y, t);

       // console.log(xT, yT);

        this.drawArrowheadFrom(x, y, xT, yT, color, ctx);
    }

    static drawSmoothCubicBezierCommand(command: object, ctx: CanvasRenderingContext2D) {
        let last_x = this.lastDrawnCommand["x"];
        let last_y = this.lastDrawnCommand["y"];
        let last_x2 = this.lastDrawnCommand["x2"];
        let last_y2 = this.lastDrawnCommand["y2"];

        let x1 = 2 * last_x - last_x2;
        let y1 = 2 * last_y - last_y2;

        this.drawCubicBezierCommand({
            "x0": last_x,
            "y0": last_y,
            "x1": x1,
            "y1": y1,
            "x2": command["x2"],
            "y2": command["y2"],
            "x": command["x"],
            "y": command["y"]
        }, ctx, "magenta");
    
    }

    static drawEllipticalArcCommand(command: object, ctx: CanvasRenderingContext2D) {
        const arcCenterRep = this.getArcCenterRepresentation(command);
        //console.log("arcCenterRep", arcCenterRep);

        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = "red";
        ctx.moveTo(this.mapX(command["x0"]), this.mapY(command["y0"]));

        ctx.ellipse(
            this.mapX(arcCenterRep.x), this.mapY(arcCenterRep.y),
            this.mapXScale(arcCenterRep.rx), this.mapYScale(arcCenterRep.ry),
            arcCenterRep.phi, arcCenterRep.startAngle, arcCenterRep.endAngle, !arcCenterRep.clockwise);

        ctx.stroke();


        let avgRadius = (this.mapXScale(arcCenterRep.rx) + this.mapYScale(arcCenterRep.ry)) / 2;
        let correctionFactor = Math.min(10 / (avgRadius * 2 * Math.PI), 1.0);

        let lerp = (a, b, t) => a + (b - a) * t;

        this.drawArrowhead(this.mapX(command["x"]), this.mapY(command["y"]),
            lerp(arcCenterRep.endAngle, arcCenterRep.startAngle, correctionFactor) 
                + (arcCenterRep.clockwise ? -1 : 1) * (Math.PI / 2), "red", ctx);
    }
    
    static drawCenterRepArcCommand(arc: ArcCommand, ctx: CanvasRenderingContext2D) {

        const arcEndpointRep = SvgToCommands._convertCenterRepToEndpointRep(arc);

        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = "red";
        ctx.moveTo(this.mapX(arcEndpointRep.x0), this.mapY(arcEndpointRep.y0));

        ctx.ellipse(
            this.mapX(arc.x), this.mapY(arc.y),
            this.mapXScale(arc.r), this.mapYScale(arc.r),
            0, arc.s, arc.e, (arc.e < arc.s));

        ctx.stroke();

        let correctionFactor = Math.min(10 / (arc.r * 2 * Math.PI), 1.0);

        let lerp = (a, b, t) => a + (b - a) * t;

        this.drawArrowhead(this.mapX(arcEndpointRep.x), this.mapY(arcEndpointRep.y),
            lerp(arc.e, arc.s, correctionFactor) 
                + ((arc.e < arc.s) ? -1 : 1) * (Math.PI / 2), "red", ctx);
    }

    static drawLegend(ctx: CanvasRenderingContext2D) {
        ctx.font = "20px Arial";

        ctx.fillStyle = "gray";
        ctx.fillText("M - Move", 10, 20);

        ctx.fillStyle = "black";
        ctx.fillText("L - Line", 10, 40);
        ctx.fillText("H - Horizontal Line", 10, 60);
        ctx.fillText("V - Vertical Line", 10, 80);

        ctx.fillStyle = "cyan";
        ctx.fillText("C - Cubic Bezier", 10, 100);

        ctx.fillStyle = "magenta";
        ctx.fillText("S - Smooth Cubic Bezier", 10, 120);

        ctx.fillStyle = "red";
        ctx.fillText("A - Elliptical Arc", 10, 140);

        ctx.fillStyle = "green";
        ctx.fillText("Z - Close Path", 10, 160);
    }


    static drawArrowheadFrom(x: number, y: number, x0, y0, color, ctx: CanvasRenderingContext2D, size: number = 10) {

        // don't draw arrowhead if the line is too short
        // if (Math.abs(x - x0) < 1 && Math.abs(y - y0) < 1) {
        //     return;
        // }

        let angle = Math.atan2(y - y0, x - x0);
        this.drawArrowhead(x, y, angle, color, ctx, size);
    }

    static drawArrowhead(x: number, y: number, angle, color, ctx: CanvasRenderingContext2D, size: number = 10) {
        //console.log("drawArrowhead", x, y, angle, color, size);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(normalizeAngle(angle));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-size, size / 2.5);
        ctx.lineTo(-size, -size / 2.5);
        ctx.closePath();
        ctx.restore();
        ctx.fillStyle = color;
        ctx.fill();
    }


    static getArcCenterRepresentation(command: object) {
        return svgArcToCenterParam(
            command["x0"], command["y0"],
            command["rx"], command["ry"],
            command["xAxisRotation"], 
            command["largeArc"], command["sweep"],
            command["x"], command["y"]);
    }

    

    static drawLinearizedSVG(linearizedSVG: {x, y}[][]) {
        const ctx = this.svgLinearizedCanvas.getContext("2d");

        ctx.clearRect(0, 0, this.svgLinearizedCanvas.width, this.svgLinearizedCanvas.height);

        ctx.lineWidth = 1;
        for (const path of linearizedSVG) {
            this.drawLinearizedPath(path, ctx);
        }
    }

    static drawLinearizedPath(path: { x: any; y: any; }[], ctx: CanvasRenderingContext2D) {
        if (path.length < 2) {
            return;
        }

        ctx.beginPath();
        ctx.moveTo(this.mapX(path[0].x), this.mapY(path[0].y));
        for (let i = 1; i < path.length; i++) {
            ctx.lineTo(this.mapX(path[i].x), this.mapY(path[i].y));
        }
        ctx.stroke();

        for (let i = 0; i < path.length; i++) {
            ctx.fillStyle = "red";
            ctx.beginPath();
            ctx.arc(this.mapX(path[i].x), this.mapY(path[i].y), 2, 0, 2 * Math.PI);
            ctx.fill();
        }
    }

}

