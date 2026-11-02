/**
 * @jest-environment <rootDir>/test/jsdom-environment.ts
 * @jest-environment-options {"resources": "usable"}
 */
import { jest, test, expect } from '@jest/globals';
import { GameSnapshotSerializer, SNAPSHOT_VERSION } from '../engine/GameSnapshot';

jest.setTimeout(120000);

test('snapshot round-trips supported game state', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { Drop } = await import('../drop');
	const { Effect } = await import('../effect');
	const { Trap } = await import('../utility/trap');
	const g1: any = await createGame([]);
	const effect = new Effect(
		'Snapshot effect',
		g1.creatures[0],
		g1.creatures[0],
		'onStartPhase',
		{ alterations: { defense: 2 }, turnLifetime: 3 },
		g1,
	);
	g1.creatures[0].effects.push(effect);
	effect.triggeredThisChain = true;
	const boardDrop = new Drop('Snapshot drop', { offense: 2 }, 7, 0, g1);
	boardDrop.id = 12;
	boardDrop.pickedUp = true;
	g1.dropId = 13;
	new Trap(
		6,
		0,
		'goo-trap',
		[],
		g1.players[1],
		{ turnLifetime: 4, destroyOnActivate: true, ownerCreature: g1.creatures[1] },
		g1,
		'Snapshot trap',
	);
	g1.players[0].plasma = 17;
	g1.players[1].plasma = 23;
	g1.players[0].controller = 'human';
	g1.players[0].score.push({ type: 'deny', creature: g1.creatures[1] });
	g1.turn = 6;
	g1.round = 5;
	g1.bloodCount = 2;
	g1.creatures[0].health = 43;
	g1.creatures[0].oldHealth = 51;
	g1.creatures[0].energy = 29;
	g1.creatures[0].oldEnergy = 40;
	g1.creatures[0].endurance = 13;
	g1.creatures[0].remainingMove = 1;
	g1.creatures[0].movementPool = 0;
	g1.creatures[0].noActionPossible = true;
	g1.creatures[0].status.frozen = true;
	g1.creatures[0]._waitedTurn = g1.creatures[0].turnsActive;
	g1.creatures[0]._hinderedTurn = g1.creatures[0].turnsActive;
	g1.creatures[0]._nextGameTurnActive = 7;
	g1.creatures[0].dropCollection = [{ name: 'Snapshot bonus', alterations: { offense: 3 } }];
	g1.creatures[0].updateAlteration();
	g1.creatures[0].stats.offense = g1.creatures[0].baseStats.offense + 3;
	g1.creatures[0].abilities[0].used = true;
	g1.creatures[0].abilities[0].timesUsed = 2;
	g1.creatures[0].abilities[0].timesUsedThisTurn = 1;
	g1.creatures[0].abilities[0].token = 4;
	g1.creatures[0].abilities[0].triggeredThisChain = true;
	g1.creatures[0].abilities[0]._strikes = { 1: 2, 4: 1 };
	g1.creatures[0].abilities[0]._lastTargetId = 1;
	g1.activeCreature = g1.creatures[1];
	g1.creatures[0]._plasmaFieldActiveTurn = true;
	const snapshot: any = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(g1.serializeSnapshot()),
	);
	expect(snapshot.version).toBe(SNAPSHOT_VERSION);

	const g2: any = await createGame([]);
	g2.soundsys.setEffectsMuted = () => {};
	g2.reconstructFromSnapshot(snapshot);

	const snap2: any = g2.serializeSnapshot();
	delete snapshot.date;
	delete snap2.date;
	expect(JSON.stringify(snap2)).toBe(JSON.stringify(snapshot));
	expect(g2.players[0].plasma).toBe(17);
	expect(g2.players[1].plasma).toBe(23);
	expect(g2.players[0].controller).toBe('human');
	expect(g2.creatures[0]._plasmaFieldActiveTurn).toBe(true);
	expect(g2.turn).toBe(6);
	expect(g2.round).toBe(5);
	expect(g2.bloodCount).toBe(2);
	expect(g2.activeCreature.id).toBe(1);
	expect(g2.players[0].score[1].creature).toBe(g2.creatures[1]);
	expect(g2.players[0].getScore().deny).toBe(-5);
	expect(g2.creatures[0].dropCollection).toEqual([
		{ name: 'Snapshot bonus', alterations: { offense: 3 } },
	]);
	expect(g2.creatures[0].stats.offense).toBe(g1.creatures[0].stats.offense);
	expect(g2.creatures[0].health).toBe(43);
	expect(g2.creatures[0].oldHealth).toBe(51);
	expect(g2.creatures[0].energy).toBe(29);
	expect(g2.creatures[0].oldEnergy).toBe(40);
	expect(g2.creatures[0].endurance).toBe(13);
	expect(g2.creatures[0].remainingMove).toBe(1);
	expect(g2.creatures[0].movementPool).toBe(0);
	expect(g2.creatures[0].noActionPossible).toBe(true);
	expect(g2.creatures[0].status.frozen).toBe(true);
	expect(g2.creatures[0]._waitedTurn).toBe(g1.creatures[0]._waitedTurn);
	expect(g2.creatures[0]._hinderedTurn).toBe(g1.creatures[0]._hinderedTurn);
	expect(g2.creatures[0]._nextGameTurnActive).toBe(7);
	expect(g2.creatures[0].abilities[0]).toMatchObject({
		used: true,
		timesUsed: 2,
		timesUsedThisTurn: 1,
		token: 4,
		triggeredThisChain: true,
		_strikes: { 1: 2, 4: 1 },
		_lastTargetId: 1,
	});

	expect(g2.players[0].creatures).toContain(g2.creatures[0]);
	expect(g2.players[1].creatures).toContain(g2.creatures[1]);
	expect(g2.effects).toHaveLength(1);
	expect(g2.effects[0]).toMatchObject({
		name: 'Snapshot effect',
		trigger: 'onStartPhase',
		turnLifetime: 3,
		triggeredThisChain: true,
		alterations: { defense: 2 },
	});
	expect(g2.creatures[0].effects).toEqual([g2.effects[0]]);
	expect(g2.drops).toHaveLength(1);
	expect(g2.drops[0]).toMatchObject({
		id: 12,
		name: 'Snapshot drop',
		pos: { x: 7, y: 0 },
		alterations: { offense: 2 },
		pickedUp: true,
	});
	expect(g2.traps).toHaveLength(1);
	expect(g2.traps[0]).toMatchObject({
		id: 0,
		name: 'Snapshot trap',
		turnLifetime: 4,
		destroyOnActivate: true,
	});
	expect(g2.traps[0].owner).toBe(g2.players[1]);
	expect(g2.traps[0].ownerCreature).toBe(g2.creatures[1]);

	const sharedConfig = { nested: true };
	const sharedSnapshot = {
		...snapshot,
		configData: { left: sharedConfig, right: sharedConfig },
	};
	const restoredShared = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(sharedSnapshot),
	);
	expect(restoredShared.configData.left).toEqual({ nested: true });
	expect(restoredShared.configData.right).toEqual({ nested: true });

	const legacySnapshot = { ...snapshot, version: SNAPSHOT_VERSION - 1 };
	expect(() =>
		GameSnapshotSerializer.from(GameSnapshotSerializer.stringify(legacySnapshot)),
	).toThrow('cannot guarantee match-faithful restoration');
	expect(() =>
		GameSnapshotSerializer.from(
			GameSnapshotSerializer.stringify({ ...snapshot, version: SNAPSHOT_VERSION + 1 }),
		),
	).toThrow('cannot guarantee match-faithful restoration');

	const differentPoolSnapshot = {
		...snapshot,
		plasmaAmount: 37,
		configData: { ...snapshot.configData, plasma_amount: 50 },
	};
	const startGameLoad = jest.fn();
	g2.gameState = 'initialized';
	g2.startGameLoad = startGameLoad;
	g2.loadSnapshot(GameSnapshotSerializer.stringify(differentPoolSnapshot));
	expect(g2.plasma_amount).toBe(37);
	expect(g2.configData.plasma_amount).toBe(37);
	expect(startGameLoad).toHaveBeenCalledWith(
		expect.objectContaining({ plasma_amount: 37 }),
		undefined,
		undefined,
		expect.any(Function),
	);
});

test('snapshot export refuses unregistered executable effect or trap callbacks', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { Effect } = await import('../effect');
	const { Trap } = await import('../utility/trap');
	const game: any = await createGame([]);
	const effect = new Effect(
		'Runtime callback',
		game.creatures[0],
		game.creatures[0],
		'onStartPhase',
		{ effectFn: () => undefined },
		game,
	);
	expect(() => game.serializeSnapshot()).toThrow('effect callback');
	effect.deleteEffect();

	const trap = new Trap(6, 0, 'callback-trap', [], game.players[0], {}, game);
	trap.onDestroyFn = () => undefined;
	expect(() => game.serializeSnapshot()).toThrow('trap destruction callback');
});

test('loadSnapshot restores per-player plasma through setup', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const source: any = await createGame([]);
	source.players[0].plasma = 17;
	source.players[1].plasma = 23;
	const serialized = GameSnapshotSerializer.stringify(source.serializeSnapshot());

	const restored: any = await createGame([]);
	restored.soundsys.setEffectsMuted = () => {};
	restored.gameState = 'initialized';
	restored.preventSetup = false;
	restored.startGameLoad = (configData: Record<string, unknown>) => {
		Object.assign(restored, configData);
		restored.configData = configData;
		restored.gameState = 'loaded';
		restored.maybeSetup();
	};
	restored.loadSnapshot(serialized);

	expect(restored.players[0].plasma).toBe(17);
	expect(restored.players[1].plasma).toBe(23);
	expect(restored.serializeSnapshot().players.map((player: any) => player.plasma)).toEqual([
		17, 23,
	]);
});

test("snapshot rehydrates Gumble's Gooey Body effect and BRB trap behavior", async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadGumbleAbilities } = await import('../abilities/Gumble');
	const { Effect } = await import('../effect');
	const { Trap } = await import('../utility/trap');
	const game: any = await createGame([loadGumbleAbilities]);
	const gumbleData = game.creatureData.find((creature: any) => creature.name === 'Gumble');
	const gumbleType = gumbleData.type ?? `${gumbleData.realm}${gumbleData.level}`;
	game.players[0].summon(gumbleType, { x: 4, y: 3 });
	const gumble = game.creatures.find((creature: any) => creature?.name === 'Gumble');
	expect(gumble).toBeDefined();
	const gooEffect = new Effect(
		'Gooey Body',
		gumble,
		game.grid.hexAt(4, 3),
		'onStepIn',
		{
			snapshotBehaviorId: 'gumble.gooey-body-effect.v1',
			effectFn: () => undefined,
			requireFn: () => true,
		},
		game,
	);
	expect(gooEffect.snapshotBehaviorId).toBe('gumble.gooey-body-effect.v1');
	expect(game._snapshotEffectBehaviors.has(gooEffect.snapshotBehaviorId)).toBe(true);
	const gooTrap = new Trap(
		4,
		3,
		'gooey-body',
		[gooEffect],
		gumble.player,
		{ ownerCreature: gumble, turnLifetime: -1 },
		game,
	);
	gumble._brbActive = true;
	gumble._brbState = { killer: { player: game.players[1] }, gooTrap };
	gooTrap.snapshotBehaviorId = 'gumble.gooey-body-brb-trap.v1';
	gooTrap.snapshotBehaviorData = { creatureId: gumble.id };
	gooTrap.onDestroyFn = (destroyer) => gumble.onBRBTrapDestroyed(destroyer);

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadGumbleAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredGumble = restoredGame.creatures[gumble.id];
	const restoredTrap = restoredGame.traps.find((trap: any) => trap.id === gooTrap.id);
	const restoredEffect = restoredGame.effects.find((effect: any) => effect.id === gooEffect.id);
	expect(restoredGumble._brbState.gooTrap).toBe(restoredTrap);
	expect(restoredTrap.snapshotBehaviorId).toBe('gumble.gooey-body-brb-trap.v1');
	expect(restoredTrap.onDestroyFn).toEqual(expect.any(Function));
	expect(restoredEffect.snapshotBehaviorId).toBe('gumble.gooey-body-effect.v1');
	expect(restoredEffect.hasCustomCallbacks).toBe(true);
	expect(restoredEffect.target).toBe(restoredGame.hexAt(4, 3));

	const trappedCreature = restoredGame.creatures[1];
	trappedCreature.setPosition(restoredTrap.x, restoredTrap.y);
	restoredEffect.activate(trappedCreature);
	expect(trappedCreature.remainingMove).toBe(0);

	restoredTrap.onDestroyFn();
	expect(restoredGumble._brbState).toBeNull();
	expect(restoredGumble.dead).toBe(true);
});

test('snapshot rehydrates Swampler Natural Habitat bonuses and home hex', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadSwamplerAbilities } = await import('../abilities/Swampler');
	const game: any = await createGame([loadSwamplerAbilities]);
	const swamplerData = game.creatureData.find((creature: any) => creature.name === 'Swampler');
	const swamplerType = swamplerData.type ?? `${swamplerData.realm}${swamplerData.level}`;
	game.players[0].summon(swamplerType, { x: 4, y: 3 });
	const swampler = game.creatures.find((creature: any) => creature?.name === 'Swampler');
	expect(swampler).toBeDefined();
	const homeHex = game.hexAt(4, 3);

	game.abilities[13][0].activate.call({
		creature: swampler,
		isUpgraded: () => true,
	});
	const [homeEffect, leaveEffect] = swampler.effects;
	expect(homeEffect.snapshotBehaviorId).toBe('swampler.natural-habitat-effect.v1');
	expect(leaveEffect.snapshotBehaviorId).toBe('swampler.leave-habitat-effect.v1');
	expect(homeHex._swamplerHomeOwner).toBe(swampler.id);
	const homeStats = { ...swampler.stats };
	leaveEffect.effectFn(leaveEffect, homeHex);
	expect(homeEffect.alterations).toEqual({});

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadSwamplerAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredSwampler = restoredGame.creatures[swampler.id];
	const restoredHomeHex = restoredGame.hexAt(homeHex.x, homeHex.y);
	const restoredHomeEffect = restoredGame.effects.find(
		(effect: any) => effect.id === homeEffect.id,
	);
	const restoredLeaveEffect = restoredGame.effects.find(
		(effect: any) => effect.id === leaveEffect.id,
	);
	expect(restoredHomeHex._swamplerHomeOwner).toBe(restoredSwampler.id);
	expect(restoredHomeEffect.hasCustomCallbacks).toBe(true);
	expect(restoredLeaveEffect.hasCustomCallbacks).toBe(true);

	restoredHomeEffect.effectFn(restoredHomeEffect, restoredHomeHex);
	expect(restoredHomeEffect.alterations).toEqual({ poison: 22, regrowth: 20 });
	expect(restoredSwampler.stats).toEqual(homeStats);
	restoredLeaveEffect.effectFn(restoredLeaveEffect, restoredHomeHex);
	expect(restoredHomeEffect.alterations).toEqual({});
});

test('snapshot rehydrates Contagion spreading and end-phase poison', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadSwamplerAbilities } = await import('../abilities/Swampler');
	const { applyGooContagion } = await import('../abilities/contagion');
	const { Creature } = await import('../creature');
	const game: any = await createGame([loadSwamplerAbilities]);
	const swamplerData = game.creatureData.find((creature: any) => creature.name === 'Swampler');
	const swamplerType = swamplerData.type ?? `${swamplerData.realm}${swamplerData.level}`;
	game.players[0].summon(swamplerType, { x: 7, y: 4 });
	const infected = game.creatures.find((creature: any) => creature?.name === 'Swampler');
	const attacker = infected;
	applyGooContagion(game, infected, attacker, 6, false);
	const infection = infected.effects.find((effect: any) => effect.name === 'Contagion');
	const endPhaseEffect = infected.effects.find(
		(effect: any) => effect.snapshotBehaviorId === 'swampler.contagion-end-phase.v1',
	);
	expect(infection.snapshotBehaviorId).toBe('swampler.contagion-effect.v1');
	expect(endPhaseEffect).toBeDefined();

	infection.effectFn(infection, infected);
	expect(infection.contagious).toBe(true);

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadSwamplerAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredInfected = restoredGame.creatures[infected.id];
	const restoredAttacker = restoredGame.creatures[attacker.id];
	const restoredInfection = restoredGame.effects.find((effect: any) => effect.id === infection.id);
	const restoredEndPhaseEffect = restoredGame.effects.find(
		(effect: any) => effect.id === endPhaseEffect.id,
	);
	expect(restoredInfection.contagionAttacker).toBe(restoredAttacker);
	expect(restoredInfection.contagionDamage).toBe(6);
	expect(restoredInfection.contagious).toBe(true);
	expect(restoredInfection.contagionVisual).toBeDefined();

	const nearbyCreature = new Creature(
		{
			...restoredGame.retrieveCreatureStats(swamplerType),
			x: 2,
			y: 2,
			team: 1,
			temp: false,
			materializationSickness: false,
		},
		restoredGame,
	);
	restoredGame.creatures[nearbyCreature.id] = nearbyCreature;
	restoredInfected.adjacentHexes = () => [{ creature: nearbyCreature }];
	restoredInfection.effectFn(restoredInfection, { creature: nearbyCreature });
	expect(nearbyCreature.effects.some((effect: any) => effect.name === 'Contagion')).toBe(true);

	const healthBeforePoison = restoredInfected.health;
	restoredEndPhaseEffect.effectFn();
	expect(restoredInfected.health).toBeLessThan(healthBeforePoison);
	expect(restoredInfected.effects.some((effect: any) => effect.name === 'Contagion')).toBe(false);
	expect(restoredGame.effects.some((effect: any) => effect.id === restoredEndPhaseEffect.id)).toBe(
		false,
	);
});

test('snapshot rehydrates Infernal scorched-ground damage and owner immunity', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadInfernalAbilities } = await import('../abilities/Infernal');
	const { Creature } = await import('../creature');
	const game: any = await createGame([loadInfernalAbilities]);
	const infernalData = game.creatureData.find((creature: any) => creature.name === 'Infernal');
	const infernalType = infernalData.type ?? `${infernalData.realm}${infernalData.level}`;
	game.players[0].summon(infernalType, { x: 7, y: 4 });
	const infernal = game.creatures.find((creature: any) => creature?.name === 'Infernal');
	const trapHex = game.hexAt(9, 4);
	expect(trapHex).toBeDefined();
	expect(trapHex.creature).toBeUndefined();
	infernal.abilities[0]._addTrap(trapHex);
	const trap = game.traps.find(
		(candidate: any) => candidate.x === trapHex.x && candidate.y === trapHex.y,
	);
	expect(trap).toBeDefined();
	expect(trap.effects[0].snapshotBehaviorId).toBe('infernal.scorched-ground-effect.v1');
	expect(trap.effects[0].snapshotBehaviorData).toEqual({
		attackerId: infernal.id,
		damages: infernal.abilities[0].damages,
	});

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadInfernalAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredInfernal = restoredGame.creatures[infernal.id];
	const restoredTrap = restoredGame.traps.find((candidate: any) => candidate.id === trap.id);
	const restoredEffect = restoredTrap.effects[0];
	expect(restoredEffect.attacker).toBe(restoredInfernal);
	expect(restoredEffect.hasCustomCallbacks).toBe(true);

	const infernalHealth = restoredInfernal.health;
	restoredEffect.trap = restoredTrap;
	expect(restoredEffect.requireFn()).toBe(false);
	expect(restoredInfernal.health).toBe(infernalHealth);

	const enemyData = restoredGame.retrieveCreatureStats('L1');
	const enemy = new Creature(
		{
			...enemyData,
			x: trapHex.x,
			y: trapHex.y,
			team: 1,
			temp: false,
			materializationSickness: false,
		},
		restoredGame,
	);
	restoredGame.creatures[enemy.id] = enemy;
	const enemyHealth = enemy.health;
	expect(restoredEffect.requireFn()).toBe(true);
	restoredEffect.effectFn(restoredEffect, enemy);
	expect(enemy.health).toBeLessThan(enemyHealth);
	expect(restoredGame.traps).not.toContain(restoredTrap);
});

test('snapshot rehydrates Miss Creeper attraction and Tendril Feet upgrade suppression', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadMissCreeperAbilities } = await import('../abilities/Miss-Creeper');
	const { Effect } = await import('../effect');
	const game: any = await createGame([loadMissCreeperAbilities]);
	const creeperData = game.creatureData.find((creature: any) => creature.name === 'Miss Creeper');
	const creeperType = creeperData.type ?? `${creeperData.realm}${creeperData.level}`;
	const lowMentalData = game.creatureData.find((creature: any) => creature.name === 'Swampler');
	const lowMentalType = lowMentalData.type ?? `${lowMentalData.realm}${lowMentalData.level}`;
	game.players[0].summon(creeperType, { x: 4, y: 4 });
	game.players[1].summon(creeperType, { x: 5, y: 4 });
	game.players[1].summon(lowMentalType, { x: 9, y: 4 });
	const creeper = game.creatures.find(
		(creature: any) => creature?.name === 'Miss Creeper' && creature.team === 0,
	);
	const rootedTarget = game.creatures.find(
		(creature: any) => creature?.name === 'Miss Creeper' && creature.team === 1,
	);
	const attractedTarget = game.creatures.find(
		(creature: any) => creature?.name === 'Swampler' && creature.team === 1,
	);
	expect(creeper).toBeDefined();
	expect(rootedTarget).toBeDefined();
	expect(attractedTarget).toBeDefined();
	expect(creeper.abilities[2]._getPullStrength(attractedTarget, creeper)).toBeGreaterThan(0);

	const upgradedTargetAbility = rootedTarget.abilities[2];
	upgradedTargetAbility.setUpgraded();
	upgradedTargetAbility.timesUsed = game.abilityUpgrades;
	expect(upgradedTargetAbility.isUpgraded()).toBe(true);
	const tendrils = new Effect(
		'Tendril Feet',
		creeper,
		rootedTarget,
		'',
		{ turnLifetime: 1, deleteTrigger: 'onEndPhase' },
		game,
	);
	rootedTarget.addEffect(tendrils);
	creeper.abilities[3]._disableAbilityUpgrades(rootedTarget, tendrils);
	const silence = rootedTarget.effects.find(
		(effect: any) => effect.snapshotBehaviorId === 'miss-creeper.tendril-upgrade-silence.v1',
	);
	expect(silence).toBeDefined();
	expect(upgradedTargetAbility.isUpgraded()).toBe(false);

	creeper.abilities[2].end = () => undefined;
	attractedTarget.remainingMove = 0;
	creeper.abilities[2].activate(attractedTarget);
	const attraction = attractedTarget.effects.find(
		(effect: any) => effect.snapshotBehaviorId === 'miss-creeper.fatal-attraction.v1',
	);
	expect(attraction).toBeDefined();

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadMissCreeperAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredRootedTarget = restoredGame.creatures[rootedTarget.id];
	const restoredAttractedTarget = restoredGame.creatures[attractedTarget.id];
	const restoredTendrils = restoredGame.effects.find((effect: any) => effect.id === tendrils.id);
	const restoredSilence = restoredGame.effects.find((effect: any) => effect.id === silence.id);
	const restoredAttraction = restoredGame.effects.find(
		(effect: any) => effect.id === attraction.id,
	);
	expect(restoredRootedTarget.abilities[2].isUpgraded()).toBe(false);
	expect(restoredSilence.hasCustomCallbacks).toBe(true);
	expect(restoredAttraction.hasCustomCallbacks).toBe(true);

	restoredTendrils.isDeleted = true;
	restoredSilence.effectFn(restoredSilence);
	expect(restoredRootedTarget.abilities[2].isUpgraded()).toBe(true);
	expect(restoredSilence.isDeleted).toBe(true);

	restoredAttractedTarget.remainingMove = 0;
	restoredAttraction.effectFn(restoredAttraction, restoredAttractedTarget);
	expect(restoredAttraction.isDeleted).toBe(true);
});

test('snapshot rehydrates Impaler Poisonous Vine and its lethal-damage cleanup', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadImpalerAbilities } = await import('../abilities/Impaler');
	const game: any = await createGame([loadImpalerAbilities]);
	const impalerData = game.creatureData.find((creature: any) => creature.name === 'Impaler');
	const impalerType = impalerData.type ?? `${impalerData.realm}${impalerData.level}`;
	game.players[0].summon(impalerType, { x: 4, y: 4 });
	game.players[1].summon('G2', { x: 9, y: 4 });
	const impaler = game.creatures.find(
		(creature: any) => creature?.name === 'Impaler' && creature.team === 0,
	);
	const target = game.creatures.find(
		(creature: any) => creature?.name === 'Swampler' && creature.team === 1,
	);
	expect(impaler).toBeDefined();
	expect(target).toBeDefined();
	impaler.abilities[2].activate(target);
	const vineTrap = game.traps.find((trap: any) => trap.type === 'poisonous-vine');
	const vineEffect = vineTrap.effects[0];
	const cleanupEffect = target.effects.find(
		(effect: any) => effect.snapshotBehaviorId === 'impaler.poison-vine-cleanup-effect.v1',
	);
	expect(vineEffect.snapshotBehaviorId).toBe('impaler.poison-vine-effect.v1');
	expect(cleanupEffect).toBeDefined();
	const health = target.health;

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadImpalerAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredTarget = restoredGame.creatures[target.id];
	const restoredTrap = restoredGame.traps.find((trap: any) => trap.id === vineTrap.id);
	const restoredVineEffect = restoredTrap.effects[0];
	const restoredCleanup = restoredTarget.effects.find(
		(effect: any) => effect.id === cleanupEffect.id,
	);
	expect(restoredVineEffect.hasCustomCallbacks).toBe(true);
	expect(restoredCleanup.hasCustomCallbacks).toBe(true);
	expect(restoredVineEffect.trap).toBe(restoredTrap);

	restoredTrap.activate(/onStepOut/, restoredTarget);
	expect(restoredTarget.health).toBeLessThan(health);
	expect(restoredGame.traps).not.toContain(restoredTrap);
	expect(restoredGame.traps.some((trap: any) => trap.type === 'poisonous-vine')).toBe(false);
	const destroyTrapSpies = restoredTarget.hexagons.map((hex: any) =>
		jest.spyOn(hex, 'destroyTrap').mockImplementation(() => undefined),
	);
	restoredCleanup.effectFn(restoredCleanup, {
		damages: { pure: restoredTarget.health },
		applyDamage: () => ({ total: restoredTarget.health }),
	} as any);
	destroyTrapSpies.forEach((spy: any) => {
		expect(spy).toHaveBeenCalled();
		spy.mockRestore();
	});
});

test('snapshot rehydrates Abolished Bonfire Spring damage and trap cleanup', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadAbolishedAbilities } = await import('../abilities/Abolished');
	const game: any = await createGame([loadAbolishedAbilities]);
	const abolishedData = game.creatureData.find((creature: any) => creature.name === 'Abolished');
	const abolishedType = abolishedData.type ?? `${abolishedData.realm}${abolishedData.level}`;
	game.players[0].summon(abolishedType, { x: 4, y: 4 });
	const abolished = game.creatures.find(
		(creature: any) => creature?.name === 'Abolished' && creature.team === 0,
	);
	const destination = game.hexAt(9, 4);
	expect(destination).toBeDefined();
	expect(abolished.abilities[2].title).toBe('Bonfire Spring');
	const mockMoveTo = jest.fn((hex: any, options: any) => {
		abolished.cleanHex();
		abolished.x = hex.x;
		abolished.y = hex.y;
		abolished.updateHex();
		options.createTeleportDestinationTraps();
		abolished.cleanHex();
		abolished.x = 14;
		abolished.y = 4;
		abolished.updateHex();
	});
	abolished.moveTo = mockMoveTo;
	abolished.abilities[2].activate(destination);
	expect(mockMoveTo).toHaveBeenCalled();
	const destinationTrap = game.traps.find(
		(trap: any) =>
			trap.type === 'bonfire-spring' && trap.x === destination.x && trap.y === destination.y,
	);
	expect(destinationTrap).toBeDefined();
	expect(destinationTrap.effects[0].snapshotBehaviorId).toBe('abolished.bonfire-spring-effect.v1');
	game.players[1].summon('G2', { x: 10, y: 4 });
	const target = game.creatures.find(
		(creature: any) => creature?.name === 'Swampler' && creature.team === 1,
	);
	target.cleanHex();
	target.x = destination.x;
	target.y = destination.y;
	target.updateHex();
	const health = target.health;

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	expect(snapshot.effects.some((effect: any) => effect.id === destinationTrap.effects[0].id)).toBe(
		true,
	);
	const restoredGame: any = await createGame([loadAbolishedAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredTarget = restoredGame.creatures[target.id];
	const restoredTrap = restoredGame.traps.find((trap: any) => trap.id === destinationTrap.id);
	const restoredEffect = restoredTrap.effects[0];
	expect(restoredEffect.hasCustomCallbacks).toBe(true);
	expect(restoredEffect.trap).toBe(restoredTrap);

	restoredTrap.activate(/onStepIn/, restoredTarget);
	expect(restoredTarget.health).toBeLessThan(health);
	expect(restoredGame.traps).not.toContain(restoredTrap);
	expect(restoredEffect.isDeleted).toBe(true);
});

test('snapshot rehydrates Nutcase Tentacle Bush and Hammered callbacks', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadNutcaseAbilities } = await import('../abilities/Nutcase');
	const { Damage } = await import('../damage');
	const game: any = await createGame([loadNutcaseAbilities]);
	const nutcaseData = game.creatureData.find((creature: any) => creature.name === 'Nutcase');
	const nutcaseType = nutcaseData.type ?? `${nutcaseData.realm}${nutcaseData.level}`;
	game.players[0].summon(nutcaseType, { x: 4, y: 4 });
	game.players[1].summon('G2', { x: 10, y: 4 });
	const nutcase = game.creatures.find(
		(creature: any) => creature?.name === 'Nutcase' && creature.team === 0,
	);
	const target = game.creatures.find(
		(creature: any) => creature?.name === 'Swampler' && creature.team === 1,
	);
	nutcase.abilities[0].activate();
	const tentacleBush = nutcase.effects.find(
		(effect: any) => effect.snapshotBehaviorId === 'nutcase.tentacle-bush-effect.v1',
	);
	expect(tentacleBush).toBeDefined();
	const meleeDamage = new Damage(target, { slash: 1 }, 1, [], game);
	meleeDamage.melee = true;
	tentacleBush.effectFn(tentacleBush, meleeDamage);
	expect(target.findEffect(nutcase.abilities[0].title).length).toBeGreaterThan(0);
	nutcase.abilities[1]._activateOnTarget(target);
	const hammeredByAbility = target.effects.find((effect: any) => effect.name === 'Hammered');
	expect(hammeredByAbility).toBeDefined();

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadNutcaseAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredTarget = restoredGame.creatures[target.id];
	const restoredNutcase = restoredGame.creatures[nutcase.id];
	const restoredTentacle = restoredNutcase.effects.find(
		(effect: any) => effect.id === tentacleBush.id,
	);
	const restoredHammered = restoredTarget.effects.find(
		(effect: any) => effect.id === hammeredByAbility.id,
	);
	expect(restoredTentacle.hasCustomCallbacks).toBe(true);
	expect(restoredHammered.hasCustomCallbacks).toBe(true);
	const health = restoredTarget.health;
	restoredHammered.effectFn(restoredHammered);
	expect(restoredTarget.health).toBeLessThan(health);
	expect(restoredHammered.isDeleted).toBe(true);
});

test('snapshot rehydrates Asher Heat Haze, Glowing Eye, and Covert Strike callbacks', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadAsherAbilities } = await import('../abilities/Asher');
	const { Damage } = await import('../damage');
	const game: any = await createGame([loadAsherAbilities]);
	const asherData = game.creatureData.find((creature: any) => creature.name === 'Asher');
	const asherType = asherData.type ?? `${asherData.realm}${asherData.level}`;
	game.players[0].summon(asherType, { x: 4, y: 4 });
	game.players[1].summon('G2', { x: 5, y: 4 });
	const asher = game.creatures.find(
		(creature: any) => creature?.name === 'Asher' && creature.team === 0,
	);
	const target = game.creatures.find(
		(creature: any) => creature?.name === 'Swampler' && creature.team === 1,
	);
	expect(asher.adjacentHexes(1)).toContain(target.hexagons[0]);
	asher.abilities[0].setUpgraded();
	asher.abilities[0].activate();
	asher.abilities[1].setUpgraded();
	asher.abilities[1].activate(target);
	asher.abilities[2].setUpgraded();
	asher.abilities[2].activate(target);
	const heatHaze = target.effects.find(
		(effect: any) => effect.snapshotBehaviorId === 'asher.heat-haze-burn-effect.v1',
	);
	const glowingEye = target.effects.find(
		(effect: any) => effect.snapshotBehaviorId === 'asher.glowing-eye-effect.v1',
	);
	const covertStrike = target.effects.find(
		(effect: any) => effect.snapshotBehaviorId === 'asher.covert-strike-move-effect.v1',
	);
	expect(heatHaze).toBeDefined();
	expect(glowingEye).toBeDefined();
	expect(covertStrike).toBeDefined();

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadAsherAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredTarget = restoredGame.creatures[target.id];
	const restoredAsher = restoredGame.creatures[asher.id];
	const restoredHeatHaze = restoredTarget.effects.find((effect: any) => effect.id === heatHaze.id);
	const restoredGlowingEye = restoredTarget.effects.find(
		(effect: any) => effect.id === glowingEye.id,
	);
	const restoredCovertStrike = restoredTarget.effects.find(
		(effect: any) => effect.id === covertStrike.id,
	);
	expect(restoredHeatHaze.hasCustomCallbacks).toBe(true);
	expect(restoredGlowingEye.hasCustomCallbacks).toBe(true);
	expect(restoredCovertStrike.hasCustomCallbacks).toBe(true);
	const health = restoredTarget.health;
	const attack = new Damage(restoredAsher, { slash: 1 }, 1, [], restoredGame);
	attack.target = restoredTarget;
	expect(restoredHeatHaze.requireFn(attack)).toBe(true);
	restoredHeatHaze.effectFn(restoredHeatHaze, attack);
	expect(restoredTarget.health).toBeLessThan(health);
	const recharge = jest.spyOn(restoredTarget, 'recharge');
	restoredGlowingEye.effectFn(restoredGlowingEye, restoredTarget);
	expect(recharge).toHaveBeenCalledWith(0);
	restoredTarget.remainingMove = 2;
	restoredCovertStrike.effectFn(restoredCovertStrike, restoredTarget);
	expect(restoredTarget.remainingMove).toBe(0);
});

test('snapshot rehydrates Swine Thug Mud Bath movement penalty', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadSwineThugAbilities } = await import('../abilities/Swine-Thug');
	const game: any = await createGame([loadSwineThugAbilities]);
	game.players[0].summon('A1', { x: 4, y: 4 });
	game.players[1].summon('G2', { x: 7, y: 4 });
	const swineThug = game.creatures.find(
		(creature: any) => creature?.name === 'Swine Thug' && creature.team === 0,
	);
	const target = game.creatures.find(
		(creature: any) => creature?.name === 'Swampler' && creature.team === 1,
	);
	expect(swineThug).toBeDefined();
	expect(target).toBeDefined();
	target.remainingMove = 2;
	swineThug.abilities[3].activate(target.hexagons[0]);
	const trap = game.traps.find(
		(candidate: any) => candidate.x === target.x && candidate.y === target.y,
	);
	expect(trap).toBeDefined();
	expect(trap.effects[0].snapshotBehaviorId).toBe('swine-thug.mud-bath-effect.v1');

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadSwineThugAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredTarget = restoredGame.creatures[target.id];
	const restoredTrap = restoredGame.traps.find((candidate: any) => candidate.id === trap.id);
	expect(restoredTrap.effects[0].hasCustomCallbacks).toBe(true);
	restoredTrap.activate(/onStepIn/, restoredTarget);
	expect(restoredTarget.remainingMove).toBe(1);
});

test('snapshot export refuses pending executable queue events and in-flight actions', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const game: any = await createGame([]);
	const event = {
		isEvent: true as const,
		id: 'pending',
		type: 'test',
		turn: game.turn,
		initiative: 0,
		title: 'Pending test event',
		data: {},
		resolve: () => undefined,
	};
	game.queue.addEvent(event);
	expect(() => game.serializeSnapshot()).toThrow('queued event');
	game.queue.removeEvent(event);

	game.animationQueue.push('move');
	expect(() => game.serializeSnapshot()).toThrow('in-progress animation');
	game.animationQueue.length = 0;
	game._deferredQueryMovePending = 1;
	expect(() => game.serializeSnapshot()).toThrow('deferred move query');
});

test('snapshot restores newly materialized creatures with stable ids and movement pools', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadScavenger } = await import('../abilities/Scavenger');
	const g1: any = await createGame([loadScavenger]);
	g1.players[0].summon('P3', { x: 5, y: 1 });
	const scavenger = g1.creatures.find((creature: any) => creature?.name === 'Scavenger');
	expect(scavenger).toBeDefined();
	scavenger.abilities[0].upgraded = true;
	scavenger.turnsActive = 1;
	scavenger.movementPool = 3;
	scavenger.remainingMove = 8;
	scavenger.materializationSickness = false;

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(g1.serializeSnapshot()),
	);
	const g2: any = await createGame([loadScavenger]);
	g2.soundsys.setEffectsMuted = () => {};
	g2.reconstructFromSnapshot(snapshot);

	const restoredScavenger = g2.creatures[scavenger.id];
	expect(restoredScavenger).toBeDefined();
	expect(restoredScavenger.name).toBe('Scavenger');
	expect(restoredScavenger.id).toBe(scavenger.id);
	expect(restoredScavenger.player).toBe(g2.players[0]);
	expect(g2.players[0].creatures).toContain(restoredScavenger);
	expect(restoredScavenger.movementPool).toBe(3);
	expect(restoredScavenger.remainingMove).toBe(8);
	expect(restoredScavenger.hasAfterimages).toBe(true);
	expect(restoredScavenger.abilities[0].upgraded).toBe(true);
	expect(g2.serializeSnapshot().creatures).toEqual(snapshot.creatures);
});

test('snapshot round-trips Horn Head Life Support tracker effect', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadHornHeadAbilities } = await import('../abilities/Horn-Head');
	const { Effect } = await import('../effect');
	const game: any = await createGame([loadHornHeadAbilities]);
	game.players[0].summon('W5', { x: 4, y: 3 });
	const hornHead = game.creatures.find((c: any) => c?.name === 'Horn Head');
	expect(hornHead).toBeDefined();

	const effect = new Effect(
		'Life Support Damage Tracker',
		hornHead,
		hornHead,
		'onDamage',
		{
			snapshotBehaviorId: 'horn-head.life-support-damage-tracker.v1',
			snapshotBehaviorData: { creatureId: hornHead.id },
			effectFn: () => undefined,
			deleteTrigger: 'onEndPhase',
			turnLifetime: 1,
			stackable: false,
			deleteOnOwnerDeath: true,
		},
		game,
	);
	hornHead.addEffect(effect);
	expect(game._snapshotEffectBehaviors.has(effect.snapshotBehaviorId)).toBe(true);

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadHornHeadAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredHornHead = restoredGame.creatures[hornHead.id];
	const restoredEffect = restoredGame.effects.find((e: any) => e.id === effect.id);
	expect(restoredHornHead).toBeDefined();
	expect(restoredEffect.snapshotBehaviorId).toBe('horn-head.life-support-damage-tracker.v1');
	expect(restoredEffect.hasCustomCallbacks).toBe(true);
	expect(restoredEffect.target).toBe(restoredHornHead);
});

test('snapshot round-trips Horn Head Meat Sickle restriction effect', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadHornHeadAbilities } = await import('../abilities/Horn-Head');
	const { Effect } = await import('../effect');
	const game: any = await createGame([loadHornHeadAbilities]);
	game.players[0].summon('W5', { x: 4, y: 3 });
	const hornHead = game.creatures.find((c: any) => c?.name === 'Horn Head');
	const foe = game.creatures[1];
	expect(hornHead).toBeDefined();
	expect(foe).toBeDefined();

	const effect = new Effect(
		'Meat Sickle Restriction',
		hornHead,
		foe,
		'onStartPhase',
		{
			snapshotBehaviorId: 'horn-head.meat-sickle-restriction.v1',
			snapshotBehaviorData: {},
			effectFn: () => undefined,
			deleteTrigger: '',
			turnLifetime: -1,
			stackable: false,
			deleteOnOwnerDeath: true,
		},
		game,
	);
	foe.addEffect(effect);
	expect(game._snapshotEffectBehaviors.has(effect.snapshotBehaviorId)).toBe(true);

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadHornHeadAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredEffect = restoredGame.effects.find((e: any) => e.id === effect.id);
	expect(restoredEffect.snapshotBehaviorId).toBe('horn-head.meat-sickle-restriction.v1');
	expect(restoredEffect.hasCustomCallbacks).toBe(true);
});

test('snapshot round-trips Horn Head Meat Sickle movement drain effect', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadHornHeadAbilities } = await import('../abilities/Horn-Head');
	const { Effect } = await import('../effect');
	const game: any = await createGame([loadHornHeadAbilities]);
	game.players[0].summon('W5', { x: 4, y: 3 });
	const hornHead = game.creatures.find((c: any) => c?.name === 'Horn Head');
	const foe = game.creatures[1];
	expect(hornHead).toBeDefined();
	expect(foe).toBeDefined();

	const effect = new Effect(
		'Meat Sickle',
		hornHead,
		foe,
		'onStartPhase',
		{
			snapshotBehaviorId: 'horn-head.meat-sickle-movement-drain.v1',
			snapshotBehaviorData: { movementDrain: 2, targetId: foe.id },
			effectFn: () => undefined,
			deleteTrigger: '',
			turnLifetime: -1,
			stackable: false,
			deleteOnOwnerDeath: true,
		},
		game,
	);
	foe.addEffect(effect);
	expect(game._snapshotEffectBehaviors.has(effect.snapshotBehaviorId)).toBe(true);

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadHornHeadAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredEffect = restoredGame.effects.find((e: any) => e.id === effect.id);
	expect(restoredEffect.snapshotBehaviorId).toBe('horn-head.meat-sickle-movement-drain.v1');
	expect(restoredEffect.hasCustomCallbacks).toBe(true);
});

test('snapshot round-trips Scavenger Deadly Toxin poison effect', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadScavengerAbilities } = await import('../abilities/Scavenger');
	const { Effect } = await import('../effect');
	const game: any = await createGame([loadScavengerAbilities]);
	game.players[0].summon('P3', { x: 5, y: 1 });
	const scavenger = game.creatures.find((c: any) => c?.name === 'Scavenger');
	const foe = game.creatures[1];
	expect(scavenger).toBeDefined();
	expect(foe).toBeDefined();

	const effect = new Effect(
		'Deadly Toxin',
		scavenger,
		foe,
		'onStartPhase',
		{
			snapshotBehaviorId: 'scavenger.deadly-toxin-poison.v1',
			snapshotBehaviorData: { ownerId: scavenger.id, poisonAmount: scavenger.damages?.poison ?? 4 },
			effectFn: () => undefined,
			stackable: false,
		},
		game,
	);
	foe.addEffect(effect);
	expect(game._snapshotEffectBehaviors.has(effect.snapshotBehaviorId)).toBe(true);

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadScavengerAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredEffect = restoredGame.effects.find((e: any) => e.id === effect.id);
	expect(restoredEffect.snapshotBehaviorId).toBe('scavenger.deadly-toxin-poison.v1');
	expect(restoredEffect.hasCustomCallbacks).toBe(true);
});

test('snapshot round-trips Stomper Earth Shaker effect', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadStomperAbilities } = await import('../abilities/Stomper');
	const { Effect } = await import('../effect');
	const game: any = await createGame([loadStomperAbilities]);
	game.players[0].summon('E3', { x: 4, y: 3 });
	const stomper = game.creatures.find((c: any) => c?.name === 'Stomper');
	const foe = game.creatures[1];
	expect(stomper).toBeDefined();
	expect(foe).toBeDefined();

	const effect = new Effect(
		'Earth Shaker',
		stomper,
		foe,
		'onStartPhase',
		{
			snapshotBehaviorId: 'stomper.earth-shaker.v1',
			snapshotBehaviorData: { targetId: foe.id },
			effectFn: () => undefined,
			deleteTrigger: 'onEndPhase',
			turnLifetime: 1,
			stackable: false,
		},
		game,
	);
	foe.addEffect(effect);
	expect(game._snapshotEffectBehaviors.has(effect.snapshotBehaviorId)).toBe(true);

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadStomperAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredEffect = restoredGame.effects.find((e: any) => e.id === effect.id);
	expect(restoredEffect.snapshotBehaviorId).toBe('stomper.earth-shaker.v1');
	expect(restoredEffect.hasCustomCallbacks).toBe(true);
});

test('snapshot round-trips Uncle Fungus one-shot Offense Bonus cleanup effect', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadUncleFungusAbilities } = await import('../abilities/Uncle-Fungus');
	const { Effect } = await import('../effect');
	const game: any = await createGame([loadUncleFungusAbilities]);
	game.players[0].summon('G3', { x: 4, y: 3 });
	const uncle = game.creatures.find((c: any) => c?.name === 'Uncle Fungus');
	expect(uncle).toBeDefined();

	const effect = new Effect(
		'Offense Bonus',
		uncle,
		uncle,
		'onStepIn onEndPhase',
		{
			snapshotBehaviorId: 'uncle-fungus.offense-bonus.v1',
			snapshotBehaviorData: { creatureId: uncle.id },
			effectFn: () => undefined,
			alterations: { offense: 2 },
		},
		game,
	);
	uncle.addEffect(effect);
	expect(game._snapshotEffectBehaviors.has(effect.snapshotBehaviorId)).toBe(true);

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadUncleFungusAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredEffect = restoredGame.effects.find((e: any) => e.id === effect.id);
	expect(restoredEffect.snapshotBehaviorId).toBe('uncle-fungus.offense-bonus.v1');
	expect(restoredEffect.hasCustomCallbacks).toBe(true);
	expect(restoredEffect.alterations).toEqual({ offense: 2 });
});

test('snapshot round-trips Golden Wyrm one-shot Momentum cleanup effect', async () => {
	const { createGame } = await import('./simulation/botgeria');
	const { default: loadGoldenWyrmAbilities } = await import('../abilities/Golden-Wyrm');
	const { Effect } = await import('../effect');
	const game: any = await createGame([loadGoldenWyrmAbilities]);
	game.players[0].summon('A7', { x: 4, y: 3 });
	const wyrm = game.creatures.find((c: any) => c?.name === 'Golden Wyrm');
	expect(wyrm).toBeDefined();

	const effect = new Effect(
		'Momentum',
		wyrm,
		wyrm,
		'',
		{
			snapshotBehaviorId: 'golden-wyrm.momentum.v1',
			snapshotBehaviorData: { creatureId: wyrm.id },
			effectFn: () => undefined,
			alterations: { offense: 25 },
			deleteTrigger: 'onStartPhase',
			turnLifetime: 1,
		},
		game,
	);
	wyrm.addEffect(effect);
	expect(game._snapshotEffectBehaviors.has(effect.snapshotBehaviorId)).toBe(true);

	const snapshot = GameSnapshotSerializer.from(
		GameSnapshotSerializer.stringify(game.serializeSnapshot()),
	);
	const restoredGame: any = await createGame([loadGoldenWyrmAbilities]);
	restoredGame.soundsys.setEffectsMuted = () => {};
	restoredGame.reconstructFromSnapshot(snapshot);
	const restoredEffect = restoredGame.effects.find((e: any) => e.id === effect.id);
	expect(restoredEffect.snapshotBehaviorId).toBe('golden-wyrm.momentum.v1');
	expect(restoredEffect.hasCustomCallbacks).toBe(true);
	expect(restoredEffect.alterations).toEqual({ offense: 25 });
});
