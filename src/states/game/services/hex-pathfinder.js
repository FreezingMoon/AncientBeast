export default class {
    constructor(mapWidth, mapHeight, hexWidth, hexHeight, offsetWidth = 0, offsetHeight = 0, rotated = false){

        this.width = mapWidth;
        this.height = mapHeight;

        this.hexWidth = hexWidth;
        this.hexHeight = hexHeight;

        this.offsetWidth = offsetWidth;
        this.offsetHeight = offsetHeight;

        this.rotated = rotated;

        this.hexes = [];
    }


}