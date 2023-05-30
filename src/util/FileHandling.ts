import * as JsZip from "jszip";
import { DrawingApp } from "../ui/DrawingApp";
import AutoShape, { SerializedAutoShape } from "../dataTypes/AutoShape";
import SvgDocument, { SerializedSvgDocument } from "../dataTypes/SvgDocument";
import AnalysisView from "../ui/AnalysisView";
import DocumentCreator from "../algorithm/DocumentCreator";

export class FileHandling {

    public static initEventHandling() {
      console.log("init event handling!");
          // drag n drop listeners
    (document.querySelector('#uiWrapper') as HTMLDivElement).addEventListener('dragover', event => event.preventDefault());
    (document.querySelector('#uiWrapper') as HTMLDivElement).addEventListener('drop', async event => {
      event.preventDefault();

      let files = Array.from(event.dataTransfer.files);
      if (files.length == 0) return;

      // UNPACK ZIP IF NECESSARY
      if(files[0].name.endsWith('.zip')) {
        const zipFile = files[0];
        const contents = await JsZip.loadAsync(zipFile);
        files = [];
        for(const filename of Object.keys(contents.files)) {
          const blob = await contents.files[filename].async("blob");
          const file = new File([blob], filename);
          files.push(file);
        };
      }
      
      // PUT ALL FILE NAMES + CONTENTS INTO fileMap
      const fileMap = new Map<string, string>(); // Map from file name to file content
      for (const file of files) {
        const content = await FileHandling.readFileAsync(file);
        fileMap.set(file.name, content);
      }

      const firstFileName = Array.from(fileMap.keys())[0];

      // IMPORTING SVGS
      if (firstFileName.endsWith('.svg')) {
        const {documents, autoShapes} = await DocumentCreator.createDocuments(Array.from(fileMap.values()));
        await AnalysisView.initialize(documents);
      }

      // IMPORTING JSONS
      if(firstFileName.endsWith('.json')) {
        console.log("IMPORTING JSONS");
        const jsons: SerializedSvgDocument[] = [];
        let autoShapes: AutoShape[];
        for(const [name, content] of fileMap) {
          if (name.includes(".toolset.json")) {
            DrawingApp.fromJSON(JSON.parse(content) as SerializedAutoShape[]);
            return;
          } else if (name === "shapeHierarchy.json") {
            const autoShapesSerialized: SerializedAutoShape[] = JSON.parse(content);
            autoShapes = autoShapesSerialized.map(a => AutoShape.deserialize(a));
            autoShapes.forEach((a, i) => a.linkSpecializations(autoShapesSerialized[i].specializedBy, autoShapes));
          } else {
            try {
              jsons.push(JSON.parse(content));
            } catch(e) {
              console.warn("broken json, skipping: " + name, e);
            }
          }
        };
        const documents = jsons.map(j => SvgDocument.deserialize(j, autoShapes));
        await AnalysisView.initialize(documents);
      }
    });
    }

    public static assets = ['001-4-string-pickup-ukulele-screw-mount-external-clip.svg', '002-grill-cutout-linear.svg', '003-screw-back-mount-for-Visaton-BF-45-speakerdriver.svg', '004-fretboard-46cm-Baritone-to-be-glue-mounted-hints-saddle-placement.svg', '005-micro-controller-Wemos-D1-miniesp8266-Tesa-power-strip-mount-(edge-asset).svg', '006-led-ring-24rgb-WS2812-internal-plate-screw-mount.svg', '007-speaker-visaton-BF-45-combine-with-grille-assets.svg', '008-mount-for-4-Pin-rocker-switch-Taiss-KCD2-201-BK.svg', '009-grille-eg-for-speakers-target-cutout.svg', '010-micro-usb-socket-akzon-screwmount-for-3dprinted-panel.svg', '011-screw-mount-for-bluetooth-amplifier-Garosa-HF69B.svg', '012-grille-eg-for-speakers-stripe-cutout-and-circle.svg', '013-battery-case18650-battery-single-screw-mount.svg', '014-mount-for-2-Pin-rocker-switch.svg', '015-snare-full-length-screw-mount.svg', '016-Teltow-logo-engraving-cutout.svg', '017-tilted-motor.svg', '018-rubber-band-mount-for-anything-(use-two-at-a-time).svg', '019-mount-generic-below-object-mount.svg', '020-belt-drive-made-from-pulley-and-rubber-band.svg', '021-photo-resistor-mount-creates-holes-insert-before-soldering.svg', '022-Guitar-Tone-Knob-screw-mount.svg', '023-humbucker-pickup-Les-Paul-style-guitar-screw-mount.svg', '024-pinned-guitar-bridge-from-plates.svg', '025-Electric-Guitar-Bridge-Tremolo-Bridge-screw-mount.svg', '026-gear-tuners-for-Guitars-screw-mount-(right-side).svg', '027-Tuning-Pegs-for-Classic-Guitar-screw-mount-(right-side).svg', '028-pinless-guitar-bridge-classical-guitar-glue-mount.svg', '029-Internal-Gear-mechanics-screw-mount-(right-side).svg', '030-mono-jack-output-screw-mount.svg', '031-3-string-Hard-tail-Bridge-screw-top-loading-mount.svg', '032-humbucker-pickup-for-electric-guitar-raised-screw-mount.svg', '033-leather-handlestrap-sterns-screw-mount.svg', '034-speaker-visaton-BF-45-front-screw-mount.svg', '035-driver-W3-1053SC-creates-holes-combine-with-grille-asset.svg', '036-leather-handle-IKEAsterns-screw-mount.svg', '037-USB-C-socket-breakout-board-3d-printed-panel-screw-mount.svg', '038-bluetooth-amplifier-garosa-HF69B-adhesive-mount.svg', '039-screw-Mount-for-ZHITING-Bluetooth-Amplifier-board-(two-channel-stereo).svg', '040-speaker-Visaton-FR-58-screwmount.svg', '041-mount-for-18650-rechargeable-battery-(37V)-Tesa-power-strip.svg', '042-bluetooth-amplifier-dollatek-adhesive-mount.svg', '043-speaker-W3-1053SC-screw-front-mount.svg', '044-5cm-mini-speaker-(2W-8-Ohm-full-range).svg', '045-cutout-Grace-Hopper-Gesamtschule-Teltow-Logo-Star.svg', '046-texture-astronaut-with-cutouts-(part-of-solar-system).svg', '047-modular-desk-organizer-mate-bottle-stand-(ID5e60d226e9f862002d6eebbb)-1.svg', '048-9v-block-battery-mount-with-lasercut-spring.svg', '049-cutout-Kyub-K-logo.svg', '050-motor-mabuchi-RE280-screw-mount-perpendicular.svg', '051-motor-mabuchi-RF-300-parallel-rubber-band-mount.svg', '052-motor-mabuchi-rf-300-screw-mount-perpendicular.svg', '053-motor-mabuchi-RE280-parallel-rubberband-mount.svg', '054-motor-R140-mabuchi-260-parallel-rubber-band-mount.svg', '055-photoresistor-can-be-mounted-after-soldering.svg', '056-breadboard-2-rubberbands-mount.svg', '057-5-position-switch-screw-mount.svg', '058-40-mm-truss-rod-double-action-tight-position-mount.svg', '059-fretboard-ukulele-25cm-Soprano-tuned-to-be-glue-mounted-hints-saddle-placement-(not-tested).svg', '060-adjustable-saddle-guitar-bridge-screw-mount.svg', '061-3-position-switch-screw-mount.svg', '062-3-pole-pickup-M3-screw-mount.svg', '063-Tune-o-Matic-Guitar-Bridge-screw-mount.svg', '064-Tune-o-Matic-Guitar-Tailpiece-screw-mount.svg', '065-strap-lock-screw-mount.svg', '066-led-ring-24-rgb-glue-back-mount-tested-on-4mm-birke(with-inlay).svg', '067-pinned-guitar-bridge-glue-mount.svg', '068-potentiometerRotary-POT-screw-mount.svg', '069-micro-controller-Wemos-D1-miniesp8266-screw-mount-(edge-asset).svg', '070-output-jack-plate-screw-mount.svg', '071-micro-controller-Wemos-D1-mini-proesp8266-hook-plate-mount-(edge-asset).svg', '072-CO2-temperature-sensor-SCD30-screw-back-mount.svg', '073-speaker-W3-1053SC-acoustic-fabric-front-mount-(pressfit).svg', '074-driver-visaton-FR-58-screw-back-mount.svg', '075-step-up-converter-MT3608-adhesive-mount.svg', '076-iPhone11-press-fit-mount.svg', '077-texture-star-with-cutout-(part-of-solar-system).svg', '078-texture-star-with-round-cutout-(part-of-solar-system).svg', '079-texture-moon-with-star-cutouts-(part-of-solar-system).svg', '080-texture-planet-with-crater-cutouts-(part-of-solar-system).svg', '081-Ocean.svg', '082-solar-system-saturn.svg', '083-texture-flower-around-square-cutout.svg', '084-texture-house-with-square-cutout.svg', '085-texture-feather-shaped-cutout.svg', '086-texture-flamingo-over-diamond-shaped-cutout.svg', '087-texture-toucan-over-round-cutout.svg', '088-texture-skater-girl-cutout-over-graffiti-wall.svg', '089-cutout-hexagonal-50-mm.svg', '090-cutout-hole-45-mm.svg', '091-cutout-star-50-mm.svg', '092-cutout-lamp.svg', '093-cutout-square-50x50-mm.svg', '094-cutout-triangular-50-mm.svg', '095-axle-plain-bearing-for-3-mm.svg', '096-motor-L298N-driver-mount-using-screw-mount.svg', '097-photoresistor-sliding-mount-works-for-presoldered-parts.svg', '098-18-fret-board-32-cm-long-glue-mount.svg', '099-22-plate-straight-fret-board-glue-mount.svg', '100-guitar-mechanic-for-western-steel-string-guitar.svg'];

    public static async loadXHR(url: string, blob: boolean = false): Promise<XMLHttpRequest> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("GET", url);
            if (blob) {
            xhr.responseType = "blob";
            }
            xhr.onload = () => {
            if (xhr.status === 200) {
                resolve(xhr);
            } else {
                console.log(xhr.status);
                reject();
            }
            };
            xhr.send();
        });
    }

    public static async loadFile(filePath: string): Promise<string> {
        const path = "resources/" + filePath;
        if (typeof window !== "undefined") {
            const xhr = await this.loadXHR(path);
            return xhr.responseText;
        } else {
            const { readFileSync } = await import("fs-extra");
            return readFileSync(path, { encoding: "utf8" });
        }
    }

    public static readFileAsync(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
        
            reader.onload = () => {
                resolve(String(reader.result));
            };
        
            reader.onerror = reject;
        
            reader.readAsText(file);
        })
    }

    public static async downloadZip(files: Map<string, Blob>, zipName: string): Promise<void> {
        const zip = new JsZip();
        for (const [fileName, blob] of files.entries()) {
          zip.file(fileName, blob);
        }
        const zipBlob = await zip.generateAsync({ type: "blob" });
        this.downloadBlob(zipBlob, zipName);
      }

      public static downloadBlob(blob: Blob, filename: string) {
        const element = document.createElement("a");
        const dataUrl = window.URL.createObjectURL(blob);
        element.setAttribute("href", dataUrl);
        element.setAttribute("download", filename);
    
        element.style.display = "none";
        document.body.appendChild(element);
    
        element.click();
    
        document.body.removeChild(element);
      }

      public static blobForText(text: string): Blob {
        return new Blob([text], {
          type: "text/plain",
        });
      }

}