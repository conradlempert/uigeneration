import SvgDocument from "./SvgDocument";
import AutoShape from "./AutoShape";
import PathShape from "./PathShape";

export default class ToolSet {
  private set: AutoShape[];
  private costs: Map<SvgDocument, number>;
  private coverageData: Map<SvgDocument, Map<PathShape, AutoShape>>;

  public costWeights: {
    paramWeight: number;
    toolSetSizeWeight: number;
    notCoveredWeight: number;
  };

  public constructor(set: AutoShape[]) {
    this.set = set;
    this.costs = new Map<SvgDocument, number>();
    this.coverageData = new Map<SvgDocument, Map<PathShape, AutoShape>>();
  }

  public evalOn(
    documents: SvgDocument[],
    costWeights: {
      paramWeight: number;
      toolSetSizeWeight: number;
      notCoveredWeight: number;
    }
  ): void {
    this.costWeights = costWeights;

    const asSet = this.getSet();

    for (let document of documents) {
      const buildData = this.buildDocWithSet(document, asSet);
      this.costs.set(document, buildData.cost);
      this.coverageData.set(document, buildData.coverage);
    }
  }

  public getCosts(): Map<SvgDocument, number> {
    return this.costs;
  }

  public getSize(): number {
    return this.getSet().length;
  }

  public getCoverage(): number {
    return this.getCoveredCount() / this.getDocumentCount();
  }

  public getParameterCost(): number {
    if (this.getCoveredCount() === 0) {
      return 0;
    }

    let totalCost =
      Array.from(this.getCosts().values()).reduce(
        (prev, curr) => prev + (curr == Infinity ? 0 : curr),
        0.0
      ) / this.getCoveredCount();

    return totalCost * this.costWeights.paramWeight;
  }

  public getDocumentCount(): number {
    return this.getCosts().size;
  }

  public getCoveredCount(): number {
    return Array.from(this.getCosts().values()).reduce(
      (prev, curr) => prev + (curr == Infinity ? 0 : 1),
      0.0
    );
  }

  public getNotCoveredCost(): number {
    return (
      (this.getDocumentCount() - this.getCoveredCount()) *
      this.costWeights.notCoveredWeight
    );
  }

  public getSetCost(): number {
    return this.getSet().length * this.costWeights.toolSetSizeWeight;
  }

  public getTotalCost(): number {
    return (
      this.getParameterCost() + this.getSetCost() + this.getNotCoveredCost()
    );
  }

  public getSet(): AutoShape[] {
    return this.set;
  }

  public getNameText(): string {
    return "a Toolset (" + this.getSize() + ")";
  }

  public getElemNames(): string[] {
    return Array.from(this.getSet()).map((val) => val.getNameText());
  }

  public getToolCoverageData(): Map<SvgDocument, Map<PathShape, AutoShape>> {
    return this.coverageData;
  }

  public buildDocWithSet(doc: SvgDocument, toolset: AutoShape[]) {
    // high level tools first, then cheapest tool per level
    const order = Array.from(toolset).sort((a, b) =>
      a.level == b.level ? a.cost - b.cost : b.level - a.level
    );

    const shapes = doc.pathShapes;
    const remaining = new Set(shapes);

    let cost = 0;
    const coverage = new Map<PathShape, AutoShape>();

    for (const tool of order) {
      const shapeArray = Array.from(remaining);
      for (const subshape of shapeArray) {
        if (!remaining.has(subshape)) {
          // ALREADY COVERED
          continue;
        }
        const reps = tool.tryToCover(subshape);
        if (reps) {
          for (const rep of reps) {
            // ensure the whole tool can be applied
            if (rep.pathShapes.some((shape) => !remaining.has(shape))) {
              continue;
            }

            cost += tool.cost;

            for (const shape of rep.pathShapes) {
              coverage.set(shape, tool);
              remaining.delete(shape);
            }

            coverage.set(subshape, tool);

            break;
          }
        }
      }
    }
    if (remaining.size > 0) {
      return { cost: Infinity, coverage: new Map<PathShape, AutoShape>() };
    }

    return { cost: cost, coverage: coverage };
  }
}
