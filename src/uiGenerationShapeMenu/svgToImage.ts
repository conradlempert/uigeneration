import { Matrix3, Vector2 } from "three";

const size = 300;
const svgRenderPadding = 20;
const strokeWidth = 5;

export default class SvgToImage {

    public static async pointsToImage(points: Vector2[][]): Promise<string> {
        const svgXml = this.getDebugSvgXmlFromSegments(points);
        const svgUrl = this.svgXmlToDataUrl(svgXml);
        const pngUrl = await this.svgUrlToPng(svgUrl);
        return pngUrl;
    }

    public static svgXmlToDataUrl(svgXml: string): string {
        return `data:image/svg+xml;base64,${btoa(svgXml)}`;
    }

    public static async svgUrlToPng(svgUrl: string): Promise<string> {
        const svgImage = document.createElement("img");
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
                document.body.removeChild(svgImage);
                resolve(imgData);
                svgImage.remove();
            };
            svgImage.src = svgUrl;
        });
    }

    public static segmentToPath(segment: Vector2[], matrix: Matrix3, color?: string, strokeWidth?: number): string {
        const transformedPoints = segment.map(s => s.clone().applyMatrix3(matrix));
        
        let styleString = "";
        if(color) {
            styleString += "stroke: " + color + "; ";
        }
        styleString += "stroke-width: " + strokeWidth + "; ";
        const path = "<path type='segmentOutline' d='" + this.serializeLineStripToPath(transformedPoints) + "' style='" + styleString + "'></path>"
        const group = "<g>" + path + "</g>";
        return group;
    }
    
    public static browserProveSvgXml(xml: string): string {
        xml = xml.replace(/xmlns\=\"\"/g, "");
        if(!xml.includes("xmlns")) {
            xml = xml.substring(0, 5) + "xmlns=\"http://www.w3.org/2000/svg\" " + xml.substring(5)
        }
        return xml;
    }

    public static createYFlippedCopy(points: Vector2[]): Vector2[] {
        return points.map(p => p.clone().setY(-p.y));
    }
    
    public static getDebugSvgXmlFromSegments(segments: Vector2[][], colors?: string[], strokeWidths?: number[]): {svgXml: string, pixelSpaceSegmentOutlines: Vector2[][]}
    {
        const svgNode = `<svg version='1.1' x='0px' y='0px' width='${size}px' height='${size}px' viewBox='0 0 ${size} ${size}' xmlns='http://www.w3.org/2000/svg'>`;
        const style = `<style>path[type=\"segmentOutline\"]{stroke:black; stroke-width: ${strokeWidth}; fill: transparent}</style>`
        const matrix = new Matrix3();
        const paths = [];
        if(segments.length > 0) {
            const globalAABB = new AABB2D([]);
            segments = segments.map(s => this.createYFlippedCopy(s));
            segments.forEach(s => globalAABB.addAABB2D(new AABB2D(s)));
        
            const widthIsBigger = globalAABB.getWidth() > globalAABB.getHeight();
            const actualSize = size - svgRenderPadding * 2;
            const scale = widthIsBigger ? actualSize / globalAABB.getWidth() : actualSize / globalAABB.getHeight();
            const translation = widthIsBigger ? new Vector2(-globalAABB.minX*scale + svgRenderPadding, size/2-globalAABB.getCenter().y*scale) : new Vector2(size/2-globalAABB.getCenter().x*scale, -globalAABB.minY*scale + svgRenderPadding);
            matrix.set(
                scale, 0     , translation.x,
                0    , scale , translation.y,
                0    , 0     , 1
            )
        
            segments.forEach((segment, index) => {
                const path = this.segmentToPath(segment, matrix, colors ? colors[index] : undefined);
                paths.push(path);
            })
        }
        
        const xmlString = svgNode + style + paths.join("") + "</svg>";
        const browserProofString = this.browserProveSvgXml(xmlString);
        return {svgXml: browserProofString, pixelSpaceSegmentOutlines: segments.map(points => points.map(p => p.clone().applyMatrix3(matrix)))};
    }
    
    public static serializeLineStripToPath(points: Vector2[]): string {
    
        if (points.length === 0) {
        return "";
        }
        
        const pointValues = points.map(p => p.x + " " + p.y);
        
        let path = "M " + pointValues[0];
        if (pointValues.length > 1) {
        path += " L";
        for (let i = 1; i < pointValues.length; i++) {
            path += " " + pointValues[i];
        }
        }
        path += " Z";
        
        return path;
    }
}

export class AABB2D {
    public minX = Infinity;
    public minY = Infinity;
    public maxX = -Infinity;
    public maxY = -Infinity;

    constructor(points: Vector2[]) {
        for(const point of points) {
            this.minX = Math.min(point.x, this.minX);
            this.maxX = Math.max(point.x, this.maxX);
            this.minY = Math.min(point.y, this.minY);
            this.maxY = Math.max(point.y, this.maxY);
        }
    }

    public addAABB2D(aabb: AABB2D): void {
        this.minX = Math.min(aabb.minX, this.minX);
        this.maxX = Math.max(aabb.maxX, this.maxX);
        this.minY = Math.min(aabb.minY, this.minY);
        this.maxY = Math.max(aabb.maxY, this.maxY);
    }

    public getWidth(): number {
        return this.maxX - this.minX;
    }

    public getHeight(): number {
        return this.maxY - this.minY;
    }

    public getCenter(): Vector2 {
        return new Vector2((this.maxX+this.minX)/2, (this.maxY + this.minY)/2);
    }

    public getArea(): number {
        return this.getHeight() * this.getWidth();
    }

}


