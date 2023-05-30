import AbstractSubsetGenerator from "./AbstractSubsetGenerator";

export default class PowersetSubsetGenerator<DataType> extends AbstractSubsetGenerator<DataType> {
    private lastSubset : number[];

    constructor(set : Set<DataType> | Array<DataType>) {
        super(set);
        
        this.elemArray = Array.from(set);
        this.lastSubset = [];
    }

    private nextSubsetSize() {
        let newSize = this.lastSubset.length + 1;
        this.lastSubset = Array.from(Array(newSize).keys());
        return this.lastSubset;
    }


    next(): DataType[] {
        if(this.lastSubset.length == this.elemArray.length) return null;

        
        for (let i = this.lastSubset.length - 1; i >= 0; i--)  {
            let currElem = this.lastSubset[i];
            let nextElem;
            if (i == this.lastSubset.length - 1) nextElem = this.elemArray.length;
            else nextElem = this.lastSubset[i + 1];

            if (currElem + 1 < nextElem) {
                
                this.lastSubset[i]++; //advance the current element

                let elementValue = this.lastSubset[i] + 1;
                //move all the elements after back to right behind the current element
                for(let j = i + 1; j < this.lastSubset.length; j++) { 
                    this.lastSubset[j] = elementValue;
                    elementValue++;
                }
                return this.lastSubset.map(i => this.elemArray[i]);
            };
        }

        return this.nextSubsetSize().map(i => this.elemArray[i]);
    }
}