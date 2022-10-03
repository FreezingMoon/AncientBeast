import { Creature } from "./creature";

export type ObjectStats = {
    health: number; //Shows the current health of the object
    endurance: number; //Shows the current endurance of the object
    regrowth: number; //Shows the current regrowth of the object
    energy: number; //Shows the current energy of the object
    meditation: number; //Shows the current meditation of the object
    initiative: number; //Shows the current initiative of the object
    offense: number; //Shows the current offensive stats of the object
    defense: number; //Shows the current defensive stats of the object
    movement: number; //Shows the current movement of the object
    pierce: number; //Shows the current pierce of the object
    slash: number; //Shows the current slash of the object
    crush: number; //Shows the current crush of the object
    shock: number; //Shows the current shock of the object
    burn: number; //Shows the current burn of the object
    frost: number; //Shows the current frost of the object
    poison: number; //Shows the current poison of the object
    sonic: number; //Shows the current sonic of the object
    mental: number; //Shows the current mental of the object

    moveable: boolean; //True if the object can move
    fatigueImmunity: boolean; //True if the object is immune to fatigue

    reqEnergy: number; //Extra Energy Required for abilities
};

export type StatusEffects = {
    //These are toggleable effects that can happen to creatures//

    frozen: boolean; //True if creature is frozen
    cryostasis: boolean; //True if frozen effect is enhanced
    dizzy: boolean; //True if character is dizzy
};

export type ScoreTypes = {
    firstKill: number,
    kill: number,
    deny: number,
    humiliation: number,
    annihilation: number,
    timebonus: number,
    nofleeing: number,
    creaturebonus: number,
    darkpriestbonus: number,
    immortal: number,
    total: number,
    pickupDrop: number,
    upgrade: number,
    creature: Creature,
    kills: number,
    type: string,
};

export type ScoreArrayType = {
    type: string,
    player: number,
    creature: Creature
}

export type TriggersObjectType = {
    onStepIn: RegExp,
    onStepOut: RegExp
    onReset: RegExp,
    onStartPhase: RegExp,
    onEndPhase: RegExp,
    onMovement: RegExp,
    onUnderAttack: RegExp,
    onDamage: RegExp,
    onHeal: RegExp,
    onAttack: RegExp,
    onCreatureMove: RegExp,
    onCreatureDeath: RegExp,
    onCreatureSummon: RegExp,

    onStepIn_other: RegExp,
    onStepOut_other: RegExp,
    onReset_other: RegExp,
    onStartPhase_other: RegExp,
    onEndPhase_other: RegExp,
    onMovement_other: RegExp,
    onAttack_other: RegExp,
    onDamage_other: RegExp,
    onHeal_other: RegExp,
    onUnderAttack_other: RegExp,
    onCreatureMove_other: RegExp,
    onCreatureDeath_other: RegExp,
    onCreatureSummon_other: RegExp,

    onEffectAttach: RegExp,
    onEffectAttach_other: RegExp,

    onStartOfRound: RegExp,
    onQuery: RegExp,
    oncePerDamageChain: RegExp,
};

type MaterializeUnitHandler = (plasmaCost: string) => string;

export type MSGtype = {
    abilities: {
        noTarget: string,
        noPlasma: string,
        noPsy: string,
        alreadyUsed: string,
        tooMuch: string,
        notEnough: string,
        notMoveable: string,
        passiveCycle: string,
        passiveUnavailable: string,
    }
    ui: {
        dash: {
            materializeOverload: string,
            selectUnit: string,
            lowPlasma: string,
            materializeUnit: MaterializeUnitHandler;
            //plasmaCost :  string,
            materializeUsed: string,
            heavyDev: string,
        }
    }
}

export type AnimationDataType = {
    duration: number,
    delay: number,
    activateAnimation: boolean
};

export type HexTargetType = {
    hexesHit: number,
    target: Creature
};