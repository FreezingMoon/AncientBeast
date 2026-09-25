// Modular Abilities System
// 重构单位技能系统，使用面向对象设计

enum AbilityType {
    PASSIVE = 'passive',      // 第一技能：被动
    BASIC = 'basic',          // 第二技能：基础攻击
    SPECIAL = 'special',      // 第三技能：特殊技能
    ULTIMATE = 'ultimate'     // 第四技能：终极技能
}

interface AbilityConfig {
    type: AbilityType;
    name: string;
    description: string;
    cooldown: number;
    energyCost: number;
    range: number;
    conditions?: AbilityCondition[];
    effects?: AbilityEffect[];
}

interface AbilityCondition {
    type: 'health' | 'mana' | 'distance' | 'status';
    operator: '<' | '>' | '=' | '<=' | '>=';
    value: number;
}

interface AbilityEffect {
    type: 'damage' | 'heal' | 'buff' | 'debuff' | 'summon';
    value: number;
    duration?: number;
}

abstract class Ability {
    protected config: AbilityConfig;
    protected currentCooldown: number = 0;

    constructor(config: AbilityConfig) {
        this.config = config;
    }

    get type(): AbilityType {
        return this.config.type;
    }

    get name(): string {
        return this.config.name;
    }

    canUse(context: AbilityContext): boolean {
        // 检查冷却
        if (this.currentCooldown > 0) return false;

        // 检查能量
        if (context.energy < this.config.energyCost) return false;

        // 检查距离
        if (context.distance > this.config.range) return false;

        // 检查条件
        if (this.config.conditions) {
            for (const cond of this.config.conditions) {
                if (!this.checkCondition(cond, context)) return false;
            }
        }

        return true;
    }

    execute(context: AbilityContext): AbilityResult {
        if (!this.canUse(context)) {
            return { success: false, reason: 'Cannot use ability' };
        }

        // 执行效果
        const results = this.config.effects?.map(effect => this.applyEffect(effect, context)) || [];

        // 设置冷却
        this.currentCooldown = this.config.cooldown;

        return { success: true, effects: results };
    }

    reduceCooldown(amount: number = 1): void {
        this.currentCooldown = Math.max(0, this.currentCooldown - amount);
    }

    protected checkCondition(condition: AbilityCondition, context: AbilityContext): boolean {
        const value = context[condition.type] || 0;
        switch (condition.operator) {
            case '<': return value < condition.value;
            case '>': return value > condition.value;
            case '=': return value === condition.value;
            case '<=': return value <= condition.value;
            case '>=': return value >= condition.value;
            default: return false;
        }
    }

    protected abstract applyEffect(effect: AbilityEffect, context: AbilityContext): EffectResult;
}

interface AbilityContext {
    energy: number;
    health: number;
    distance: number;
    status: string;
    source: any;
    target: any;
}

interface AbilityResult {
    success: boolean;
    reason?: string;
    effects?: EffectResult[];
}

interface EffectResult {
    type: string;
    value: number;
    duration?: number;
}

export { Ability, AbilityType, AbilityConfig };
