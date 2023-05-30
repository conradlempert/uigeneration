import { uniqWith } from "lodash";
import AutoShape from "../dataTypes/AutoShape";
import AbstractSubsetGenerator from "./AbstractSubsetGenerator";

export default class BeamSearchSubsetGenerator<DataType> extends AbstractSubsetGenerator<DataType> {
    private results : Map<Array<DataType>, number>;
    private generation;
    private currentElements : DataType[][];

    public beamWidth = 5;


        constructor(set : Set<DataType> | Array<DataType>) {
        super(set);
        
        this.currentElements = [[]];
        this.generation = 0;
        this.results = new Map<Array<DataType>, number>();
    }

    sortInPlace(data: DataType[][]): void {
        data.forEach(element => element.sort((a, b) => {
            return this.elemArray.indexOf(a) - this.elemArray.indexOf(b);
        }));
    }

    deduplicate(data: DataType[][]): DataType[][] {
        return uniqWith(data, (a, b) => { const comp = a.every((val, i) => a[i] === b[i]); /*console.log(comp);*/ return comp;});
    }

    logElements(): void {
        let msg = "%cCurrent elements (" + this.currentElements.length + ")\n%c";
        this.currentElements.forEach(e => {
            e.forEach(data => {
                const autoshapetool = data as unknown as AutoShape;
                msg += autoshapetool.shapeName + " ";
            })
            msg += "\n";
        })
        console.log(msg, 'font-weight: bold', 'font-weight: regular');
    }

    next(): DataType[] {

        if (this.currentElements.length > 0) {
            return this.currentElements.pop();
        } else {
            let parentsForNextGeneration = Array.from(this.results.keys());
            parentsForNextGeneration.sort((a, b) => this.results.get(a) - this.results.get(b));
            parentsForNextGeneration = parentsForNextGeneration.slice(0, this.beamWidth);

            this.currentElements = [];
            this.results.clear();

            parentsForNextGeneration.forEach(parent => {
                this.elemArray.forEach(e => {
                    if(!parent.includes(e)) {
                        this.currentElements.push([...parent, e]);
                    }
                })
            })

            this.sortInPlace(this.currentElements);
            this.currentElements = this.deduplicate(this.currentElements);

            if (++this.generation > this.elemArray.length) {
                return null;
            } else {
                return this.currentElements.pop();
            }
        }
    }

    addResult(subset: DataType[], score: number) {
        this.results.set(subset, score);
    }
}