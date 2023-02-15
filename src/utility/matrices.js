export const diagonalup = [
	[0, 0, 0, 0, 1], // Origin line
	[0, 0, 0, 0, 1],
	[0, 0, 0, 1, 0],
	[0, 0, 0, 1, 0],
	[0, 0, 1, 0, 0],
	[0, 0, 1, 0, 0],
	[0, 1, 0, 0, 0],
	[0, 1, 0, 0, 0],
	[1, 0, 0, 0, 0],
];

diagonalup.origin = [4, 0];

export const diagonaldown = [
	[1, 0, 0, 0, 0], // Origin line
	[0, 1, 0, 0, 0],
	[0, 1, 0, 0, 0],
	[0, 0, 1, 0, 0],
	[0, 0, 1, 0, 0],
	[0, 0, 0, 1, 0],
	[0, 0, 0, 1, 0],
	[0, 0, 0, 0, 1],
	[0, 0, 0, 0, 1],
];

diagonaldown.origin = [0, 0];

export const straitrow = [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]]; // Origin line
straitrow.origin = [0, 0];

export const bellowrow = [
	[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Origin line
	[0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

bellowrow.origin = [0, 0];

export const frontnback2hex = [
	[0, 0, 0, 0],
	[0, 1, 0, 1],
	[1, 0, 0, 1], // Origin line
	[0, 1, 0, 1],
];

frontnback2hex.origin = [2, 2];

export const frontnback3hex = [
	[0, 0, 0, 0, 0],
	[0, 1, 0, 0, 1],
	[1, 0, 0, 0, 1], // Origin line
	[0, 1, 0, 0, 1],
];

frontnback3hex.origin = [3, 2];

export const front2hex = [
	[0, 0, 0, 0],
	[0, 0, 0, 1],
	[0, 0, 0, 1], // Origin line
	[0, 0, 0, 1],
];

front2hex.origin = [2, 2];

export const back2hex = [
	[0, 0, 0, 0],
	[0, 1, 0, 0],
	[1, 0, 0, 0], // Origin line
	[0, 1, 0, 0],
];

back2hex.origin = [2, 2];

export const inlinefront2hex = [
	[0, 0, 0, 0],
	[0, 0, 0, 0],
	[0, 0, 0, 1], // Origin line
	[0, 0, 0, 0],
];

inlinefront2hex.origin = [2, 2];

export const inlineback2hex = [
	[0, 0, 0, 0],
	[0, 0, 0, 0],
	[1, 0, 0, 0], // Origin line
	[0, 0, 0, 0],
];

inlineback2hex.origin = [2, 2];

export const inlinefrontnback2hex = [
	[0, 0, 0, 0],
	[0, 0, 0, 0],
	[1, 0, 0, 1], // Origin line
	[0, 0, 0, 0],
];

inlinefrontnback2hex.origin = [2, 2];

export const front1hex = [
	[0, 0, 0],
	[0, 0, 1],
	[0, 0, 1], // Origin line
	[0, 0, 1],
];

front1hex.origin = [1, 2];

export const backtop1hex = [
	[0, 0, 0],
	[0, 1, 0],
	[0, 0, 0], // Origin line
	[0, 0, 0],
];

backtop1hex.origin = [1, 2];

export const inlineback1hex = [
	[0, 0, 0],
	[0, 0, 0],
	[1, 0, 0], // Origin line
	[0, 0, 0],
];

inlineback1hex.origin = [1, 2];

export const backbottom1hex = [
	[0, 0, 0],
	[0, 0, 0],
	[0, 0, 0], // Origin line
	[0, 1, 0],
];

backbottom1hex.origin = [1, 2];

export const fronttop1hex = [
	[0, 0, 0],
	[0, 0, 1],
	[0, 0, 0], // Origin line
	[0, 0, 0],
];

fronttop1hex.origin = [1, 2];

export const inlinefront1hex = [
	[0, 0, 0],
	[0, 0, 0],
	[0, 0, 1], // Origin line
	[0, 0, 0],
];

inlinefront1hex.origin = [1, 2];

export const frontbottom1hex = [
	[0, 0, 0],
	[0, 0, 0],
	[0, 0, 0], // Origin line
	[0, 0, 1],
];

frontbottom1hex.origin = [1, 2];

export const headlessBoomerang = [
	[0, 0, 0, 0, 0],
	[0, 1, 1, 1, 1],
	[0, 1, 1, 1, 1], //origin line
	[0, 1, 1, 1, 1],
];

headlessBoomerang.origin = [0, 2];

export const headlessBoomerangUpgraded = [
	[0, 0, 0, 0, 0, 0],
	[0, 1, 1, 1, 1, 1],
	[0, 1, 1, 1, 1, 1], //origin line
	[0, 1, 1, 1, 1, 1],
];

headlessBoomerangUpgraded.origin = [0, 2];

export const fourDistanceCone = [
	[0, 0, 1, 0, 0],
	[0, 0, 1, 1, 0],
	[0, 1, 1, 1, 0],
	[0, 1, 1, 1, 1],
	[0, 1, 1, 1, 1], // Origin line
	[0, 1, 1, 1, 1],
	[0, 1, 1, 1, 0],
	[0, 0, 1, 1, 0],
	[0, 0, 1, 0, 0],
];

fourDistanceCone.origin = [0, 4];
