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

  // [MODIFIED] Expanded the quest list and added Dark Matter rewards to each.
  private readonly questDefinitions: QuestDefinition[] = [
    { id: 1, description: 'Mine your first Crystal', checkCondition: (crystals, gens) => crystals >= 1, rewardDarkMatter: 1 },
    { id: 2, description: 'Own 1 Simple Miner', checkCondition: (crystals, gens) => gens.find(g => g.id === 1)!.owned >= 1, rewardDarkMatter: 1 },
    { id: 3, description: 'Reach 100 Crystals', checkCondition: (crystals, gens) => crystals >= 100, rewardDarkMatter: 1 },
    { id: 4, description: 'Own 1 Advanced Drill', checkCondition: (crystals, gens) => gens.find(g => g.id === 2)!.owned >= 1, rewardDarkMatter: 2 },
    { id: 5, description: 'Own 10 Simple Miners', checkCondition: (crystals, gens) => gens.find(g => g.id === 1)!.owned >= 10, rewardDarkMatter: 2 },
    { id: 6, description: 'Reach 1,100 Crystals', checkCondition: (crystals, gens) => crystals >= 1100, rewardDarkMatter: 2 },
    { id: 7, description: 'Own an Excavation Team', checkCondition: (crystals, gens) => gens.find(g => g.id === 3)!.owned >= 1, rewardDarkMatter: 3 },
    { id: 8, description: 'Own 25 Simple Miners', checkCondition: (crystals, gens) => gens.find(g => g.id === 1)!.owned >= 25, rewardDarkMatter: 3 },
    { id: 9, description: 'Own 10 Advanced Drills', checkCondition: (crystals, gens) => gens.find(g => g.id === 2)!.owned >= 10, rewardDarkMatter: 3 },
    { id: 10, description: 'Reach 12,000 Crystals', checkCondition: (crystals, gens) => crystals >= 12000, rewardDarkMatter: 4 },
    { id: 11, description: 'Own a Quarry', checkCondition: (crystals, gens) => gens.find(g => g.id === 4)!.owned >= 1, rewardDarkMatter: 4 },
    { id: 12, description: 'Own 50 Simple Miners', checkCondition: (crystals, gens) => gens.find(g => g.id === 1)!.owned >= 50, rewardDarkMatter: 4 },
    { id: 13, description: 'Own 25 Advanced Drills', checkCondition: (crystals, gens) => gens.find(g => g.id === 2)!.owned >= 25, rewardDarkMatter: 5 },
    { id: 14, description: 'Own 10 Excavation Teams', checkCondition: (crystals, gens) => gens.find(g => g.id === 3)!.owned >= 10, rewardDarkMatter: 5 },
    { id: 15, description: 'Reach 130,000 Crystals', checkCondition: (crystals, gens) => crystals >= 130000, rewardDarkMatter: 5 },
    { id: 16, description: 'Own a Deep-Earth Extractor', checkCondition: (crystals, gens) => gens.find(g => g.id === 5)!.owned >= 1, rewardDarkMatter: 6 },
    { id: 17, description: 'Reach 1 Million Crystals', checkCondition: (crystals, gens) => crystals >= 1000000, rewardDarkMatter: 6 },
    { id: 18, description: 'Own 100 Simple Miners', checkCondition: (crystals, gens) => gens.find(g => g.id === 1)!.owned >= 100, rewardDarkMatter: 7 },
    { id: 19, description: 'Own a Gem Synthesizer', checkCondition: (crystals, gens) => gens.find(g => g.id === 6)!.owned >= 1, rewardDarkMatter: 7 },
    { id: 20, description: 'Reach 20 Million Crystals', checkCondition: (crystals, gens) => crystals >= 20000000, rewardDarkMatter: 8 },
    { id: 21, description: 'Own a Planet Cracker', checkCondition: (crystals, gens) => gens.find(g => g.id === 7)!.owned >= 1, rewardDarkMatter: 8 },
    { id: 22, description: 'Own 100 Advanced Drills', checkCondition: (crystals, gens) => gens.find(g => g.id === 2)!.owned >= 100, rewardDarkMatter: 9 },
    { id: 23, description: 'Reach 1 Billion Crystals', checkCondition: (crystals, gens) => crystals >= 1000000000, rewardDarkMatter: 9 },
    { id: 24, description: 'Own a Stardust Collector', checkCondition: (crystals, gens) => gens.find(g => g.id === 8)!.owned >= 1, rewardDarkMatter: 10 },
    { id: 25, description: 'Own 1000 Simple Miners', checkCondition: (crystals, gens) => gens.find(g => g.id === 1)!.owned >= 1000, rewardDarkMatter: 10 },
  ];
  
  private readonly milestones: Milestone[] = [
      { owned: 10, multiplier: 2 }, { owned: 25, multiplier: 3 },
      { owned: 50, multiplier: 5 }, { owned: 100, multiplier: 10 },
      { owned: 200, multiplier: 20 }, { owned: 500, multiplier: 50 },
      { owned: 1000, multiplier: 100 },
  ];
  
  private readonly clickMilestones: ClickMilestone[] = [
    { clicks: 100, crystalsPerClick: 2 }, { clicks: 500, crystalsPerClick: 3 },
    { clicks: 1000, crystalsPerClick: 4 }, { clicks: 2500, crystalsPerClick: 5 },
    { clicks: 5000, crystalsPerClick: 10 }, { clicks: 10000, crystalsPerClick: 15 },
    { clicks: 25000, crystalsPerClick: 20 }, { clicks: 50000, crystalsPerClick: 30 },
    { clicks: 100000, crystalsPerClick: 50 }, { clicks: 250000, crystalsPerClick: 75 },
    { clicks: 500000, crystalsPerClick: 100 }, { clicks: 1000000, crystalsPerClick: 150 },
    { clicks: 5000000, crystalsPerClick: 200 }, { clicks: 10000000, crystalsPerClick: 300 },
    { clicks: 50000000, crystalsPerClick: 500 }, { clicks: 100000000, crystalsPerClick: 1000 },
    { clicks: 500000000, crystalsPerClick: 2500 }, { clicks: 1000000000, crystalsPerClick: 5000 },
    { clicks: 5000000000, crystalsPerClick: 10000 }, { clicks: 10000000000, crystalsPerClick: 25000 },
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
