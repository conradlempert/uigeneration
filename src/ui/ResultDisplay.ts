import Chart from "chart.js/auto";
import SvgDocument from "../dataTypes/SvgDocument";
import { FullRun } from "../algorithm/FullRun";
import ToolSetDetailView from "./ToolSetDetailView";
import { ShapeHierarchy } from "../dataTypes/ShapeHierarchy";
import ParametrizedShape from "../dataTypes/PathShape";
import AutoShape from "../dataTypes/AutoShape";
import { flatten } from "lodash";
import ToolSet from "../dataTypes/ToolSet";
import PathShape from "../dataTypes/PathShape";
import AnalysisView from "./AnalysisView";
import SvgToImage from "../uiGenerationShapeMenu/svgToImage";

export interface CostWeights {
  paramWeight: number;
  toolSetSizeWeight: number;
  notCoveredWeight: number;
}

export default class ResultDisplay {
  private static toolSets: { toolSet: ToolSet; pareto: boolean }[] = [];
  private static maxToolSetSize: number = 0;
  private static scatterChart: Chart<"scatter", number[][], string>;
  private static scrollPositions = {};
  private static documents: SvgDocument[];
  private static shapeHierarchy: ShapeHierarchy;
  private static barChart: Chart<"bar", any, string>;
  private static paretoVis: boolean = false;
  private static stop: boolean = false;

  private static costWeights: CostWeights = {
    paramWeight: 0.5,
    toolSetSizeWeight: 0.5,
    notCoveredWeight: 0.5,
  };

  public static async open(
    documents: SvgDocument[],
    shapeLibrary: AutoShape[]
  ): Promise<void> {
    (document.querySelector("#uiWrapper") as HTMLDivElement).style.display =
      "none";
    this.documents = documents;
    this.shapeHierarchy = new ShapeHierarchy();
    this.shapeHierarchy.addShapeToolsFromShapeLibrary(
      shapeLibrary,
      flatten(this.getAllShapes())
    );
    this.recompute();
  }

  public static getAllShapes(): PathShape[][] {
    return this.documents.map((d) => d.pathShapes);
  }

  public static clear() {
    if (this.scatterChart) this.scatterChart.destroy();
    if (this.barChart) this.barChart.destroy();
  }

  public static redraw() {
    this.clear();
    this.showResults();
  }

  private static async recompute() {
    console.log("STEP 1: trigger recompute");
    this.maxToolSetSize = 0;

    this.clear();
    const allowDocuments = (
      document.getElementById("allowDocuments") as HTMLInputElement
    ).checked;
    const toolsets = await FullRun.fullRun(
      this.documents,
      this.shapeHierarchy,
      this.costWeights,
      allowDocuments
    );
    this.toolSets = toolsets.map((t) => {
      const toolset = { toolSet: t, pareto: false };
      return toolset;
    });
    this.showResults();
  }

  private static mapSliderValueToParameter(sliderValue: number): number {
    return Math.pow(2, sliderValue / 10 - 5);
  }

  private static mapParameterToSliderValue(parameter: number): number {
    return (Math.log2(parameter) + 5) * 10;
  }

  public static showResults(): void {
    const infoBox = document.getElementById("toolsetInfo");
    infoBox.style.display = "block";

    this.drawToolSets();
    const canvas = document.getElementById("resultCanvas");
    canvas.style.display = "block";
    const scatterCanvas = document.getElementById("chartCanvas");
    scatterCanvas.style.display = "block";
    const barCanvas = document.getElementById("barCanvas");
    barCanvas.style.display = "block";
    const scrollDiv = document.getElementById("chartAreaWrapper2");
    scrollDiv.style.display = "block";
    //const cancelButton = document.getElementById('cancelButton');
    //cancelButton.style.display = 'block';

    const sliderAContainer = document.getElementById("sliderContainerA");
    sliderAContainer.style.display = "block";
    const sliderContainerB = document.getElementById("sliderContainerB");
    sliderContainerB.style.display = "block";
    const sliderContainerC = document.getElementById("sliderContainerC");
    sliderContainerC.style.display = "block";

    const sliderADisplay = document.getElementById("sliderValueA");
    const sliderBDisplay = document.getElementById("sliderValueB");
    const sliderCDisplay = document.getElementById("sliderValueC");

    sliderADisplay.innerText = this.costWeights.paramWeight.toFixed(2);
    sliderBDisplay.innerText = this.costWeights.toolSetSizeWeight.toFixed(2);
    sliderCDisplay.innerText = this.costWeights.notCoveredWeight.toFixed(2);

    const sliderA = document.getElementById("sliderA");
    (sliderA as HTMLInputElement).value = this.mapParameterToSliderValue(
      this.costWeights.paramWeight
    ).toString();
    sliderA.oninput = () => {
      this.costWeights.paramWeight = this.mapSliderValueToParameter(
        parseFloat((sliderA as HTMLInputElement).value)
      );
      sliderADisplay.innerText = this.costWeights.paramWeight.toFixed(2);
    };
    const sliderB = document.getElementById("sliderB");
    (sliderB as HTMLInputElement).value = this.mapParameterToSliderValue(
      this.costWeights.toolSetSizeWeight
    ).toString();
    sliderB.oninput = () => {
      this.costWeights.toolSetSizeWeight = this.mapSliderValueToParameter(
        parseFloat((sliderB as HTMLInputElement).value)
      );
      sliderBDisplay.innerText = this.costWeights.toolSetSizeWeight.toFixed(2);
    };
    const sliderC = document.getElementById("sliderC");
    (sliderC as HTMLInputElement).value = this.mapParameterToSliderValue(
      this.costWeights.notCoveredWeight
    ).toString();
    sliderC.oninput = () => {
      this.costWeights.notCoveredWeight = this.mapSliderValueToParameter(
        parseFloat((sliderC as HTMLInputElement).value)
      );
      sliderCDisplay.innerText = this.costWeights.notCoveredWeight.toFixed(2);
    };

    sliderA.onmouseup = () => {
      this.recompute();
    };
    sliderB.onmouseup = () => {
      this.recompute();
    };
    sliderC.onmouseup = () => {
      this.recompute();
    };

    document.getElementById("onlyPareto").oninput = (e) => {
      this.recompute();
    };
    document.getElementById("allowDocuments").oninput = (e) => {
      this.recompute();
    };
    //cancelButton.onclick = (ev) => this.stop = true;
  }

  public static hideResults(): void {
    const canvas = document.getElementById("resultCanvas");
    canvas.style.display = "none";
    const scatterCanvas = document.getElementById("chartCanvas");
    scatterCanvas.style.display = "none";
    const barCanvas = document.getElementById("barCanvas");
    barCanvas.style.display = "none";
    const scrollDiv = document.getElementById("chartAreaWrapper2");
    scrollDiv.style.display = "none";
    //const cancelButton = document.getElementById('cancelButton');
    //cancelButton.style.display = 'none';

    const sliderAContainer = document.getElementById("sliderContainerA");
    sliderAContainer.style.display = "none";
    const sliderContainerB = document.getElementById("sliderContainerB");
    sliderContainerB.style.display = "none";
    const sliderContainerC = document.getElementById("sliderContainerC");
    sliderContainerC.style.display = "none";

    //this.app.view.parentElement.style.minWidth = '100px';
  }

  public static addToolset(toolSet: ToolSet) {
    this.toolSets.push({
      toolSet: toolSet,
      pareto: false,
    });
  }

  private static drawTool(
    tool: AutoShape,
    x: number,
    y: number,
    toolSet: ToolSet = null
  ) {
    const imgTag = document.createElement("img");
    imgTag.style.left = x + "px";
    imgTag.style.top = y + "px";
    imgTag.style.cursor = "pointer";
    imgTag.style.width = "70px";
    imgTag.style.height = "70px";
    imgTag.style.border = "1px solid black";
    imgTag.style.position = "absolute";
    imgTag.addEventListener("click", () => {
      this.onToolSetSelection(toolSet);
    });
    tool.getIconAsPngUrl().then((dataUrl) => {
      imgTag.src = dataUrl;
    });
    document.querySelector("#belowChartToolsets").appendChild(imgTag);
  }

  public static drawDocument(
    svgDocument: SvgDocument,
    x: number,
    y: number,
    toolset: ToolSet,
    covered: boolean
  ) {
    const imgTag = document.createElement("img");
    imgTag.style.left = x + "px";
    imgTag.style.top = y + "px";
    imgTag.style.cursor = "pointer";
    imgTag.style.width = "70px";
    imgTag.style.height = "70px";
    imgTag.style.border = "1px solid black";
    imgTag.style.position = "absolute";
    imgTag.addEventListener("click", () => {
      this.onToolSetSelection(toolset);
    });
    this.getImageFromDocument(
      svgDocument,
      covered ? "black" : "lightgray"
    ).then((dataUrl) => {
      imgTag.src = dataUrl;
    });
    document.querySelector("#belowChartToolsets").appendChild(imgTag);
  }

  public static async getImageFromDocument(
    svgDocument: SvgDocument,
    color: string
  ): Promise<string> {
    const segments: Vector2[][] = [];
    svgDocument.pathShapes.forEach((shape) => {
      const linestrips = shape.getLineStrips();
      if (linestrips) {
        linestrips.forEach((strip) => {
          segments.push(strip);
        });
      }
    });
    const { svgXml } = SvgToImage.getDebugSvgXmlFromSegments(
      segments,
      new Array(segments.length).fill(color),
      new Array(segments.length).fill(5)
    );
    const svgUrl = AnalysisView.svgXmlToDataUrl(svgXml);
    const pngUrl = await AnalysisView.svgUrlToPng(svgUrl, "");
    return pngUrl;
  }

  public static logToolSets(toolSets: ToolSet[]): void {
    let msg = "%c All tools\n#tools fails param   \n%c";
    toolSets.forEach((set) => {
      msg +=
        set.getSetCost().toFixed(2) +
        "   " +
        set.getNotCoveredCost().toFixed(2) +
        "   " +
        set.getParameterCost().toFixed(2) +
        "   " +
        set.getElemNames().join(", ") +
        "\n";
    });
    console.log(msg, "font-weight:bold", "font-weight:regular");
  }

  public static drawToolSets(): void {
    console.log("There are " + this.toolSets.length + " toolsets");
    this.logToolSets(this.toolSets.map((t) => t.toolSet));
    console.log("STEP 3: check pareto optimality");
    if ((document.getElementById("onlyPareto") as HTMLInputElement).checked) {
      // CHECK PARETO OPTIMALITY
      const stats = this.toolSets.map((t) => [
        t.toolSet.getSetCost(),
        t.toolSet.getNotCoveredCost(),
        t.toolSet.getParameterCost(),
      ]);
      for (let i = 0; i < this.toolSets.length; i++) {
        this.toolSets[i].pareto = true;
      }
      for (let i = 0; i < this.toolSets.length; i++) {
        for (let j = 0; j < this.toolSets.length; j++) {
          if (i == j || !this.toolSets[j].pareto) continue;
          const statsI = stats[i];
          const statsJ = stats[j];
          if (statsI.every((val, index) => statsJ[index] <= statsI[index])) {
            this.toolSets[i].pareto = false;
          }
        }
      }
      this.toolSets = this.toolSets.filter((t) => t.pareto);
    }
    console.log("STEP 4: sort by score");
    this.toolSets.sort((t1, t2) => {
      return t1.toolSet.getTotalCost() - t2.toolSet.getTotalCost();
    });

    console.log("STEP 5: render toolsets");

    const best = this.toolSets[0].toolSet;
    document.getElementById("numberOfTools").innerText = best
      .getSet()
      .length.toString();
    document.getElementById("coverage").innerText = (
      best.getCoverage() * 100
    ).toFixed(0);
    document.getElementById("parameters").innerText = (
      best.getParameterCost() / best.costWeights.paramWeight
    ).toFixed(0);

    const y_base = 1060;
    let y = y_base;

    const maxDisplayCount = 20;

    this.maxToolSetSize = this.toolSets
      .filter((v, i) => i < maxDisplayCount)
      .map((v) => v.toolSet.getSize())
      .reduce((a, b) => Math.max(a, b), 0);

    console.log(
      "Tool sets:",
      this.toolSets.map((v) => v.toolSet)
    );
    console.log("Max toolset size: ", this.maxToolSetSize);

    const belowChartToolsetsWrapper = document.querySelector(
      "#belowChartToolsets"
    ) as HTMLDivElement;
    belowChartToolsetsWrapper.innerHTML = "";
    let x = 80;
    for (const toolSetData of this.toolSets.slice(0, maxDisplayCount)) {
      y = y_base - 30;
      const tools = toolSetData.toolSet.getSet();
      for (const tool of tools) {
        this.drawTool(tool, x, y, toolSetData.toolSet);
        y += 80;
      }
      x += 80;
    }
    const belowChartBottomY = y_base + this.maxToolSetSize * 80 + 50;
    belowChartToolsetsWrapper.style.height =
      this.maxToolSetSize * 80 + maxDisplayCount * 80 + 200 + "px";

    console.log("STEP 6: render coverage data");

    y = belowChartBottomY + 150;
    for (const toolSetData of this.toolSets.slice(0, maxDisplayCount)) {
      x = 80;
      const tools = toolSetData.toolSet.getSet();
      for (const tool of tools) {
        this.drawTool(tool, x, y, toolSetData.toolSet);
        x += 80;
      }
      x = 160 + this.maxToolSetSize * 80;
      const coverageData = toolSetData.toolSet.getToolCoverageData();
      for (const [doc, coverage] of Array.from(coverageData.entries())) {
        const covered = coverage.size !== 0;
        this.drawDocument(doc, x, y, toolSetData.toolSet, covered);
        x += 80;
      }

      y += 80;
    }

    console.log("STEP 7: draw bar chart");

    const sliced = this.toolSets.slice(0, maxDisplayCount);

    // draw chart
    this.createBarChart(
      sliced.map((ts) => ts.toolSet.getParameterCost()),
      sliced.map((ts) => ts.toolSet.getSetCost()),
      sliced.map((ts) => ts.toolSet.getNotCoveredCost()),
      sliced.map((ts, i) => ts.toolSet.getElemNames())
    );

    console.log("STEP 8: resize view");

    // TODO
  }

  public static onToolSetSelection(toolSet: ToolSet) {
    ToolSetDetailView.initialize(
      toolSet.getToolCoverageData(),
      Array.from(toolSet.getSet()) as AutoShape[]
    );
  }

  public static createBarChart(creationCost, setCost, notCoveredCost, labels) {
    this.barChart = new Chart("barCanvas", {
      type: "bar",
      data: {
        labels: creationCost.map((x) => ""),
        datasets: [
          {
            label: "Parameter cost",
            data: creationCost,
            backgroundColor: "rgba(0, 131, 143, 1.0)",
            borderWidth: 1,
          },
          {
            label: "Set size cost",
            data: setCost,
            backgroundColor: "rgba(135, 0, 0, 1.0)",
            borderWidth: 1,
          },
          {
            label: "Not covered cost",
            data: notCoveredCost,
            backgroundColor: "rgba(125, 164, 83, 1.0)",
            borderWidth: 1,
          },
        ],
      },
      options: {
        maintainAspectRatio: false,
        animation: {
          duration: 0,
        },
        scales: {
          x: {
            stacked: true,
          },
          y: {
            beginAtZero: true,
            stacked: true,
          },
        },
      },
    });

    document.getElementById("chartAreaWrapper2").style.width =
      creationCost.length * 80 + 130 + "px";
  }
}
