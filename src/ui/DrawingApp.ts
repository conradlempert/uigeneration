import { Matrix3, Vector2, Vector3 } from "three";
import ColorToCssSolver from "../util/ColorToCssSolver";
import AutoShape, { SerializedAutoShape } from "../dataTypes/AutoShape";
import AnalysisView from "./AnalysisView";
import SvgToCommands, {
  ArcCommand,
  LineCommand,
} from "../algorithm/SvgToCommands";
import PathShape from "../dataTypes/PathShape";
import { flatten, zip, zipWith } from "lodash";
import UIGenerationMenu from "../uiGenerationShapeMenu/uiGenerationMenu";

const viewScale = 10;
const handleSize = 10;

export interface AppShape {
  tool: AutoShape;
  params: number[];
}
export class DrawingApp {
  // public static tools: AutoShape[];
  // public static canvas: HTMLCanvasElement;
  // public static ctx: CanvasRenderingContext2D;
  // public static shapes: AppShape[] = [];
  // public static selectedShape: AppShape = null;
  // public static viewMatrix: Matrix3 = new Matrix3().identity();
  // public static canvasWidth: number;
  // public static canvasHeight: number;
  // public static lastMousePos: Vector2 = null;
  // public static mouseStart: Vector2 = null;
  // public static currentHandle: number = null;
  // public static fromJSON(jsonContent: SerializedAutoShape[]) {
  //     const tools = jsonContent.map(st => AutoShape.deserialize(st));
  //     this.initialize(tools);
  // }
  // public static initialize (tools: AutoShape[]) {
  //     (window as any).drawingApp = this;
  //     this.tools = tools;
  //     var wrapper = document.createElement("div"); // test this
  //     wrapper.id = "drawingAppWrapper";
  //     wrapper.style.width = "100%";
  //     wrapper.style.height = "100%";
  //     wrapper.style.position = "fixed";
  //     wrapper.style.top = "0%";
  //     wrapper.style.left = "0%";
  //     wrapper.style.zIndex = "10000";
  //     wrapper.style.backgroundColor = "white";
  //     wrapper.style.overflowY = "auto";
  //     document.body.appendChild(wrapper);
  //     const leftBar = document.createElement("div");
  //     leftBar.style.width = "300px";
  //     leftBar.style.height = "100%";
  //     leftBar.style.display = "inline-block";
  //     wrapper.appendChild(leftBar);
  //     var headline = document.createElement("h1");
  //     headline.innerText = "Drawing app";
  //     headline.style.display = "inline-block";
  //     leftBar.appendChild(headline);
  //     const exitButton = document.createElement("button");
  //     exitButton.id = "exitButton";
  //     exitButton.innerText = "Exit";
  //     exitButton.style.margin = "10px";
  //     exitButton.addEventListener("click", e => {
  //         this.exit();
  //     });
  //     leftBar.appendChild(exitButton);
  //     const clearButton = document.createElement("button");
  //     clearButton.id = "clearButton";
  //     clearButton.innerText = "Clear";
  //     clearButton.style.margin = "10px";
  //     clearButton.addEventListener("click", e => {
  //         this.clear();
  //     });
  //     leftBar.appendChild(clearButton);
  //     const toolBar = document.createElement("div");
  //     toolBar.id = "toolBarApp";
  //     toolBar.style.width = "100%";
  //     leftBar.appendChild(toolBar);
  //     const slidersDiv = document.createElement("div");
  //     slidersDiv.id = "slidersDiv";
  //     slidersDiv.style.width = "100%";
  //     leftBar.append(slidersDiv);
  //     this.canvas = document.createElement("canvas");
  //     this.canvas.id = "drawingAppCanvas";
  //     this.canvasWidth = wrapper.getBoundingClientRect().width - 320;
  //     this.canvasHeight = wrapper.getBoundingClientRect().height - 20;
  //     this.viewMatrix = new Matrix3().identity();
  //     this.viewMatrix.scale(viewScale, viewScale);
  //     this.viewMatrix.translate(this.canvasWidth/2, this.canvasHeight/2);
  //     this.canvas.style.setProperty('width', this.canvasWidth + "px");
  //     this.canvas.style.setProperty('height', this.canvasHeight + "px");
  //     this.canvas.style.setProperty('margin', '10px');
  //     this.canvas.style.border = "3px solid black";
  //     this.canvas.onmousedown = e => {
  //         this.mouseDown(e.offsetX, e.offsetY);
  //     }
  //     this.canvas.onmouseup = e => {
  //         this.mouseUp(e.offsetX, e.offsetY);
  //     }
  //     this.canvas.onmousemove = e => {
  //         this.mouseMove(e.offsetX, e.offsetY);
  //     }
  //     wrapper.append(this.canvas);
  //     this.ctx = this.canvas.getContext('2d');
  //     this.redrawShapeMenu();
  //     this.initCanvas();
  // }
  // public static clear() {
  //     this.shapes = [];
  //     this.selectedShape = null;
  //     this.draw();
  // }
  // public static updateSliderValues() {
  //     for(const [i, param] of this.selectedShape.params.entries()) {
  //         const slider = document.getElementById("slider" + i) as HTMLInputElement;
  //         slider.value = param.toString();
  //     }
  // }
  // public static async redrawShapeMenu(): Promise<void> {
  //     const toolBar = document.getElementById("toolBarApp") as HTMLDivElement;
  //     toolBar.innerHTML = "";
  //     for(const tool of this.tools) {
  //         await this.createToolInfo(toolBar, tool);
  //     }
  // }
  // public static async createToolInfo(wrapper: HTMLDivElement, tool: AutoShape): Promise<void> {
  //     const shapeDiv = document.createElement("div");
  //     shapeDiv.style.height = "100px";
  //     shapeDiv.style.width = "100px";
  //     shapeDiv.style.display = "inline-block";
  //     shapeDiv.style.verticalAlign = "top";
  //     const shapeInfo = document.createElement("p");
  //     shapeInfo.style.fontSize = "10pt";
  //     shapeInfo.innerText = tool.getNameText();
  //     const shapeImg = document.createElement("img");
  //     shapeImg.style.height = "80px";
  //     shapeImg.style.width = "80px";
  //     shapeImg.src = await tool.getIconAsPngUrl();
  //     const index = this.tools.indexOf(tool);
  //     const color = AnalysisView.getColor(index, this.tools.length);
  //     const cssFilters = ColorToCssSolver.colorToCssFilter(color);
  //     shapeImg.style.cssText += cssFilters;
  //     shapeDiv.appendChild(shapeImg);
  //     shapeDiv.appendChild(shapeInfo);
  //     shapeDiv.style.cursor = "pointer";
  //     shapeDiv.onclick = e => {
  //         this.addShape(tool);
  //     }
  //     wrapper.appendChild(shapeDiv);
  // }
  // public static addShape(tool: AutoShape) {
  //     const params = tool.paramRanges.map(r => (r.max + r.min) / 2);
  //     const shape: AppShape = { tool, params };
  //     this.shapes.push(shape);
  //     this.selectShape(shape);
  //     this.draw();
  // }
  // public static draw() {
  //     this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  //     for(const shape of this.shapes) {
  //         this.drawShape(shape);
  //     }
  // }
  // public static drawShape(shape: AppShape) {
  //     if(this.selectedShape === shape) {
  //         this.ctx.strokeStyle = "blue";
  //     } else {
  //         this.ctx.strokeStyle = "black";
  //     }
  //     const commands = this.getCommands(shape);
  //     for(const command of commands) {
  //         this.drawCommand(command);
  //     }
  //     this.drawShapeHandles(shape);
  // }
  // public static drawShapeHandles(shape: AppShape) {
  //     if(this.selectedShape === shape) {
  //         const positions = this.getHandlePositions(shape);
  //         for(const position of positions) {
  //             this.ctx.fillStyle = "black";
  //             this.ctx.fillRect(position.x-handleSize/2, position.y-handleSize/2, handleSize, handleSize);
  //             this.ctx.fillStyle = "white";
  //             this.ctx.fillRect(position.x-handleSize/2+1, position.y-handleSize/2+1, handleSize-2, handleSize-2);
  //         }
  //     }
  // }
  // public static getHandlePositions(shape: AppShape): Vector2[] {
  //     const positions = shape.tool.getCommandEndPositions(shape.params).slice(0, -1);
  //     return positions.map(position => position.clone().applyMatrix3(this.viewMatrix));
  // }
  // public static getCommands(shape: AppShape) {
  //     return shape.tool.shapeFromParams(shape.params);
  // }
  // public static drawCommand(command: ArcCommand | LineCommand) {
  //     this.ctx.beginPath();
  //     if(SvgToCommands.isLine(command)) {
  //         const p0 = new Vector2(command.x0, command.y0);
  //         const p = new Vector2(command.x, command.y);
  //         p0.applyMatrix3(this.viewMatrix);
  //         p.applyMatrix3(this.viewMatrix);
  //         this.ctx.moveTo(p0.x, p0.y);
  //         this.ctx.lineTo(p.x, p.y);
  //     } else {
  //         const p = new Vector2(command.x, command.y);
  //         p.applyMatrix3(this.viewMatrix);
  //         const r = Math.max(command.r, 0) * this.viewMatrix.elements[0]; // [0] is scale x
  //         this.ctx.arc(p.x, p.y, r, command.s, command.e);
  //     }
  //     this.ctx.stroke();
  // }
  // public static createSliderWindow(shape: AppShape) {
  //     const div = document.getElementById('slidersDiv');
  //     div.innerHTML = "";
  //     const tool = shape.tool;
  //     const params = shape.params;
  //     const paramRanges = tool.paramRanges;
  //     for (let i = 0; i < params.length; i++) {
  //         const slider = document.createElement("input");
  //         slider.className = "pcaParameterSlider";
  //         slider.type = "range";
  //         slider.min = paramRanges[i].min.toString();
  //         slider.max = paramRanges[i].max.toString();
  //         slider.step = "1";
  //         slider.value = params[i].toString();
  //         slider.style.width = "250px";
  //         slider.style.margin = "30px";
  //         slider.id = "slider" + i;
  //         slider.oninput = async () => {
  //             this.updateShape(shape, i, parseFloat(slider.value));
  //         };
  //         div.appendChild(slider);
  //     }
  // }
  // public static updateShape(shape: AppShape, index: number, value: number) {
  //     shape.params[index] = value;
  //     this.draw();
  // }
  // public static checkShapeClick(x: number, y: number) {
  //     const pos = new Vector2(x,y);
  //     pos.applyMatrix3((new Matrix3()).getInverse(this.viewMatrix));
  //     const shapeCommands = this.shapes.map(s => this.getCommands(s));
  //     const shapePaths = shapeCommands.map(sc => SvgToCommands._commandsToPath(sc));
  //     const shapeLines = shapePaths.map(sp => new PathShape("", sp, [], []).getLineStrips()[0]);
  //     const clicked = shapeLines.filter(p => UIGenerationMenu.pointInPolygon(pos, p));
  //     if(clicked.length > 0) {
  //         const index = shapeLines.indexOf(clicked[0]);
  //         const shape = this.shapes[index];
  //         if(shape !== this.selectedShape) {
  //             this.selectShape(shape);
  //         } else {
  //             this.unselect();
  //         }
  //     } else {
  //         this.unselect();
  //     }
  // }
  // public static checkHandleClick(x: number, y: number): {shape: AppShape, index: number} | null {
  //     for(const shape of this.shapes) {
  //         for(const [i, p] of this.getHandlePositions(shape).entries()) {
  //             if(p.x - handleSize/2 <= x && p.y - handleSize/2 <= y && p.x + handleSize/2 >= x && p.y + handleSize/2 >= y) {
  //                 return {shape, index: i }
  //             }
  //         }
  //     }
  //     return null;
  // }
  // public static mouseHover(x: number, y: number) {
  //     const res = this.checkHandleClick(x, y);
  //     if(res) {
  //         this.canvas.style.cursor = "grab";
  //     } else {
  //         this.canvas.style.cursor = "default";
  //     }
  // }
  // public static mouseDown(x: number, y: number) {
  //     this.lastMousePos = new Vector2(x, y);
  //     this.mouseStart = new Vector2(x,y);
  //     const res = this.checkHandleClick(x, y);
  //     if(res) {
  //         this.canvas.style.cursor = "grabbing";
  //         this.currentHandle = res.index;
  //     }
  // }
  // public static mouseMove(x: number, y: number) {
  //     if(this.lastMousePos !== null && this.currentHandle !== null && this.selectedShape !== null) {
  //         const movement = new Vector2(x,y).sub(this.lastMousePos);
  //         // const previousCommandParameters = this.selectedShape.tool.getParametersOfNthCommand(this.currentHandle);
  //         // const paramUpdateX = previousCommand.map(n => n * movement.x);
  //         // const paramUpdateY = previousCommand.map(n => n * movement.y);
  //         // const totalParamUpdate = zipWith(paramUpdateX, paramUpdateY, (a, b) => a + b);
  //         // this.selectedShape.params = zipWith(totalParamUpdate, this.selectedShape.params, (a, b) => a + b);
  //         // this.draw();
  //         // this.updateSliderValues();
  //         this.lastMousePos = new Vector2(x, y);
  //     } else {
  //         this.mouseHover(x, y);
  //     }
  // }
  // public static mouseUp(x: number, y: number) {
  //     if(this.mouseStart.distanceTo(new Vector2(x, y)) < 1) {
  //         this.checkShapeClick(x, y);
  //     }
  //     this.currentHandle = null;
  //     this.lastMousePos = null;
  //     this.mouseStart = null;
  //     this.canvas.style.cursor = "default";
  // }
  // public static selectShape(shape: AppShape) {
  //     this.selectedShape = shape;
  //     this.createSliderWindow(shape);
  //     this.draw();
  // }
  // public static unselect() {
  //     this.selectedShape = null;
  //     this.draw();
  // }
  // public static async initCanvas(): Promise<void> {
  //     this.canvas.width = this.canvasWidth;
  //     this.canvas.height = this.canvasHeight;
  // }
  // public static exit() {
  //     document.getElementById("drawingAppWrapper").remove();
  // }
}
