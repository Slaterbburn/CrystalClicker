import * as hz from 'horizon/core'

export type Generator = {
  id: number
  name: string
  baseCost: number
  productionRate: number
  owned: number
  currentCost: number
  nextMilestone?: { owned: number; multiplier: number; } 
}

export type QuestDefinition = {
  id: number
  description: string
  checkCondition: (gems: number, generators: Generator[]) => boolean
}

export type QuestDisplayData = {
  id: number;
  description: string;
} | null;

export type QuestState = {
  id: number
  isComplete: boolean
}

export type PlayerState = {
  gemCount: number;
  totalManualClicks: number; 
  generators: Generator[];
  quests: QuestState[];
}

export type ClickMilestone = { 
    clicks: number; 
    gemsPerClick: number; 
};

export type Milestone = {
    owned: number;
    multiplier: number;
};

// --- NETWORK EVENTS ---
export const OnUpdatePlayerState = new hz.NetworkEvent<{
  gemCount: number
  generators: Generator[]
  currentQuest: QuestDisplayData
  gemsPerClick: number
  nextClickMilestone: ClickMilestone | null
}>('OnUpdatePlayerState')

export const OnManualDrill = new hz.NetworkEvent<{ player: hz.Player }>('OnManualDrill')
export const OnBuyGenerator = new hz.NetworkEvent<{ player: hz.Player, generatorId: number }>(
  'OnBuyGenerator',
)

// --- LOCAL EVENTS ---
export const OnStaticDataLoaded = new hz.LocalEvent<{
  generators: Generator[]
  quests: QuestDefinition[]
  milestones: Milestone[]
  clickMilestones: ClickMilestone[]
}>('OnStaticDataLoaded')