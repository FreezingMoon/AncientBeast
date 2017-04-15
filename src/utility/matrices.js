//-----------------//
// USEFUL MATRICES //
//-----------------//
var matrices = matrices || {};

matrices.diagonalup = [
    [0, 0, 0, 0, 1], // Origin line
    [0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0]
];

matrices.diagonalup.origin = [4, 0];

matrices.diagonaldown = [
    [1, 0, 0, 0, 0], // Origin line
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1]
];

matrices.diagonaldown.origin = [0, 0];

matrices.straitrow = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
]; // Origin line
matrices.straitrow.origin = [0, 0];


matrices.bellowrow = [
    [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Origin line
    [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

matrices.bellowrow.origin = [0, 0];

matrices.frontnback2hex = [
    [0, 0, 0, 0],
    [0, 1, 0, 1],
    [1, 0, 0, 1], // Origin line
    [0, 1, 0, 1]
];

matrices.frontnback2hex.origin = [2, 2];

matrices.frontnback3hex = [
    [0, 0, 0, 0, 0],
    [0, 1, 0, 0, 1],
    [1, 0, 0, 0, 1], // Origin line
    [0, 1, 0, 0, 1]
];

matrices.frontnback3hex.origin = [3, 2];

matrices.front2hex = [
    [0, 0, 0, 0],
    [0, 0, 0, 1],
    [0, 0, 0, 1], // Origin line
    [0, 0, 0, 1]
];

matrices.front2hex.origin = [2, 2];

matrices.back2hex = [
    [0, 0, 0, 0],
    [0, 1, 0, 0],
    [1, 0, 0, 0], // Origin line
    [0, 1, 0, 0]
];

matrices.back2hex.origin = [2, 2];

matrices.inlinefront2hex = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 1], // Origin line
    [0, 0, 0, 0]
];

matrices.inlinefront2hex.origin = [2, 2];

matrices.inlineback2hex = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [1, 0, 0, 0], // Origin line
    [0, 0, 0, 0]
];

matrices.inlineback2hex.origin = [2, 2];

matrices.inlinefrontnback2hex = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [1, 0, 0, 1], // Origin line
    [0, 0, 0, 0]
];

matrices.inlinefrontnback2hex.origin = [2, 2];

matrices.front1hex = [
    [0, 0, 0],
    [0, 0, 1],
    [0, 0, 1], // Origin line
    [0, 0, 1]
];

matrices.front1hex.origin = [1, 2];

matrices.backtop1hex = [
    [0, 0, 0],
    [0, 1, 0],
    [0, 0, 0], // Origin line
    [0, 0, 0]
];

matrices.backtop1hex.origin = [1, 2];

matrices.inlineback1hex = [
    [0, 0, 0],
    [0, 0, 0],
    [1, 0, 0], // Origin line
    [0, 0, 0]
];

matrices.inlineback1hex.origin = [1, 2];

matrices.backbottom1hex = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0], // Origin line
    [0, 1, 0]
];

matrices.backbottom1hex.origin = [1, 2];

matrices.fronttop1hex = [
    [0, 0, 0],
    [0, 0, 1],
    [0, 0, 0], // Origin line
    [0, 0, 0]
];

matrices.fronttop1hex.origin = [1, 2];

matrices.inlinefront1hex = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 1], // Origin line
    [0, 0, 0]
];

matrices.inlinefront1hex.origin = [1, 2];

matrices.frontbottom1hex = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0], // Origin line
    [0, 0, 1]
];

matrices.frontbottom1hex.origin = [1, 2];


matrices.headlessBoomerang = [
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
    [0, 1, 1, 1, 1], //origin line
    [0, 1, 1, 1, 1]
];

matrices.headlessBoomerang.origin = [0, 2];


matrices.headlessBoomerangUpgraded = [
    [0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1, 1],
    [0, 1, 1, 1, 1, 1], //origin line
    [0, 1, 1, 1, 1, 1]
];


matrices.headlessBoomerangUpgraded.origin = [0, 2];
