export default class PathFinder{

    constructor(unit, grid){

        this.unit = unit;
        this.grid = grid;

        this.generatePaths();
    }

    generatePaths(){

        // copy battle grid, it is used to check if tile is walkable and save paths
        this.pathContainer = [];

        for(var y = 0; y < this.grid.length; y++) {
            this.pathContainer.push(this.grid[y].slice());
        }

        this.fringes = [];
        this.fringes.push({xId:this.unit.xId, yId:this.unit.yId, path:[]});
        this.newFringes = [];
        this.walkableTiles = [];

        for(var dist = 0; dist < this.unit.speed; dist++){
            this.fringes.forEach((fringe)=>{
                this.checkAroundTile(fringe);
            });
            this.fringes = this.newFringes;
            this.newFringes = [];
        }

    }

    checkAroundTile(fringe){

        var tileToCheck;
        var x = fringe.xId;
        var y = fringe.yId;

        if(y%2){
            tileToCheck = [
                {x: x,y: y-1},{x: x+1,y: y-1},
                {x: x-1,y: y},{x: x+1,y: y},
                {x: x,y: y+1},{x: x+1,y: y+1}
            ]
        } else {
            tileToCheck = [
                {x: x-1,y: y-1},{x: x,y: y-1},
                {x: x-1,y: y},  {x: x+1,y: y},
                {x: x-1,y: y+1},{x: x,y: y+1}
            ]
        }

        tileToCheck.forEach((position)=>{

            // check if tiles are empty (including tiles in front for units bigger than one tile)
            for(var i = 0; i < this.unit.size; i++) {
                if (!this.canAddPath(position.x+i, position.y)) {
                    return
                }
            }

            //add this newPath to a path a pathContainer
            var newPath = fringe.path.slice();
            newPath.push(position);

            var node = {
                xId: position.x,
                yId: position.y,
                path: newPath
            };

            // save paths to the local grid copy
            this.pathContainer[position.y][position.x] = newPath;
            this.walkableTiles.push(position);
            this.newFringes.push(node);

        })

    }

    canAddPath(xId, yId){
        // check Y-axis to see if tile exists
        if(yId < 0 || yId > this.pathContainer.length-1){
            return false;
        }

        var row = this.pathContainer[yId];

        // check X-axis to see if tile exists
        if(xId < 0 || xId > row.length-1){
            return false;
        }

        var tile = row[xId];

        if(tile === 0) {
            return true;
        }
    }

    getPath(xId, yId){
        return this.pathContainer[yId][xId];
    }

    getWalkableTiles(){
        return this.walkableTiles;
    }
}
