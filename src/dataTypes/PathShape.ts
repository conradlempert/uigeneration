import { Vector2 } from "three";
import SvgToCommands, {
  ArcCommand,
  LineCommand,
} from "../algorithm/SvgToCommands";
import AutoShape from "./AutoShape";
import { AABB2D } from "../uiGenerationShapeMenu/svgToImage";
import { CoincidentConstraint } from "../algorithm/shapeDetect/constraints/CoincidentConstraint";
import * as SVGPath from "svgpath";
import * as AdaptiveLinearization from "adaptive-linearization";

export interface ShapeRepresentation {
  autoShape: AutoShape;
  pathShapes: PathShape[];
  parameters: number[];
  automaticallyDetermined: boolean;
}

export interface SerializedShapeRepresentation {
  autoShape: string;
  pathShapes: string[];
  parameters: number[];
  automaticallyDetermined: boolean;
}

export interface SerializedPathShape {
  id: string;
  path: string;
  commands: (LineCommand | ArcCommand)[];
  linearizedShape?: { x: number; y: number }[];
  representations: SerializedShapeRepresentation[];
}

export default class PathShape {
  public id: string;
  public style: string;
  public path: string;
  public commands: (LineCommand | ArcCommand)[];
  public representations: ShapeRepresentation[];

  linearizedShape?: { x: number; y: number }[];

  constructor(
    id: string,
    path: string = "",
    commands: (LineCommand | ArcCommand)[] = [],
    representations: ShapeRepresentation[] = []
  ) {
    this.id = id;
    this.path = path;
    this.commands = commands;
    this.representations = representations;
  }

  public getStartIndicesWithSameTopology(): number[] {
    const startIndices: number[] = [];
    const topologyString = this.commands
      .map((c) => (SvgToCommands.isLine(c) ? "L" : "A"))
      .join("");
    const l = topologyString.length;
    for (let i = 0; i < this.commands.length; i++) {
      let shiftedString = topologyString.slice(i) + topologyString.slice(0, i);
      if (shiftedString === topologyString) {
        startIndices.push(i);
      }
    }
    return startIndices;
  }

  public serialize(): SerializedPathShape {
    return {
      id: this.id,
      path: this.path,
      commands: this.commands,
      linearizedShape: this.linearizedShape,
      representations: this.serializeRepresentations(),
    };
  }

  public serializeRepresentations(): SerializedShapeRepresentation[] {
    return this.representations.map((r) => {
      return {
        autoShape: r.autoShape.shapeName,
        pathShapes: r.pathShapes.map((p) => p.id),
        automaticallyDetermined: r.automaticallyDetermined,
        parameters: r.parameters,
      };
    });
  }

  public getAABB(): AABB2D {
    const linestrips = this.getLineStrips();
    if (!linestrips) {
      return null;
    }
    const aabb = new AABB2D(linestrips[0]);
    for (const strip of linestrips.slice(1)) {
      aabb.addAABB2D(new AABB2D(strip));
    }
    return aabb;
  }

  public removeRepresentation(rep: ShapeRepresentation): void {
    const idx = this.representations.indexOf(rep);
    if (idx !== -1) this.representations.splice(idx, 1);
  }

  public getCenterPoint(): Vector2 {
    return this.getAABB().getCenter();
  }

  // THIS FUNCTION DOES NOT RESOLVE REPRESENTATIONS YET
  public static deserialize(
    serializedPathShape: SerializedPathShape
  ): PathShape {
    return new PathShape(
      serializedPathShape.id,
      serializedPathShape.path,
      serializedPathShape.commands,
      []
    );
  }

  public getLineStrips(): Vector2[][] | null {
    if (this.path) {
      // TODO JULIAN: find library that linearizes for us
      return [this.linearizeCommandLoop(this.commands)];
    }
    return null;
  }

  private linearizeCommandLoop( commands: (LineCommand | ArcCommand)[]): Vector2[] {
    let linearized: Vector2[]  = [];

    function lineConsumer (x1: number, y1: number, x2: number, y2: number, data: number) {
      linearized.push(new Vector2(x2, y2));
    }

    // path string cleanup
    let cleanPath = (this.path as any).replaceAll(",", " ");

    const path = SVGPath(cleanPath).unarc().abs();

    const al = new AdaptiveLinearization(lineConsumer);
    path.iterate(al.svgPathIterator);
    
    return linearized;
  }

  public convertToXmlString(color: string = "black"): string {
    return '<path d="' + this.path + '" />';
  }

  public vectorizeCommands(): number[] {
    const vector = [];

    let lastAngle = 0;

    if (SvgToCommands.isArc(this.commands[0])) {
      const arc = this.commands[0];

      vector.push(arc.x + arc.r * Math.cos(arc.s));
      vector.push(arc.y + arc.r * Math.sin(arc.s));
    } else {
      const line = this.commands[0];
      vector.push(line.x0);
      vector.push(line.y0);
    }

    for (let i = 0; i < this.commands.length; i++) {
      const command = this.commands[i];

      if (SvgToCommands.isArc(command)) {
        const arc = command;

        const arcAngle = arc.e - arc.s;
        const dAngle = arc.s - lastAngle + (Math.sign(arcAngle) * Math.PI) / 2;

        vector.push(dAngle);
        vector.push(arcAngle);
        vector.push(arc.r);

        lastAngle += dAngle + arcAngle; // arc.e + Math.sign(arcAngle) * Math.PI / 2;
      } else {
        const line = command;
        let currAngle = Math.atan2(line.y - line.y0, line.x - line.x0);

        let length = Math.hypot(line.x - line.x0, line.y - line.y0);

        vector.push((currAngle - lastAngle + 2 * Math.PI) % (2 * Math.PI));
        vector.push(length);

        lastAngle = currAngle;
      }
    }

    return vector;
  }

  public getDefaultCoincidentConstraints(): CoincidentConstraint[] {
    const indexList: [string, string][] = [];
    for (const [i, command] of this.commands.entries()) {
      if (SvgToCommands.isLine(command)) {
        indexList.push([i + ":A", i + ":B"]);
      } else {
        if (command.e - command.s > 0) {
          indexList.push([i + ":B", i + ":A"]);
        } else {
          indexList.push([i + ":A", i + ":B"]);
        }
      }
    }
    const constraints = indexList.map((indices, i) => {
      return new CoincidentConstraint(
        indexList[i][1],
        indexList[(i + 1) % indexList.length][0]
      );
    });
    return constraints;
  }
}
