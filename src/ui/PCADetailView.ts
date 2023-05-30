import PathShape from "../dataTypes/PathShape";
import { Vector2 } from "three";
import SvgToCommands, {
  ArcCommand,
  LineCommand,
} from "../algorithm/SvgToCommands";
import AutoShape from "../dataTypes/AutoShape";
import { FileHandling } from "../util/FileHandling";

export default class PCADetailView {
  static canvas: HTMLCanvasElement;
  static paramWeighs;
  static canvasScale: number;
  static canvasCenterPoint: Vector2;
  static autoShape: AutoShape;

  public static async initialize(autoShape: AutoShape): Promise<void> {
    (window as any).currentPreviewAutoShape = autoShape;
    this.autoShape = autoShape;
    if (autoShape) {
      this.paramWeighs = new Array(this.autoShape.basis.length).fill(0);
    }
    this.initUI();
  }

  public static initUI() {
    if (document.getElementById("pcaTestViewWrapper"))
      document.getElementById("pcaTestViewWrapper").remove();
    if (document.getElementById("infoWrapper"))
      document.getElementById("infoWrapper").remove();
    const wrapper = document.createElement("div"); // test this
    wrapper.id = "pcaTestViewWrapper";
    wrapper.style.width = "50%";
    wrapper.style.height = "100%";
    wrapper.style.position = "absolute";
    wrapper.style.top = "0%";
    wrapper.style.left = "0%";
    wrapper.style.zIndex = "10000";
    wrapper.style.backgroundColor = "white";
    wrapper.style.overflowY = "auto";
    document.body.appendChild(wrapper);

    [
      "dragenter",
      "dragstart",
      "dragend",
      "dragleave",
      "dragover",
      "drag",
    ].forEach((evt) =>
      wrapper.addEventListener(evt, (e) => e.preventDefault(), false)
    );
    ["drop"].forEach((evt) =>
      wrapper.addEventListener(
        evt,
        (e) => this.handleSvgDrop(e as DragEvent),
        false
      )
    );

    const canvasWrapper = document.createElement("div"); // test this
    canvasWrapper.id = "pcaTestViewWrapper";
    canvasWrapper.style.width = "400px";
    canvasWrapper.style.height = "400px";
    canvasWrapper.style.backgroundColor = "white";
    wrapper.appendChild(canvasWrapper);

    this.canvas = document.createElement("canvas");
    this.canvas.style.width = "400px";
    this.canvas.style.height = "400px";
    this.canvas.width = 800;
    this.canvas.height = 800;
    this.canvas.style.border = "1px solid black";
    this.canvas.style.margin = "10px";
    this.canvas.id = "rect";
    canvasWrapper.appendChild(this.canvas);

    const infoWrapper = document.createElement("div");
    infoWrapper.id = "infoWrapper";
    infoWrapper.style.width = "50%";
    infoWrapper.style.height = "100%";
    infoWrapper.style.position = "absolute";
    infoWrapper.style.top = "0%";
    infoWrapper.style.left = "50%";
    infoWrapper.style.zIndex = "10000";
    infoWrapper.style.backgroundColor = "white";
    infoWrapper.style.overflowY = "auto";
    document.body.appendChild(infoWrapper);

    const currentShapeWrapper = document.createElement("div");
    currentShapeWrapper.id = "currentShapeWrapper";
    currentShapeWrapper.style.whiteSpace = "pre-line";
    currentShapeWrapper.style.fontSize = "18px";
    currentShapeWrapper.style.lineHeight = "120%";
    infoWrapper.appendChild(currentShapeWrapper);

    infoWrapper.appendChild(document.createElement("br"));

    const matrixTextWrapper = document.createElement("textarea");
    matrixTextWrapper.id = "matrixTextWrapper";
    matrixTextWrapper.style.width = "600px";
    matrixTextWrapper.style.height = "600px";
    matrixTextWrapper.style.fontSize = "18px";
    matrixTextWrapper.addEventListener("input", (e) => {
      this.autoShape.parseMatrixText((e.target as HTMLTextAreaElement).value);
      this.updateParamWeighsLength();
      this.updateCanvas();
      this.initSliders();
    });
    infoWrapper.appendChild(matrixTextWrapper);

    const sliderWrapper = document.createElement("div");
    sliderWrapper.id = "sliderWrapper";
    wrapper.append(sliderWrapper);

    if (this.autoShape) {
      this.initSliders();
      matrixTextWrapper.innerHTML = this.autoShape.matrixToText();
      this.updateCanvas(true);
    } else {
      console.warn(
        "initialized without pca extractor. drag in svg file to continue"
      );
    }

    // close on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key == "Escape") {
        wrapper.remove();
        infoWrapper.remove();
      }
    });
  }

  public static updateParamWeighsLength() {
    const len = this.autoShape.basis.length;
    if (this.paramWeighs.length < len) {
      this.paramWeighs = [
        ...this.paramWeighs,
        ...new Array(len - this.paramWeighs.length).fill(0),
      ];
    } else {
      this.paramWeighs.length = len;
    }
  }

  public static initSliders() {
    const wrapper = document.getElementById("sliderWrapper");
    wrapper.innerHTML = "";
    for (let i = 0; i < this.paramWeighs.length; i++) {
      const letterSpan = document.createElement("span");
      letterSpan.innerText = String.fromCharCode("a".charCodeAt(0) + i);
      letterSpan.style.fontSize = "20px";
      letterSpan.style.verticalAlign = "13px";
      letterSpan.style.marginLeft = "20px";
      wrapper.appendChild(letterSpan);
      const slider = document.createElement("input");
      slider.className = "pcaParameterSlider";
      slider.type = "range";
      slider.min = this.autoShape.paramRanges[i].min.toString();
      slider.max = this.autoShape.paramRanges[i].max.toString();
      slider.step = "1";
      slider.value = this.paramWeighs[i] || 0;
      slider.style.width = "250px";
      slider.style.margin = "30px";
      slider.style.display = "inline-block";
      slider.oninput = async () => {
        console.log("INPUT");
        this.paramWeighs[i] = parseFloat(slider.value);
        document.getElementById("sliderLabel" + i).innerText =
          this.paramWeighs[i].toFixed(1);
        await this.updateCanvas();
      };
      wrapper.appendChild(slider);
      const valueSpan = document.createElement("span");
      valueSpan.id = "sliderLabel" + i;
      valueSpan.innerText = slider.value;
      valueSpan.style.fontSize = "20px";
      valueSpan.style.verticalAlign = "13px";
      valueSpan.style.marginLeft = "20px";
      wrapper.appendChild(valueSpan);
      wrapper.appendChild(document.createElement("br"));
    }
  }

  public static async handleSvgDrop(e: DragEvent) {
    e.preventDefault();
    let files = Array.from(e.dataTransfer.files);
    if (files.length == 0) return;
    const svgFile = files.find((f) => f.name.endsWith(".svg"));
    if (!svgFile) return;
    const content = await FileHandling.readFileAsync(svgFile);
    const document = await SvgToCommands.svgToCommands(content);
    const shape = document.pathShapes[0];
    this.autoShape = AutoShape.fromPathShape(shape);
    this.paramWeighs = new Array(this.autoShape.basis.length).fill(0);
    this.initUI();
  }

  static async updateCanvas(adjustViewport = false) {
    this.visualizeCommands(
      this.autoShape.shapeFromParams(this.paramWeighs),
      adjustViewport
    );
    const shape = this.autoShape.shapeVectorFromParams(this.paramWeighs);
    document.getElementById("currentShapeWrapper").innerHTML =
      this.autoShape.shapeVectorToText(shape);
  }

  static visualizeCommands(
    commands: (ArcCommand | LineCommand)[],
    adjustViewport = false
  ) {
    const pathString = SvgToCommands._commandsToPath(commands);
    const lineStrips = new PathShape("", pathString, [], []).getLineStrips();

    if (adjustViewport) this.adjustCanvasViewport(lineStrips);

    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.lineWidth = 4;

    const transform = (point: Vector2) =>
      new Vector2(
        ((point.x - this.canvasCenterPoint.x) * this.canvasScale + 0.5) *
          this.canvas.width,
        ((point.y - this.canvasCenterPoint.y) * this.canvasScale + 0.5) *
          this.canvas.height
      );

    for (const lineStrip of lineStrips) {
      const points = lineStrip.getPoints();
      ctx.beginPath();

      const firstPoint = transform(points[0]);
      ctx.moveTo(firstPoint.x, firstPoint.y);

      for (let i = 1; i < points.length; i++) {
        const point = transform(points[i]);
        ctx.lineTo(point.x, point.y);
      }

      ctx.stroke();
    }
  }

  static adjustCanvasViewport(lineStrips: LineStrip[]) {
    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let maxY = Number.MIN_VALUE;

    for (const lineStrip of lineStrips) {
      for (const point of lineStrip.getPoints()) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    const width = maxX - minX;
    const height = maxY - minY;

    this.canvasScale = 0.25 / Math.max(width, height);
    this.canvasCenterPoint = new Vector2(minX + width / 2, minY + height / 2);
  }

  static generateRectCommands(
    x: number,
    y: number,
    w: number,
    h: number,
    alpha: number
  ): LineCommand[] {
    const commands: LineCommand[] = [];
    const x1 = x + w;
    const y1 = y + h;

    const rotatePoint = (point: Vector2, angle: number) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return new Vector2(
        point.x * cos - point.y * sin,
        point.x * sin + point.y * cos
      );
    };

    const pointA = rotatePoint(new Vector2(x, y), alpha);
    const pointB = rotatePoint(new Vector2(x1, y), alpha);
    const pointC = rotatePoint(new Vector2(x1, y1), alpha);
    const pointD = rotatePoint(new Vector2(x, y1), alpha);

    commands.push({ x0: pointA.x, y0: pointA.y, x: pointB.x, y: pointB.y });
    commands.push({ x0: pointB.x, y0: pointB.y, x: pointC.x, y: pointC.y });
    commands.push({ x0: pointC.x, y0: pointC.y, x: pointD.x, y: pointD.y });
    commands.push({ x0: pointD.x, y0: pointD.y, x: pointA.x, y: pointA.y });

    console.log("Commands", commands);

    return commands;
  }

  static generateRoundtangleCommands(
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    alpha: number
  ): any {
    const commands: (ArcCommand | LineCommand)[] = [];

    const x1 = x + w;
    const y1 = y + h;

    const x_i = x + r;
    const y_i = y + r;
    const x1_i = x1 - r;
    const y1_i = y1 - r;

    const rotatePoint = (point: Vector2, angle: number) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return new Vector2(
        point.x * cos - point.y * sin,
        point.x * sin + point.y * cos
      );
    };

    const rAngle = Math.PI / 2;

    commands.push({ x: x_i, y: y_i, r: r, s: rAngle * 3, e: rAngle * 2 });
    commands.push({ x0: x, y0: y_i, x: x, y: y1_i });
    commands.push({ x: x_i, y: y1_i, r: r, s: rAngle * 2, e: rAngle * 1 });
    commands.push({ x0: x_i, y0: y1, x: x1_i, y: y1 });
    commands.push({ x: x1_i, y: y1_i, r: r, s: rAngle * 1, e: rAngle * 0 });
    commands.push({ x0: x1, y0: y1_i, x: x1, y: y_i });
    commands.push({ x: x1_i, y: y_i, r: r, s: rAngle * 4, e: rAngle * 3 });
    commands.push({ x0: x1_i, y0: y, x: x_i, y: y });

    console.log("Commands", commands);
    return commands;
  }

  static generateCircleCommands(x: number, y: number, r: number): ArcCommand[] {
    const commands: ArcCommand[] = [];

    commands.push({ x: x, y: y, r: r, s: 0, e: Math.PI });
    commands.push({ x: x, y: y, r: r, s: Math.PI, e: 2 * Math.PI });

    return commands;
  }

  static genRectData(min: number, max: number, n: number) {
    const rects: Map<string, (ArcCommand | LineCommand)[]> = new Map();

    for (let i = 0; i < n; i++) {
      const x = Math.random() * (max - min) + min;
      const y = Math.random() * (max - min) + min;
      const w = Math.random() * (max - min) + min;
      const h = Math.random() * (max - min) + min;
      const r = (Math.random() - 0.5) * 2.0 * Math.PI;

      rects.set("rect_" + i, this.generateRectCommands(x, y, w, h, r));
    }

    return rects;
  }

  static genAARectData(min: number, max: number, n: number) {
    const rects: Map<string, (ArcCommand | LineCommand)[]> = new Map();

    for (let i = 0; i < n; i++) {
      const x = Math.random() * (max - min) + min;
      const y = Math.random() * (max - min) + min;
      const w = Math.random() * (max - min) + min;
      const h = Math.random() * (max - min) + min;

      rects.set("aarect_" + i, this.generateRectCommands(x, y, w, h, 0));
    }

    return rects;
  }

  static genSquareData(min: number, max: number, n: number) {
    const rects: Map<string, (ArcCommand | LineCommand)[]> = new Map();

    for (let i = 0; i < n; i++) {
      const x = Math.random() * (max - min) + min;
      const y = Math.random() * (max - min) + min;
      const l = Math.random() * (max - min) + min;
      const r = (Math.random() - 0.5) * 2.0 * Math.PI;

      rects.set("square_" + i, this.generateRectCommands(x, y, l, l, r));
    }

    return rects;
  }

  static genCircleData(min: number, max: number, n: number) {
    const rects = [];

    for (let i = 0; i < n; i++) {
      const x = Math.random() * (max - min) + min;
      const y = Math.random() * (max - min) + min;
      const r = Math.random() * (max - min) + min;

      rects.push(this.generateCircleCommands(x, y, r));
    }

    return rects;
  }

  static genRoundtangleData(min: number, max: number, n: number) {
    const rtangles = [];

    for (let i = 0; i < n; i++) {
      const x = Math.random() * (max - min) + min;
      const y = Math.random() * (max - min) + min;
      const w = Math.random() * (max - min) + min;
      const h = Math.random() * (max - min) + min;
      const r = Math.random() * 0.5 * Math.min(w, h);
      const alpha = (Math.random() - 0.5) * 2.0 * Math.PI;

      rtangles.push(this.generateRoundtangleCommands(x, y, w, h, r, alpha));
    }

    return rtangles;
  }
}

(window as any).initPCA = () => {
  PCADetailView.initialize(null);
};
