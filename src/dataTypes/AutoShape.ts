import PathShape, {
  SerializedPathShape,
  ShapeRepresentation,
} from "./PathShape";
import AnalysisView from "../ui/AnalysisView";
import { Vector2 } from "three";
import SvgToCommands, {
  ArcCommand,
  LineCommand,
} from "../algorithm/SvgToCommands";
import { flatten } from "lodash";
import { Constraint } from "../algorithm/shapeDetect/constraints/Constraint";
import SvgToImage from "../uiGenerationShapeMenu/svgToImage";

export enum CommandType {
  Line,
  Arc,
}

export interface SerializedAutoShape {
  shapeName: string;
  specializedBy: string[];
  exampleShape: SerializedPathShape[];
  basis: number[][];
  offset: number[];
  topology: CommandType[];
  paramRanges: { min: number; max: number }[];
  cost: number;
  level: number;
  constraints: Constraint[];
  jsketcherJson: string;
  previewIcon: string;
}
export default class AutoShape {
  public shapeName: string;
  public specializedBy: AutoShape[];
  public exampleShape: PathShape[];
  public basis: number[][];
  public offset: number[];
  public topology: CommandType[];
  public paramRanges: { min: number; max: number }[];
  public cost: number;
  public level: number;
  public constraints: Constraint[];
  public jsketcherJson: string;
  public previewIcon: string;

  public serialize(): SerializedAutoShape {
    console.log("SERIALIZING", this);
    return {
      shapeName: this.shapeName,
      specializedBy: this.specializedBy.map((t) => t.shapeName),
      exampleShape: this.exampleShape
        ? this.exampleShape.map((s) => s.serialize())
        : [],
      basis: this.basis,
      offset: this.offset,
      topology: this.topology,
      paramRanges: this.paramRanges,
      cost: this.cost,
      level: this.level,
      constraints: this.constraints,
      jsketcherJson: this.jsketcherJson
        ? this.jsketcherJson
        : this.getJsketcherSketchJson(),
      previewIcon: this.previewIcon,
    };
  }

  public static deserialize(serialized: SerializedAutoShape): AutoShape {
    return new AutoShape(
      serialized.shapeName,
      [],
      serialized.exampleShape
        ? serialized.exampleShape.map((s) => PathShape.deserialize(s))
        : [],
      serialized.basis,
      serialized.offset,
      serialized.topology,
      serialized.paramRanges,
      serialized.cost,
      serialized.level,
      serialized.constraints,
      serialized.jsketcherJson,
      serialized.previewIcon
    );
  }

  public linkSpecializations(
    specializedBy: string[],
    otherShapes: AutoShape[]
  ) {
    specializedBy.forEach((str) => {
      const autoShape = otherShapes.find((s) => s.shapeName === str);
      if (!autoShape) {
        console.error(
          "could not recover autoshape hierarchy: " +
            this.shapeName +
            " => " +
            str
        );
      } else {
        this.specializedBy.push(autoShape);
      }
    });
  }

  constructor(
    shapeName: string,
    specializedBy: AutoShape[],
    exampleShape: PathShape[] = [],
    basis: number[][],
    offset: number[],
    topology: CommandType[],
    paramRanges: { min: number; max: number }[],
    cost: number,
    level: number,
    constraints: Constraint[] = [],
    jsketcherJson: string = null,
    previewIcon: string = null
  ) {
    this.shapeName = shapeName;
    this.specializedBy = specializedBy;
    this.exampleShape = exampleShape;
    this.basis = basis;
    this.offset = offset;
    this.topology = topology;
    this.paramRanges = paramRanges;
    this.cost = cost;
    this.level = level;
    this.constraints = constraints;
    this.jsketcherJson = jsketcherJson;
    this.previewIcon = previewIcon;
  }

  public tryToCover(pathShape: PathShape): ShapeRepresentation[] | null {
    const r = pathShape.representations.filter((r) => r.autoShape === this);
    if (r) return r;

    for (let specializedTool of this.specializedBy) {
      const r = specializedTool.tryToCover(pathShape);
      if (r) return r;
    }

    return null;
  }

  getNameText(): string {
    return this.shapeName;
  }

  protected _getBoundingBox(segmentList: Segment[]): AABB2D {
    let allPts: Vector2[] = [];

    for (let i = 0; i < segmentList.length; i++) {
      allPts = allPts.concat(segmentList[i].getOutline().getPoints());
    }

    if (allPts.length == 0)
      return new AABB2D([new Vector2(-20, -20), new Vector2(20, 20)]);

    return new AABB2D(allPts);
  }

  public getParametersOfNthCommand(n: number): number[][] {
    const shapeVectorIndex = this.getShapeVectorIndexOfNthCommand(n);
    if (shapeVectorIndex === 0 || this.topology[n - 1] === CommandType.Line) {
      return [
        this.getParametersOfNthCoordinate(shapeVectorIndex),
        this.getParametersOfNthCoordinate(shapeVectorIndex + 1),
      ];
    } else {
      return [
        this.getParametersOfNthCoordinate(shapeVectorIndex),
        this.getParametersOfNthCoordinate(shapeVectorIndex + 1),
        this.getParametersOfNthCoordinate(shapeVectorIndex + 2),
      ];
    }
  }

  public getParametersOfNthCoordinate(n: number): number[] {
    return this.basis.map((p) => p[n]);
  }

  public getShapeVectorIndexOfNthCommand(n: number): number {
    let index = 0;
    for (let i = 0; i < n; i++) {
      if (this.topology[i] === CommandType.Line) {
        index += 2;
      } else {
        index += 3;
      }
    }
    return index;
  }

  public async getIconAsPngUrl(): Promise<string> {
    if (this.previewIcon) {
      return this.previewIcon;
    }
    if (this.exampleShape) {
      const linestrips = flatten(
        this.exampleShape.map((s) => s.getLineStrips())
      );
      const svgxml = SvgToImage.getDebugSvgXmlFromSegments(
        linestrips,
        linestrips.map((s) => "black")
      ).svgXml;
      const pngurl = await AnalysisView.svgUrlToPng(
        AnalysisView.svgXmlToDataUrl(svgxml),
        ""
      );
      this.previewIcon = pngurl;
      return pngurl;
    } else {
      return "resources/images/" + this.shapeName + ".png";
    }
  }

  public static fromPathShape(shape: PathShape): AutoShape {
    const topology = shape.commands.map((command) =>
      SvgToCommands.isArc(command) ? CommandType.Arc : CommandType.Line
    );
    const shapeDataVectors = new Map();
    shapeDataVectors.set(name, shape.vectorizeCommands());
    const offset = Array.from(shapeDataVectors.values())[0];
    const len = offset.length;
    const basis = [];
    for (let i = 0; i < len; i++) {
      basis[i] = [];
      for (let j = 0; j < len; j++) {
        basis[i][j] = i === j ? 1 : 0;
      }
    }
    const paramRanges = basis.map((v) => {
      return { min: -100, max: 100 };
    });
    const autoShape = new AutoShape(
      shape.id,
      [],
      [shape],
      basis,
      offset,
      topology,
      paramRanges,
      paramRanges.length,
      1
    );
    return autoShape;
  }

  public findHandles() {}

  public getCommandEndPositions(params: number[]): Vector2[] {
    const shapeVector = this.shapeVectorFromParams(params);
    const shapeCommands = this.shapeCommandsFromShapeVector(shapeVector);
    const endPositions = [new Vector2(shapeVector[0], shapeVector[1])];
    shapeCommands.map((com) => {
      if (SvgToCommands.isLine(com)) {
        endPositions.push(new Vector2(com.x, com.y));
      }
      if (SvgToCommands.isArc(com)) {
        const ep_rep = SvgToCommands._convertCenterRepToEndpointRep(com);
        endPositions.push(new Vector2(ep_rep.x, ep_rep.y));
      }
    });
    return endPositions;
  }

  public getJsketcherSketchJson() {
    const shapeJson = [];
    let currentId = 0;
    const constraintsJson = [];
    const exampleShape = this.exampleShape[0];
    const pointEqualityDistance = 0.00001;

    const scale = 100;

    for (const prim of exampleShape.getJSketcherPrimitives(scale)) {
      shapeJson.push({
        id: (currentId++).toString(),
        type: prim.type,
        role: null,
        stage: 0,
        data: prim.data,
      });
    }
    if (this.constraints && this.constraints.length > 0) {
      for (const constraint of this.constraints) {
        const converted = constraint.getJsketcherConstraint(scale);
        if (converted) constraintsJson.push(converted);
      }
    } else {
      constraintsJson.push(
        ...exampleShape
          .getDefaultCoincidentConstraints()
          .map((c) => c.getJsketcherConstraint())
      );
    }

    const jsonHull = {
      model: {
        history: [
          {
            type: "PLANE",
            params: {
              orientation: "XY",
              depth: 0,
            },
          },
        ],
        expressions: "",
        assembly: [],
      },
      sketches: [
        {
          id: "S:0/SURFACE",
          data: {
            version: 3,
            objects: shapeJson,
            dimensions: [],
            labels: [],
            stages: [
              {
                constraints: constraintsJson,
                generators: [],
              },
            ],
            constants: "",
            metadata: {
              expressionsSignature: "1672418221815",
            },
          },
        },
      ],
    };
    const str = JSON.stringify(jsonHull);
    //const sketchGeom = ReadSketch(str, "cool", true);
    //console.log("sketchGeom", sketchGeom);
    // console.log();
    // const io = (window as any).__CAD_APP.viewer.io;
    // const result = io.loadSketch(JSON.stringify(jsonHull.sketches[0]));
    // console.log(result);
    console.log(jsonHull);
    return str;
  }

  addGeneralization(generalTool: AutoShape) {
    generalTool.specializedBy.push(this);
  }

  addSpecialization(specialTool: AutoShape) {
    this.specializedBy.push(specialTool);
  }

  removeGeneralization(generalTool: AutoShape) {
    generalTool.removeSpecialization(this);
  }

  removeSpecialization(specialTool: AutoShape) {
    const j = this.specializedBy.indexOf(specialTool);
    this.specializedBy.splice(j, 1);
  }

  public shapeCommandsFromShapeVector(vec: number[]) {
    const commands: (ArcCommand | LineCommand)[] = [];

    let angle = 0;
    let x0 = vec[0];
    let y0 = vec[1];

    let curr = 2;

    for (let i = 0; i < this.topology.length; i++) {
      const type = this.topology[i];

      if (type == CommandType.Arc) {
        const dAngle = vec[curr++];
        const arcAngle = vec[curr++];
        const r = vec[curr++];

        angle += dAngle;

        const s = angle - (Math.sign(arcAngle) * Math.PI) / 2;

        const x = x0 - r * Math.cos(s);
        const y = y0 - r * Math.sin(s);

        commands.push({
          x: x,
          y: y,
          r: r,
          s: s,
          e: s + arcAngle,
        });

        x0 = x + r * Math.cos(s + arcAngle);
        y0 = y + r * Math.sin(s + arcAngle);

        angle += arcAngle;
      } else {
        let dAngle = vec[curr++];
        let length = vec[curr++];

        angle += dAngle;

        let x = x0 + Math.cos(angle) * length;
        let y = y0 + Math.sin(angle) * length;

        commands.push({ x0: x0, y0: y0, x: x, y: y });
        x0 = x;
        y0 = y;
      }
    }

    return commands;
  }

  public shapeVectorToText(shapeVector: number[]): string {
    let text = "";
    let curr = 0;
    text +=
      "P " +
      shapeVector[curr++].toFixed(1) +
      " " +
      shapeVector[curr++].toFixed(1) +
      "\n";
    this.topology.forEach((type) => {
      if (type === CommandType.Arc) {
        text +=
          "A " +
          shapeVector[curr++].toFixed(1) +
          " " +
          shapeVector[curr++].toFixed(1) +
          " " +
          shapeVector[curr++].toFixed(1) +
          "\n";
      } else {
        text +=
          "L " +
          shapeVector[curr++].toFixed(1) +
          " " +
          shapeVector[curr++].toFixed(1) +
          "\n";
      }
    });
    return text;
  }

  public getMatrixTextAtOffset(j: number): string {
    let text = "";
    const h = this.basis.length;

    text += "[ " + this.offset[j].toFixed(1);

    for (let i = 0; i < h; i++) {
      text +=
        Math.abs(this.basis[i][j]) > 0.01
          ? " + " +
            this.basis[i][j].toFixed(1) +
            " * " +
            String.fromCharCode("a".charCodeAt(0) + i)
          : "";
    }
    text += " ]";
    return text;
  }

  public matrixToText(breakCharacter: string = "&#10;"): string {
    let text = "";
    let curr = 0;
    text +=
      "P " +
      this.getMatrixTextAtOffset(curr++) +
      " " +
      this.getMatrixTextAtOffset(curr++) +
      breakCharacter;
    this.topology.forEach((type) => {
      if (type === CommandType.Arc) {
        text +=
          "A " +
          this.getMatrixTextAtOffset(curr++) +
          " " +
          this.getMatrixTextAtOffset(curr++) +
          " " +
          this.getMatrixTextAtOffset(curr++) +
          breakCharacter;
      } else {
        text +=
          "L " +
          this.getMatrixTextAtOffset(curr++) +
          " " +
          this.getMatrixTextAtOffset(curr++) +
          breakCharacter;
      }
    });
    return text;
  }

  public parseTerm(term: string): number[] {
    const result: number[] = [];
    const parts = term.split("+");
    let maxIndex = 0;
    for (const part of parts) {
      const last = part[part.length - 1];
      if (last >= "a" && last <= "z") {
        const num = parseFloat(part.slice(0, -1));
        const index = last.charCodeAt(0) - "a".charCodeAt(0) + 1;
        result[index] = num;
        maxIndex = Math.max(index, maxIndex);
      } else {
        result[0] = parseFloat(part);
      }
    }
    for (let i = 0; i < maxIndex; i++) {
      if (result[i] === undefined) result[i] = 0;
    }
    console.log("parse", term, result);
    return result;
  }

  parseMatrixText(txt: string): boolean {
    const lines = txt.split("\n");
    try {
      let terms: string[] = [];
      for (let line of lines) {
        line = line.replace(/[PAL\s\*\[]/g, "");
        const t = line.split("]");
        terms.push(...t);
      }
      terms = terms.filter((term) => term !== "");
      const vectors = terms.map((t) => this.parseTerm(t));
      const mostParameters = Math.max(...vectors.map((v) => v.length));
      const sameLengthVectors = vectors.map((v) => [
        ...v,
        ...new Array(mostParameters - v.length).fill(0),
      ]);

      this.offset = sameLengthVectors.map((v) => v[0]);
      for (let i = 0; i < mostParameters - 1; i++) {
        if (!this.basis[i]) this.basis[i] = [];
        for (let j = 0; j < sameLengthVectors.length; j++) {
          this.basis[i][j] = sameLengthVectors[j][i + 1];
        }
      }
      this.basis.length = mostParameters - 1;
      this.updateParamsLength();

      return true;
    } catch (e) {
      return false;
    }
  }

  public updateParamsLength(): void {
    while (this.paramRanges.length < this.basis.length) {
      this.paramRanges.push({ min: -100, max: 100 });
    }
    if (this.paramRanges.length > this.basis.length) {
      this.paramRanges.length = this.basis.length;
    }
  }

  public shapeFromParams(
    paramsWeights: number[]
  ): (ArcCommand | LineCommand)[] {
    const shape = this.shapeVectorFromParams(paramsWeights);
    return this.shapeCommandsFromShapeVector(shape);
  }

  public shapeVectorFromParams(paramsWeights: number[]): number[] {
    const shape = [...this.offset];

    for (let i = 0; i < this.basis.length; i++) {
      const paramVector = this.basis[i];
      const weight = paramsWeights[i];
      for (let j = 0; j < paramVector.length; j++) {
        shape[j] = shape[j] + paramVector[j] * weight;
      }
    }
    return shape;
  }
}
