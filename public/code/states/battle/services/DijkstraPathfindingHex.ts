module battle {

    export class PathFinder{

        grid;
        fringes;
        newFringes;
        gridCopy;

        constructor(public unit: battle.Unit,
                    public xId: number,
                    public yId: number,
                    public speed: number,
                    public size:number) {

            this.grid = unit.state.battleGround;

            this.generatePaths();
        }

        generatePaths(){

            // copy battle grid, it is used to check if tile is walkable and save paths
            this.gridCopy = [];

            for(var y = 0; y < this.grid.length; y++) {
                this.gridCopy.push(this.grid[y].slice());
            }

            this.fringes = [];
            this.fringes.push({xId:this.xId, yId:this.yId, path:[]});
            this.newFringes = [];

            for(var dist = 0; dist < this.speed; dist++){
                this.fringes.forEach((fringe)=>{
                    this.checkAroundTile(fringe);
                });
                this.fringes = this.newFringes;
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
                    {x: x,y: y+1},{x: x+1,y: y+1},
                ]
            } else {
                tileToCheck = [
                    {x: x-1,y: y-1},{x: x,y: y-1},
                    {x: x-1,y: y},  {x: x+1,y: y},
                    {x: x-1,y: y+1},{x: x,y: y+1},
                ]
            }

            tileToCheck.forEach((position)=>{

                // check Y-axis to see if tile exists
                if(position.y < 0 || position.y > this.gridCopy.length-1){
                    return;
                }

                var row = this.gridCopy[position.y];

                // check X-axis to see if tile exists
                if(position.x < 0 || position.x > row.length-1){
                    return;
                }

                // check if we already have a path to that tile
                var path = this.getPath(position.x,position.y);

                if(path){
                    return;
                }

                var tile = row[position.x];

                if(tile === 0){

                    //append this node to a path
                    var newPath:any[] = fringe.path.slice();
                    newPath.push(position);

                    var node = {
                        xId: position.x,
                        yId: position.y,
                        path: newPath
                    };

                    // save paths to the local grid copy
                    this.gridCopy[position.y][position.x] = newPath;
                    this.newFringes.push(node);
                }
            })

        }

        getPath(xId, yId){

        }

    }
}