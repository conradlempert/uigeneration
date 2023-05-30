import SvgDocument from "../dataTypes/SvgDocument";
import PathShape from "../dataTypes/PathShape";
import AutoShape from "../dataTypes/AutoShape";
import AnalysisView from "./AnalysisView";
import ColorToCssSolver from "../util/ColorToCssSolver";
import { DrawingApp } from "./DrawingApp";
import { FileHandling } from "../util/FileHandling";
import SvgToImage from "../uiGenerationShapeMenu/svgToImage";
import { Vector2 } from "three";

const size = 300;
export default class ToolSetDetailView {
  public static coverageData: Map<SvgDocument, Map<PathShape, AutoShape>>;
  public static tools: AutoShape[];
  public static documentImages: HTMLImageElement[];

  public static initialize(
    coverageData: Map<SvgDocument, Map<PathShape, AutoShape>>,
    tools: AutoShape[]
  ) {
    this.coverageData = coverageData;
    this.tools = tools;

    var wrapper = document.createElement("div"); // test this
    wrapper.id = "toolCoverageWrapper";
    wrapper.style.width = "100%";
    wrapper.style.height = "100%";
    wrapper.style.position = "fixed";
    wrapper.style.top = "0%";
    wrapper.style.left = "0%";
    wrapper.style.zIndex = "10000";
    wrapper.style.backgroundColor = "white";
    wrapper.style.overflowY = "auto";
    document.body.appendChild(wrapper);

    const topBar = document.createElement("div");
    topBar.style.width = "100%";
    topBar.style.height = "100px";
    wrapper.appendChild(topBar);

    var headline = document.createElement("h1");
    headline.innerText = "Toolset details";
    headline.style.display = "inline-block";
    topBar.appendChild(headline);

    const exportButton = document.createElement("button");
    exportButton.id = "exportButton";
    exportButton.innerText = "Export as JSON";
    exportButton.style.marginTop = "40px";
    exportButton.addEventListener("click", (e) => {
      this.export();
    });
    topBar.appendChild(exportButton);

    const exitButton = document.createElement("button");
    exitButton.id = "exitButton";
    exitButton.innerText = "Exit";
    exitButton.style.marginTop = "40px";
    exitButton.addEventListener("click", (e) => {
      this.exit();
    });
    topBar.appendChild(exitButton);

    const toolBar = document.createElement("div");
    toolBar.id = "toolBar";
    toolBar.style.width = "100%";
    toolBar.style.height = "150px";
    wrapper.appendChild(toolBar);

    const documentsWrapper = document.createElement("div");
    documentsWrapper.id = "documentsWrapper";
    wrapper.appendChild(documentsWrapper);

    this.redrawShapeMenu();
    this.initDocumentsImages();
  }

  public static async redrawShapeMenu(): Promise<void> {
    const toolBar = document.getElementById("toolBar") as HTMLDivElement;
    toolBar.innerHTML = "";
    for (const tool of this.tools) {
      await this.createToolInfo(toolBar, tool);
    }
  }

  public static async createToolInfo(
    wrapper: HTMLDivElement,
    tool: AutoShape
  ): Promise<void> {
    const shapeDiv = document.createElement("div");
    shapeDiv.style.height = "100px";
    shapeDiv.style.width = "100px";
    shapeDiv.style.display = "inline-block";
    shapeDiv.style.verticalAlign = "top";
    const shapeInfo = document.createElement("p");
    shapeInfo.style.fontSize = "10pt";
    shapeInfo.style.wordBreak = "break-word";
    shapeInfo.style.paddingRight = "5px";
    shapeInfo.innerText = tool.getNameText();
    const shapeImg = document.createElement("img");
    shapeImg.style.height = "80px";
    shapeImg.style.width = "80px";
    shapeImg.src = await tool.getIconAsPngUrl();
    const index = this.tools.indexOf(tool);
    const color = AnalysisView.getColor(index, this.tools.length);
    const cssFilters = ColorToCssSolver.colorToCssFilter(color);
    shapeImg.style.cssText += cssFilters;
    shapeDiv.appendChild(shapeImg);
    shapeDiv.appendChild(shapeInfo);
    shapeDiv.style.cursor = "pointer";
    wrapper.appendChild(shapeDiv);
  }

  public static async initDocumentsImages(): Promise<void> {
    const documentsWrapper = document.getElementById("documentsWrapper");
    const documents = Array.from(this.coverageData.keys());
    documentsWrapper.innerHTML = "";
    this.documentImages = [];
    for (const [index, doc] of documents.entries()) {
      const img = document.createElement("img");
      img.src = "data:,";
      img.width = size;
      img.height = size;
      img.style.width = "300px";
      img.style.height = "300px";
      img.style.border = "1px solid black";
      img.style.margin = "10px";
      img.id = "document" + index;
      documentsWrapper.appendChild(img);
      this.documentImages.push(img);
    }
    await this.redrawDocuments();
  }

  public static async redrawDocuments(): Promise<void> {
    let i = 0;
    const jsons = Array.from(this.coverageData.keys());
    for (const json of jsons) {
      const index = jsons.indexOf(json);
      const svg = this.generateSvgForDocument(json);
      const covered = this.coverageData.get(json).size !== 0;
      const svgUrl = AnalysisView.svgXmlToDataUrl(svg);
      const pngUrl = await AnalysisView.svgUrlToPng(svgUrl, "");
      const img = this.documentImages[index];
      if (!covered) {
        img.style.opacity = "0.2";
      } else {
        img.style.opacity = "1.0";
      }
      img.src = pngUrl;
      i++;
    }
  }

  public static generateSvgForDocument(doc: SvgDocument): string {
    const shapes = doc.pathShapes;
    const data = this.coverageData.get(doc);
    const segments: Vector2[][] = [];
    const colors: string[] = [];
    for (const shape of shapes) {
      const tool = data.get(shape);
      if (!tool) {
        const strips = shape.getLineStrips();
        segments.push(...strips);
        colors.push("gray");
      } else {
        if (tool.level === 1) {
          const strips = shape.getLineStrips();
          segments.push(...strips);
          const index = this.tools.indexOf(tool);
          const color = AnalysisView.getColor(index, this.tools.length);
          colors.push(...strips.map((s) => color));
        } else {
          // TODO FIX
          const aabb = shape.getAABB();
          const linestrip = AnalysisView.aabbToLineStrip(aabb);
          const segment = linestrip;
          const index = this.tools.indexOf(tool);
          const color = AnalysisView.getColor(index, this.tools.length);
          segments.push(segment);
          colors.push(color);
        }
      }
    }
    return SvgToImage.getDebugSvgXmlFromSegments(segments, colors).svgXml;
  }

  public static exit(): void {
    document.getElementById("toolCoverageWrapper").remove();
  }

  public static async export(): Promise<void> {
    for (const tool of this.tools) {
      await tool.getIconAsPngUrl();
    }
    const json = JSON.stringify(this.tools.map((t) => t.serialize()));
    const filename =
      this.tools.map((t) => t.getNameText()).join("_") +
      "_" +
      Math.floor(Date.now() / 1000) +
      ".toolset.json";
    FileHandling.downloadBlob(FileHandling.blobForText(json), filename);
  }
}
