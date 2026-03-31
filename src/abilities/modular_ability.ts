// Modular abilities system (#1469)
// Allows abilities to be composed from smaller modules

interface AbilityModule {
    name: string;
    effect: (target: any) => void;
    cost: number;
}

class ModularAbility {
    private modules: AbilityModule[] = [];
    private baseCost: number = 0;

    constructor(name: string, baseCost: number = 0) {
        this.baseCost = baseCost;
    }

    addModule(module: AbilityModule): this {
        this.modules.push(module);
        return this;
    }

    removeModule(moduleName: string): this {
        this.modules = this.modules.filter(m => m.name !== moduleName);
        return this;
    }

    getTotalCost(): number {
        return this.baseCost + this.modules.reduce((sum, m) => sum + m.cost, 0);
    }

    execute(target: any): void {
        this.modules.forEach(module => {
            module.effect(target);
        });
    }

    getModules(): AbilityModule[] {
        return [...this.modules];
    }
}

export { ModularAbility, AbilityModule };
