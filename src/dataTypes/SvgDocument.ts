import AutoShape from "./AutoShape";
import PathShape, {
  SerializedPathShape,
  ShapeRepresentation,
} from "./PathShape";
import { flatten, uniqBy, uniqWith } from "lodash";

export interface SerializedSvgDocument {
  pathShapes: SerializedPathShape[];
  name: string;
  originalSvgstring: string;
}

export default class SvgDocument {
  public pathShapes: PathShape[] = [];
  public name: string;
  public originalSvgString: string;

  constructor(
    pathShapes: PathShape[],
    name: string,
    originalSvgString: string
  ) {
    this.pathShapes = pathShapes;
    this.name = name;
    this.originalSvgString = originalSvgString;
  }

  public serialize(): SerializedSvgDocument {
    return {
      name: this.name,
      originalSvgstring: this.originalSvgString,
      pathShapes: this.pathShapes.map((p) => p.serialize()),
    };
  }

  public static deserialize(
    serialized: SerializedSvgDocument,
    autoShapes: AutoShape[]
  ): SvgDocument {
    const pathShapes = serialized.pathShapes.map((p) =>
      PathShape.deserialize(p)
    );
    const serializedRepresentations = flatten(
      serialized.pathShapes.map((p) => p.representations)
    );
    const uniqueSerializedRepresentations = uniqWith(
      serializedRepresentations,
      (a, b) => {
        return (
          a.autoShape === b.autoShape &&
          a.pathShapes.length === b.pathShapes.length &&
          a.pathShapes.every((s) => b.pathShapes.includes(s))
        );
      }
    );
    const representations: ShapeRepresentation[] =
      uniqueSerializedRepresentations.map((s) => {
        return {
          autoShape: autoShapes.find((a) => a.shapeName === s.autoShape),
          pathShapes: pathShapes.filter((p) => s.pathShapes.includes(p.id)),
          parameters: s.parameters,
          automaticallyDetermined: s.automaticallyDetermined,
        };
      });
    for (const r of representations) {
      for (const p of r.pathShapes) {
        p.representations.push(r);
        if (r.autoShape.exampleShape.length === 0) {
          r.autoShape.exampleShape = r.pathShapes;
        }
      }
    }
    return new SvgDocument(
      pathShapes,
      serialized.name,
      serialized.originalSvgstring
    );
  }
}
