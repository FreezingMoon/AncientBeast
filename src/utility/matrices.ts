type MatrixOrigin = [number, number];
type Matrix = number[][];
export type AugmentedMatrix = number[][] & { origin: MatrixOrigin };

const asAugmentedMatrix = (m: Matrix, origin: [number, number]) => {
	(m as any).origin = origin;
	return m as AugmentedMatrix;
};

export const diagonalup: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0, 0, 1], // Origin line
		[0, 0, 0, 0, 1],
		[0, 0, 0, 1, 0],
		[0, 0, 0, 1, 0],
		[0, 0, 1, 0, 0],
		[0, 0, 1, 0, 0],
		[0, 1, 0, 0, 0],
		[0, 1, 0, 0, 0],
		[1, 0, 0, 0, 0],
	],
	[4, 0],
);

export const diagonaldown: AugmentedMatrix = asAugmentedMatrix(
	[
		[1, 0, 0, 0, 0], // Origin line
		[0, 1, 0, 0, 0],
		[0, 1, 0, 0, 0],
		[0, 0, 1, 0, 0],
		[0, 0, 1, 0, 0],
		[0, 0, 0, 1, 0],
		[0, 0, 0, 1, 0],
		[0, 0, 0, 0, 1],
		[0, 0, 0, 0, 1],
	],
	[0, 0],
);

export const straitrow: AugmentedMatrix = asAugmentedMatrix(
	[
		[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], // Origin line
	],
	[0, 0],
);

export const bellowrow: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Origin line
		[0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
	],
	[0, 0],
);

export const frontnback2hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0, 0],
		[0, 1, 0, 1],
		[1, 0, 0, 1], // Origin line
		[0, 1, 0, 1],
	],
	[2, 2],
);

export const frontnback3hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0, 0, 0],
		[0, 1, 0, 0, 1],
		[1, 0, 0, 0, 1], // Origin line
		[0, 1, 0, 0, 1],
	],
	[3, 2],
);

export const front2hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0, 0],
		[0, 0, 0, 1],
		[0, 0, 0, 1], // Origin line
		[0, 0, 0, 1],
	],
	[2, 2],
);

export const back2hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0, 0],
		[0, 1, 0, 0],
		[1, 0, 0, 0], // Origin line
		[0, 1, 0, 0],
	],
	[2, 2],
);

export const inlinefront2hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 1], // Origin line
		[0, 0, 0, 0],
	],
	[2, 2],
);

export const inlineback2hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[1, 0, 0, 0], // Origin line
		[0, 0, 0, 0],
	],
	[2, 2],
);

export const inlinefrontnback2hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[1, 0, 0, 1], // Origin line
		[0, 0, 0, 0],
	],
	[2, 2],
);

export const front1hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0],
		[0, 0, 1],
		[0, 0, 1], // Origin line
		[0, 0, 1],
	],
	[1, 2],
);

export const backtop1hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0],
		[0, 1, 0],
		[0, 0, 0], // Origin line
		[0, 0, 0],
	],
	[1, 2],
);

export const inlineback1hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0],
		[0, 0, 0],
		[1, 0, 0], // Origin line
		[0, 0, 0],
	],
	[1, 2],
);

export const backbottom1hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0], // Origin line
		[0, 1, 0],
	],
	[1, 2],
);

export const fronttop1hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0],
		[0, 0, 1],
		[0, 0, 0], // Origin line
		[0, 0, 0],
	],
	[1, 2],
);

export const inlinefront1hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 1], // Origin line
		[0, 0, 0],
	],
	[1, 2],
);

export const frontbottom1hex: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0],
		[0, 0, 0],
		[0, 0, 0], // Origin line
		[0, 0, 1],
	],
	[1, 2],
);

export const headlessBoomerang: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0, 0, 0],
		[0, 1, 1, 1, 1],
		[0, 1, 1, 1, 1], //origin line
		[0, 1, 1, 1, 1],
	],
	[0, 2],
);

export const headlessBoomerangUpgraded: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 0, 0, 0, 0],
		[0, 1, 1, 1, 1, 1],
		[0, 1, 1, 1, 1, 1], //origin line
		[0, 1, 1, 1, 1, 1],
	],
	[0, 2],
);

export const fourDistanceCone: AugmentedMatrix = asAugmentedMatrix(
	[
		[0, 0, 1, 0, 0],
		[0, 0, 1, 1, 0],
		[0, 1, 1, 1, 0],
		[0, 1, 1, 1, 1],
		[0, 1, 1, 1, 1], // Origin line
		[0, 1, 1, 1, 1],
		[0, 1, 1, 1, 0],
		[0, 0, 1, 1, 0],
		[0, 0, 1, 0, 0],
	],
	[0, 4],
);
