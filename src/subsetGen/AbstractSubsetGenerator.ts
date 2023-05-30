export default class AbstractSubsetGenerator<DataType> {
    protected elemArray: Array<DataType>;

    constructor(set: Set<DataType> | Array<DataType>) {
        this.elemArray = Array.from(set);
    }
    
    addResult(subset: DataType[], score: number) {}
}