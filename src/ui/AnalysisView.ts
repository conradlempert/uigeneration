import { flatten, uniq } from "lodash";
import { Matrix3, Vector2 } from "three";
import ColorToCssSolver from "../util/ColorToCssSolver";
import { FileHandling } from "../util/FileHandling";
import PathShape, { ShapeRepresentation } from "../dataTypes/PathShape";
import ShapeHierarchyEditor from "./ShapeHierarchyEditor";
import PCADetailView from "./PCADetailView";
import SVGCommandView from "./SVGCommandView";
import ResultDisplay from "./ResultDisplay";
import AutoShape from "../dataTypes/AutoShape";
import SvgDocument from "../dataTypes/SvgDocument";
import SvgToImage, { AABB2D } from "../uiGenerationShapeMenu/svgToImage";
import * as pointInPolygon from "point-in-polygon";

const size = 300;
const svgRenderPadding = 20;
const defaultStrokeWidth = 5;

export default class AnalysisView {
  public static documents: SvgDocument[] = [];
  public static parametrizedXmlStrings: Map<PathShape, string>;
  public static selectedShapeIndex: number = -1;
  public static shapeLibrary: AutoShape[] = [];
  public static documentImages: HTMLImageElement[] = [];
  public static pixelSpaceSegmentOutlines = new Map<
    SvgDocument,
    Map<Vector2[], PathShape | ShapeRepresentation>
  >();
  //public static cachedShapeIcons = new Map<SerializedParametrizedShape, string>();
  public static shapeToJson = new Map<PathShape, SvgDocument>();
  public static currentMultiRepresentation: ShapeRepresentation = null;
  public static jsonsThatNeedRedrawing = new Set<SvgDocument>();
  public static deleteDocumentsMode = false;
  static shapeImages: Map<string, string>;

  public static async initialize(documents: SvgDocument[]): Promise<void> {
    //console.log(documents);
    this.documents = documents;
    const shapes = Array.from(this.getShapeOccurences().keys());
    for (const doc of documents) {
      for (const shape of doc.pathShapes) {
        this.shapeToJson.set(shape, doc);
      }
    }
    this.shapeLibrary = shapes;
    this.shapeImages = new Map<string, string>();

    //await this.cacheShapeIcons();

    var wrapper = document.createElement("div"); // test this
    wrapper.id = "analysisResultsWrapper";
    wrapper.style.width = "95%";
    wrapper.style.height = "100%";
    wrapper.style.position = "absolute";
    wrapper.style.top = "0%";
    wrapper.style.left = "5%";
    wrapper.style.zIndex = "10000";
    wrapper.style.backgroundColor = "white";
    wrapper.style.overflowY = "auto";
    document.body.appendChild(wrapper);

    const topBar = document.createElement("div");
    topBar.style.width = "100%";
    topBar.style.height = "100px";
    wrapper.appendChild(topBar);

    var headline = document.createElement("h1");
    headline.innerText = "Analysis results";
    headline.style.display = "inline-block";
    topBar.appendChild(headline);

    const generateButton = document.createElement("button");
    generateButton.innerText = "Generate toolsets";
    generateButton.style.margin = "40px";
    generateButton.addEventListener("click", (e) => {
      this.startToolsetGeneration();
    });
    topBar.appendChild(generateButton);

    const editShapeHierarchyButton = document.createElement("button");
    editShapeHierarchyButton.innerText = "Edit shape hierarchy";
    editShapeHierarchyButton.addEventListener("click", (e) => {
      this.editShapeHierarchy();
    });
    topBar.appendChild(editShapeHierarchyButton);

    const downloadJsonsButton = document.createElement("button");
    downloadJsonsButton.innerText = "Download JSONs";
    downloadJsonsButton.addEventListener("click", (e) => {
      this.downloadDocuments();
    });
    topBar.appendChild(downloadJsonsButton);

    const deleteDocumentsButton = document.createElement("button");
    deleteDocumentsButton.innerText = "Delete documents mode";
    deleteDocumentsButton.id = "deleteDocumentsButton";
    deleteDocumentsButton.addEventListener("click", (e) => {
      this.deleteDocumentsMode = !this.deleteDocumentsMode;
      deleteDocumentsButton.innerText = this.deleteDocumentsMode
        ? "End delete documents mode"
        : "Delete documents mode";
    });
    topBar.appendChild(deleteDocumentsButton);

    const shapeDetails = document.createElement("button");
    shapeDetails.innerText = "Show shape details";
    shapeDetails.id = "shapeDetailsButton";
    shapeDetails.style.visibility = "hidden";
    shapeDetails.addEventListener("click", (e) => {
      this.showShapeDetails();
    });
    topBar.appendChild(shapeDetails);

    const shapeBar = document.createElement("div");
    shapeBar.id = "shapeBar";
    shapeBar.style.width = "100%";
    shapeBar.style.height = "150px";
    wrapper.appendChild(shapeBar);

    //console.log("drawing shape menu");
    this.redrawShapeMenu();
    //console.log("creating document wrappers");
    const documentsWrapper = document.createElement("div");
    documentsWrapper.id = "documentsWrapper";
    wrapper.appendChild(documentsWrapper);
    await this.initDocumentsImages();
  }

  public static async downloadDocuments(): Promise<void> {
    const names = this.documents.map((j) => j.name);
    const texts = this.documents.map((j) => JSON.stringify(j.serialize()));

    names.push("shapeHierarchy");
    const shapeLibraryCopy = this.shapeLibrary.map((a) => a.serialize());
    texts.push(JSON.stringify(shapeLibraryCopy));

    const blobs = texts.map((t) => FileHandling.blobForText(t));
    const namesAndContent = new Map(
      names.map((name, index) => [name + ".json", blobs[index]])
    );

    await FileHandling.downloadZip(namesAndContent, "blobs.zip");
  }

  public static showShapeDetails(): void {
    const autoShape = this.shapeLibrary[this.selectedShapeIndex];
    PCADetailView.initialize(autoShape);
  }

  public static editShapeHierarchy(): void {
    ShapeHierarchyEditor.initialize(this.shapeLibrary, this.shapeImages);
  }

  public static async redrawShapeMenu(): Promise<void> {
    const map = this.getShapeOccurences();
    const shapeBar = document.getElementById("shapeBar") as HTMLDivElement;
    shapeBar.innerHTML = "";
    const foundAutoShapes = Array.from(map.keys());
    for (const autoShape of foundAutoShapes) {
      await this.createShapeInfo(shapeBar, autoShape, map.get(autoShape));
    }
    for (const autoShape of this.shapeLibrary.filter(
      (s) => !foundAutoShapes.includes(s)
    )) {
      await this.createShapeInfo(shapeBar, autoShape, []);
    }
    this.createAddNewShapeButton(shapeBar);
  }

  public static async initDocumentsImages(): Promise<void> {
    const documentsWrapper = document.getElementById("documentsWrapper");
    documentsWrapper.innerHTML = "";

    this.documentImages = [];
    for (const [index, svgDocument] of this.documents.entries()) {
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
      img.addEventListener("click", (e) => {
        this._documentImageClicked(img.id, e);
      });
      img.addEventListener("mousemove", (e) => {
        this._documentImageHover(img.id, e);
      });
      img.addEventListener(
        "contextmenu",
        (e) => {
          e.preventDefault();
          this._documentImageRightClicked(img.id, e);
          return false;
        },
        false
      );
    }
    this.jsonsThatNeedRedrawing = new Set(this.documents);
    //console.log("drawing documents");
    await this.redrawDocuments();
  }

  private static _documentImageRightClicked(id: string, e: MouseEvent): void {
    const shapes = this._getShapesFromDocumentEvent(id, e);
    const lvl2 = shapes.find((s) => !(s instanceof PathShape));
    if (lvl2) {
      const index = parseInt(id.split("document")[1]);
      const document = this.documents[index];
      this.jsonsThatNeedRedrawing.add(document);
      this.deleteMultiRepresentation(lvl2 as ShapeRepresentation);
      this.redrawDocuments();
    }
  }

  private static _documentImageHover(id: string, e: MouseEvent): void {
    if (this.deleteDocumentsMode) {
      document.getElementById(id).style.cursor = "not-allowed";
    } else {
      const shapes = this._getShapesFromDocumentEvent(id, e);
      if (shapes.length > 0) {
        document.getElementById(id).style.cursor = "pointer";
      } else {
        document.getElementById(id).style.cursor = "auto";
      }
    }
  }

  private static _documentImageClicked(id: string, e: MouseEvent): void {
    const index = parseInt(id.split("document")[1]);
    const document = this.documents[index];
    if (this.deleteDocumentsMode) {
      this.documents.splice(this.documents.indexOf(document), 1);
      this.redrawShapeMenu();
      this.initDocumentsImages();
    } else {
      const shapes = this._getShapesFromDocumentEvent(id, e);
      if (shapes.length > 0 || this.currentMultiRepresentation) {
        const lvl1 = shapes.find((s) => s instanceof PathShape);
        this.jsonsThatNeedRedrawing.add(document);
        if (lvl1) {
          this.changeType(lvl1 as PathShape);
        } else {
          if (
            this.currentMultiRepresentation &&
            this.currentMultiRepresentation.pathShapes.length < 2
          ) {
            this.deleteMultiRepresentation(this.currentMultiRepresentation);
          }
          this.currentMultiRepresentation = null;
          this.redrawDocuments();
        }
      } else {
        SVGCommandView.initialize(document);
      }
    }
  }

  private static _getShapesFromDocumentEvent(
    htmlElementId: string,
    e: MouseEvent
  ): (PathShape | ShapeRepresentation)[] {
    const index = parseInt(htmlElementId.split("document")[1]);
    const json = this.documents[index];
    const pixelSpaceSegmentOutlinesMap =
      this.pixelSpaceSegmentOutlines.get(json);
    const polygons = Array.from(pixelSpaceSegmentOutlinesMap.keys());
    const clickPoint = new Vector2(e.offsetX, e.offsetY);
    const clicked = polygons.filter((p) =>
      pointInPolygon([clickPoint.x, clickPoint.y], p.map((v) => [v.x, v.y]))
    );
    const indices = clicked.map((c) => polygons.indexOf(c));
    const clickedLineStrips = indices.map((i) => polygons[i]);
    clickedLineStrips.sort(
      (a, b) => new AABB2D(a).getArea() - new AABB2D(b).getArea()
    );
    const clickedShapes = clickedLineStrips.map((l) =>
      pixelSpaceSegmentOutlinesMap.get(l)
    );
    return clickedShapes;
  }

  public static deleteMultiRepresentation(rep: ShapeRepresentation): void {
    rep.pathShapes.forEach((shape) => {
      const idx = shape.representations.indexOf(rep);
      shape.representations.splice(idx, 1);
    });
    this.redrawDocuments();
  }

  public static changeType(shape: PathShape): void {
    if (this.selectedShapeIndex === -1) {
      return;
    }
    const selected = this.shapeLibrary[this.selectedShapeIndex];
    if (!(selected.level === 2)) {
      if (shape.representations.some((r) => r.autoShape === selected)) {
        const idx = shape.representations.findIndex(
          (r) => r.autoShape === selected
        );
        shape.representations.splice(idx, 1);
      } else {
        shape.representations.push({
          autoShape: selected,
          pathShapes: [shape],
          automaticallyDetermined: false,
          parameters: [],
        });
        selected.exampleShape = [shape];
        selected.previewIcon = null;
      }
    } else {
      if (
        !this.currentMultiRepresentation ||
        this.shapeToJson.get(shape) !==
          this.shapeToJson.get(this.currentMultiRepresentation.pathShapes[0])
      ) {
        const rep: ShapeRepresentation = {
          autoShape: selected,
          pathShapes: [shape],
          automaticallyDetermined: false,
          parameters: [],
        };
        shape.representations.push(rep);
        this.currentMultiRepresentation = rep;
        selected.exampleShape = [shape];
        selected.previewIcon = null;
      } else {
        shape.representations.push(this.currentMultiRepresentation);
        this.currentMultiRepresentation.pathShapes.push(shape);
        selected.exampleShape = [...this.currentMultiRepresentation.pathShapes];
        selected.previewIcon = null;
      }
    }
    this.redrawShapeMenu();
    this.redrawDocuments();
  }

  public static createDummyParameters(amount: number): object {
    const obj = {};
    for (let i = 0; i < amount; i++) {
      obj["dummyParameter" + i] = 0;
    }
    return obj;
  }

  public static async redrawDocuments(): Promise<void> {
    let i = 0;
    for (const document of this.jsonsThatNeedRedrawing) {
      const index = this.documents.indexOf(document);
      const svg = this.generateSvgForDocument(document);
      const svgUrl = this.svgXmlToDataUrl(svg);
      const pngUrl = await this.svgUrlToPng(svgUrl, document.name);
      const img = this.documentImages[index];
      img.src = pngUrl;
      i++;
      //console.log("drawing jsons: " + (100*i/this.jsonsThatNeedRedrawing.size).toFixed(2) + "%");
    }
    this.jsonsThatNeedRedrawing.clear();
  }

  public static async createShapeInfo(
    wrapper: HTMLDivElement,
    autoShape: AutoShape,
    occurences: PathShape[][]
  ): Promise<void> {
    const shapeDiv = document.createElement("div");
    shapeDiv.style.height = "100px";
    shapeDiv.style.width = "100px";
    shapeDiv.style.display = "inline-block";
    shapeDiv.style.verticalAlign = "top";
    const shapeInfo = document.createElement("p");
    shapeInfo.style.fontSize = "10pt";
    shapeInfo.innerText = autoShape.shapeName + ": " + occurences.length;
    const shapeImg = document.createElement("img");
    shapeImg.style.height = "80px";
    shapeImg.style.width = "80px";
    if (autoShape.exampleShape) {
      shapeImg.src = await autoShape.getIconAsPngUrl();
    } else if (occurences.length > 0) {
      shapeImg.src = await this.iconUrlFromPathShapes(occurences[0]);
    } else {
      shapeImg.src = "/resources/images/other.png";
    }

    this.shapeImages[autoShape.shapeName] = shapeImg.src;

    const index = this.shapeLibrary.indexOf(autoShape);
    //console.log("index", index);
    //console.log("selectedShapeIndex", this.selectedShapeIndex);
    if (index === this.selectedShapeIndex) {
      const color = this.getColor(index, this.shapeLibrary.length);
      const cssFilters = ColorToCssSolver.colorToCssFilter(color);
      shapeImg.style.cssText += cssFilters;
    }
    shapeDiv.appendChild(shapeImg);
    shapeDiv.appendChild(shapeInfo);
    shapeDiv.addEventListener("click", (e) => {
      this.selectShape(index);
    });
    shapeDiv.addEventListener(
      "contextmenu",
      (e) => {
        e.preventDefault();
        this.deleteShapeType(index);
        return false;
      },
      false
    );
    shapeDiv.style.cursor = "pointer";
    wrapper.appendChild(shapeDiv);
  }

  public static deleteShapeType(index: number) {
    const occurences = this.getShapeOccurences();
    const autoShape = this.shapeLibrary[index];
    const examples = occurences.get(autoShape);
    examples.forEach((example) => {
      example.forEach((shape) => {
        const idx = shape.representations.findIndex(
          (r) => r.autoShape === autoShape
        );
        shape.representations.splice(idx, 1);
      });
    });
    this.shapeLibrary.splice(this.shapeLibrary.indexOf(autoShape), 1);
    this.redrawShapeMenu();
    this.redrawDocuments();
  }

  public static getColor(index: number, maxIndex: number) {
    if (maxIndex < 2) {
      return "#FF0000";
    }
    function componentToHex(c: number): string {
      var hex = c.toString(16);
      return hex.length == 1 ? "0" + hex : hex;
    }

    function rgbToHex(r: number, g: number, b: number): string {
      return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
    }
    const t = index / (maxIndex - 1);
    const r = Math.round(t < 0.5 ? (0.5 - t) * 2 * 255 : 0);
    const g = Math.round((0.5 - Math.abs(0.5 - t)) * 2 * 255);
    const b = Math.round(t > 0.5 ? (t - 0.5) * 2 * 255 : 0);
    const hex = rgbToHex(r, g, b);
    return hex;
  }

  public static async iconUrlFromPathShapes(
    shapes: PathShape[]
  ): Promise<string> {
    const linestrips = flatten(shapes.map((s) => s.getLineStrips()));
    if (linestrips) {
      const { svgXml } = SvgToImage.getDebugSvgXmlFromSegments(linestrips, [
        "black",
      ]);
      const svgUrl = this.svgXmlToDataUrl(svgXml);
      const pngUrl = await this.svgUrlToPng(svgUrl, "");
      return pngUrl;
    } else {
      return "/resources/images/other.png";
    }
  }

  public static createAddNewShapeButton(wrapper: HTMLDivElement): void {
    const shapeDiv = document.createElement("div");
    shapeDiv.style.height = "100px";
    shapeDiv.style.width = "100px";
    shapeDiv.style.display = "inline-block";
    shapeDiv.style.verticalAlign = "top";
    const shapeInfo = document.createElement("p");
    shapeInfo.style.fontSize = "10pt";
    shapeInfo.style.wordBreak = "break-word";
    shapeInfo.style.paddingRight = "5px";
    shapeInfo.innerText = "add new shape";
    const shapeImg = document.createElement("img");
    shapeImg.style.height = "80px";
    shapeImg.style.width = "80px";
    shapeImg.src = "/img/add new shape.png";
    shapeDiv.appendChild(shapeImg);
    shapeDiv.appendChild(shapeInfo);
    shapeDiv.addEventListener("click", (e) => {
      this.openNewShapeMenu();
    });
    shapeDiv.style.cursor = "pointer";
    wrapper.appendChild(shapeDiv);
  }

  public static endDeleteDocumentsMode(): void {
    this.deleteDocumentsMode = false;
    document.getElementById("deleteDocumentsButton").innerText =
      "Delete documents mode";
  }

  public static async selectShape(index: number) {
    this.endDeleteDocumentsMode();

    const detailsButton = document.getElementById("shapeDetailsButton");

    this.requestRedrawForShape(this.shapeLibrary[this.selectedShapeIndex]);
    if (index === -2) {
      this.openNewShapeMenu();
      detailsButton.style.visibility = "hidden";
    } else {
      this.selectedShapeIndex = this.selectedShapeIndex === index ? -1 : index;
      detailsButton.style.visibility =
        this.selectedShapeIndex === -1 ? "hidden" : "visible";
      this.redrawShapeMenu();
      this.requestRedrawForShape(this.shapeLibrary[index]);
      await this.redrawDocuments();
    }
  }

  public static requestRedrawForShape(autoShape: AutoShape): void {
    if (autoShape) {
      for (const doc of this.documents) {
        for (const rep of flatten(
          doc.pathShapes.map((p) => p.representations)
        )) {
          if (rep.autoShape === autoShape) {
            this.jsonsThatNeedRedrawing.add(doc);
          }
        }
      }
    }
  }

  public static openNewShapeMenu(): void {
    this.endDeleteDocumentsMode();
    const newShapeWrapper = document.createElement("div");
    newShapeWrapper.style.width = "100%";
    newShapeWrapper.style.top = "0";
    newShapeWrapper.style.height = "100%";
    newShapeWrapper.style.zIndex = "20000";
    newShapeWrapper.style.position = "absolute";
    newShapeWrapper.style.backgroundColor = "rgba(100, 100, 100, 0.3)";
    newShapeWrapper.id = "newShapeWrapper";
    document.body.append(newShapeWrapper);

    const newShapeMenu = document.createElement("div");
    newShapeMenu.style.width = "30%";
    newShapeMenu.style.height = "30%";
    newShapeMenu.style.backgroundColor = "white";
    newShapeMenu.style.zIndex = "20001";
    newShapeMenu.style.borderRadius = "10px";
    newShapeMenu.style.padding = "20px";
    newShapeMenu.style.margin = "auto";
    newShapeMenu.style.top = "35%";
    newShapeWrapper.append(newShapeMenu);

    const headline = document.createElement("h1");
    headline.innerHTML = "add new shape";
    newShapeMenu.append(headline);

    const nameInput = document.createElement("input");
    nameInput.placeholder = "name";
    nameInput.id = "nameInput";

    const parametersInput = document.createElement("input");
    parametersInput.placeholder = "number of parameters";
    parametersInput.id = "parametersInput";

    const containsMultipleCheckbox = document.createElement("input");
    containsMultipleCheckbox.type = "checkbox";
    containsMultipleCheckbox.id = "containsMultipleCheckbox";
    containsMultipleCheckbox.name = "containsMultipleCheckbox";
    const containsMultipleLabel = document.createElement("label");
    containsMultipleLabel.innerText = "contains multiple shapes";
    containsMultipleLabel.htmlFor = "containsMultipleCheckbox";

    newShapeMenu.append(nameInput);
    newShapeMenu.append(document.createElement("br"));

    newShapeMenu.append(parametersInput);
    newShapeMenu.append(document.createElement("br"));

    newShapeMenu.append(containsMultipleCheckbox);
    newShapeMenu.append(containsMultipleLabel);
    newShapeMenu.append(document.createElement("br"));

    const cancelButton = document.createElement("button");
    cancelButton.innerHTML = "cancel";
    newShapeMenu.append(cancelButton);
    cancelButton.addEventListener("click", (e) => {
      this.closeNewShapeMenu();
    });

    const okButton = document.createElement("button");
    okButton.innerHTML = "ok";
    newShapeMenu.append(okButton);
    okButton.addEventListener("click", (e) => {
      if (
        nameInput.value !== "" &&
        parametersInput.value !== "" &&
        !isNaN(parseInt(parametersInput.value))
      ) {
        this.createNewShape(
          nameInput.value,
          parseInt(parametersInput.value),
          containsMultipleCheckbox.checked
        );
      }
    });
  }

  public static createNewShape(
    name: string,
    numberOfParameters: number,
    containsMultiple: boolean
  ) {
    const newAutoShape = new AutoShape(
      name,
      [],
      null,
      [],
      [],
      [],
      [],
      numberOfParameters,
      containsMultiple ? 2 : 1
    );
    this.shapeLibrary.push(newAutoShape);
    const index = this.shapeLibrary.indexOf(newAutoShape);
    this.selectShape(index);
    document.getElementById("newShapeWrapper").remove();
  }

  public static closeNewShapeMenu() {
    document.getElementById("newShapeWrapper").remove();
  }

  public static async startToolsetGeneration() {
    ResultDisplay.open(this.documents, this.shapeLibrary);
    document.getElementById("analysisResultsWrapper").remove();
  }

  public static getShapeOccurences(): Map<AutoShape, PathShape[][]> {
    const map = new Map<AutoShape, PathShape[][]>();
    this.documents.forEach((j) => {
      j.pathShapes.forEach((s) => {
        s.representations.forEach((r) => {
          if (map.has(r.autoShape)) {
            map.get(r.autoShape).push(r.pathShapes);
          } else {
            map.set(r.autoShape, [r.pathShapes]);
          }
        });
      });
    });
    return map;
  }

  public static svgXmlToDataUrl(svgXml: string): string {
    return `data:image/svg+xml;base64,${btoa(svgXml)}`;
  }

  public static async svgUrlToPng(svgUrl: string, id: string): Promise<string> {
    const svgImage = document.createElement("img");
    svgImage.id = id;
    document.body.appendChild(svgImage);
    return new Promise(function (resolve) {
      svgImage.onload = function () {
        const canvas = document.createElement("canvas");
        // canvas.width = svgImage.clientWidth;
        // canvas.height = svgImage.clientHeight;
        canvas.width = size;
        canvas.height = size;
        const canvasCtx = canvas.getContext("2d");
        canvasCtx.drawImage(svgImage, 0, 0);
        const imgData = canvas.toDataURL("image/png");
        //document.body.removeChild(svgImage);
        resolve(imgData);
        svgImage.remove();
      };
      svgImage.src = svgUrl;
    });
  }

  private static generateSvgForDocument(document: SvgDocument): string {
    const segments: Vector2[][] = [];
    const colors: string[] = [];
    const drawnShapes: (PathShape | ShapeRepresentation)[] = [];
    const strokeWidths: number[] = [];
    document.pathShapes.forEach((shape) => {
      const linestrips = shape.getLineStrips();
      if (linestrips) {
        const autoShapes = Array.from(
          shape.representations.filter((r) => r.pathShapes.length === 1)
        );
        const autoShapeIndices = autoShapes.map((r) =>
          this.shapeLibrary.indexOf(r.autoShape)
        );
        const isSelected = autoShapeIndices.includes(this.selectedShapeIndex);
        const color = isSelected
          ? this.getColor(this.selectedShapeIndex, this.shapeLibrary.length)
          : "black";
        linestrips.forEach((strip) => {
          segments.push(strip);
          drawnShapes.push(shape);
          colors.push(color);
          strokeWidths.push(defaultStrokeWidth);
        });
      }
    });
    const allRepresentations = uniq(
      flatten(document.pathShapes.map((s) => s.representations))
    );
    const multiRepresentations = allRepresentations.filter(
      (r) => r.pathShapes.length > 1
    );
    multiRepresentations.forEach((rep) => {
      const shapeTypeIndex = this.shapeLibrary.findIndex(
        (shape) => rep.autoShape === shape
      );
      const typeIsSelected = shapeTypeIndex === this.selectedShapeIndex;
      const shapeIsSelected = this.currentMultiRepresentation === rep;
      if (typeIsSelected) {
        const aabb = this.multiRepresentationToAABB(rep);
        const linestrip = this.aabbToLineStrip(aabb);
        if (linestrip) {
          const segment = linestrip;
          const color = this.getColor(shapeTypeIndex, this.shapeLibrary.length);
          segments.push(segment);
          colors.push(color);
          drawnShapes.push(rep);
          strokeWidths.push(
            shapeIsSelected ? defaultStrokeWidth : defaultStrokeWidth / 3
          );
        }
      }
    });
    const { svgXml, pixelSpaceSegmentOutlines } =
      SvgToImage.getDebugSvgXmlFromSegments(segments, colors, strokeWidths);
    const pixelSpaceSegmentOutlinesMap = new Map<
      LineStrip,
      PathShape | ShapeRepresentation
    >();
    this.pixelSpaceSegmentOutlines.set(document, pixelSpaceSegmentOutlinesMap);
    pixelSpaceSegmentOutlines.forEach((outline, index) => {
      pixelSpaceSegmentOutlinesMap.set(outline, drawnShapes[index]);
    });
    return svgXml;
  }

  public static multiRepresentationToAABB(
    rep: ShapeRepresentation
  ): AABB2D | null {
    // temporarily create the parametrizedShape with its children
    const shapes = rep.pathShapes;
    const aabbs = shapes.map((s) => s.getAABB());
    const aabb = aabbs[0];
    for (const ab of aabbs) {
      aabb.addAABB2D(ab);
    }
    return aabb;
  }

  public static aabbToLineStrip(aabb: AABB2D): Vector2[] {
    const strip = [
      new Vector2(aabb.minX, aabb.minY),
      new Vector2(aabb.minX, aabb.maxY),
      new Vector2(aabb.maxX, aabb.maxY),
      new Vector2(aabb.maxX, aabb.minY),
      new Vector2(aabb.minX, aabb.minY),
    ];
    return strip;
  }
}

(window as any).AnalysisView = AnalysisView;
