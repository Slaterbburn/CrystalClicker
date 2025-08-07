import * as hz from 'horizon/core'
import { Generator, QuestDefinition, ClickMilestone, Milestone, OnStaticDataLoaded } from './Events'

export class DataManager extends hz.Component<typeof DataManager> {
  static propsDefinition = {}

  private readonly initialGenerators: Generator[] = [
    { id: 1, name: 'Simple Miner', baseCost: 15, productionRate: 1, owned: 0, currentCost: 15 },
    { id: 2, name: 'Advanced Drill', baseCost: 100, productionRate: 8, owned: 0, currentCost: 100 },
    { id: 3, name: 'Excavation Team', baseCost: 1100, productionRate: 47, owned: 0, currentCost: 1100 },
    { id: 4, name: 'Quarry', baseCost: 12000, productionRate: 260, owned: 0, currentCost: 12000 },
    { id: 5, name: 'Deep-Earth Extractor', baseCost: 130000, productionRate: 1400, owned: 0, currentCost: 130000 },
    { id: 6, name: 'Gem Synthesizer', baseCost: 1400000, productionRate: 7800, owned: 0, currentCost: 1400000 },
    { id: 7, name: 'Planet Cracker', baseCost: 20000000, productionRate: 44000, owned: 0, currentCost: 20000000 },
    { id: 8, name: 'Stardust Collector', baseCost: 330000000, productionRate: 260000, owned: 0, currentCost: 330000000 },
  ];

  private readonly questDefinitions: QuestDefinition[] = [
    { id: 1, description: 'Mine your first Gem', checkCondition: (gems, gens) => gems >= 1 },
    { id: 2, description: 'Own 1 Simple Miner', checkCondition: (gems, gens) => gens.find(g => g.id === 1)!.owned >= 1 },
    { id: 3, description: 'Reach 100 Gems', checkCondition: (gems, gens) => gems >= 100 },
    { id: 4, description: 'Own 1 Advanced Drill', checkCondition: (gems, gens) => gens.find(g => g.id === 2)!.owned >= 1 },
    { id: 5, description: 'Own 10 Simple Miners', checkCondition: (gems, gens) => gens.find(g => g.id === 1)!.owned >= 10 },
    { id: 6, description: 'Reach 1,100 Gems', checkCondition: (gems, gens) => gems >= 1100 },
    { id: 7, description: 'Own an Excavation Team', checkCondition: (gems, gens) => gens.find(g => g.id === 3)!.owned >= 1 },
    { id: 8, description: 'Own 25 Simple Miners', checkCondition: (gems, gens) => gens.find(g => g.id === 1)!.owned >= 25 },
    { id: 9, description: 'Own 10 Advanced Drills', checkCondition: (gems, gens) => gens.find(g => g.id === 2)!.owned >= 10 },
    { id: 10, description: 'Reach 12,000 Gems', checkCondition: (gems, gens) => gems >= 12000 },
    { id: 11, description: 'Own a Quarry', checkCondition: (gems, gens) => gens.find(g => g.id === 4)!.owned >= 1 },
    { id: 12, description: 'Reach 1 Million Gems', checkCondition: (gems, gens) => gems >= 1000000 },
    { id: 13, description: 'Own a Gem Synthesizer', checkCondition: (gems, gens) => gens.find(g => g.id === 6)!.owned >= 1 },
    { id: 14, description: 'Reach 1 Billion Gems', checkCondition: (gems, gens) => gems >= 1000000000 },
    { id: 15, description: 'Own a Stardust Collector', checkCondition: (gems, gens) => gens.find(g => g.id === 8)!.owned >= 1 },
  ];
  
  private readonly milestones: Milestone[] = [
      { owned: 10, multiplier: 2 }, { owned: 25, multiplier: 3 },
      { owned: 50, multiplier: 5 }, { owned: 100, multiplier: 10 },
      { owned: 200, multiplier: 20 }, { owned: 500, multiplier: 50 },
      { owned: 1000, multiplier: 100 },
  ];
  
  private readonly clickMilestones: ClickMilestone[] = [
    { clicks: 100, gemsPerClick: 2 }, { clicks: 500, gemsPerClick: 3 },
    { clicks: 1000, gemsPerClick: 4 }, { clicks: 2500, gemsPerClick: 5 },
    { clicks: 5000, gemsPerClick: 10 }, { clicks: 10000, gemsPerClick: 15 },
    { clicks: 25000, gemsPerClick: 20 }, { clicks: 50000, gemsPerClick: 30 },
    { clicks: 100000, gemsPerClick: 50 }, { clicks: 250000, gemsPerClick: 75 },
    { clicks: 500000, gemsPerClick: 100 }, { clicks: 1000000, gemsPerClick: 150 },
    { clicks: 5000000, gemsPerClick: 200 }, { clicks: 10000000, gemsPerClick: 300 },
    { clicks: 50000000, gemsPerClick: 500 }, { clicks: 100000000, gemsPerClick: 1000 },
    { clicks: 500000000, gemsPerClick: 2500 }, { clicks: 1000000000, gemsPerClick: 5000 },
    { clicks: 5000000000, gemsPerClick: 10000 }, { clicks: 10000000000, gemsPerClick: 25000 },
  ];
  
  start() {
    this.sendLocalBroadcastEvent(OnStaticDataLoaded, {
      generators: this.initialGenerators,
      quests: this.questDefinitions,
      milestones: this.milestones,
      clickMilestones: this.clickMilestones,
    })
  }
}

hz.Component.register(DataManager)