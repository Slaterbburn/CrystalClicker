import * as hz from 'horizon/core'

// --- CORE GAMEPLAY DATA ---
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
  checkCondition: (crystals: number, generators: Generator[]) => boolean
  // [NEW] Added a property to define a Dark Matter reward for each quest.
  rewardDarkMatter?: number
}

export type QuestDisplayData = {
  id: number;
  description: string;
} | null;

export type QuestState = {
  id: number
  isComplete: boolean
}

export type ClickMilestone = { 
    clicks: number; 
    crystalsPerClick: number; 
};

export type Milestone = {
    owned: number;
    multiplier: number;
};

// --- MANAGER-SPECIFIC DATA ---
export type Boost = {
    id: string;
    name: string;
    isActive: boolean;
    cooldownEndsAt: number;
    activeEndsAt: number;
    durationSecs: number;
    cooldownSecs: number;
};

export type RebirthState = {
    darkMatter: number;
    peakCPS: number;
};

export type DailyLoginState = {
    lastLoginTimestamp: number;
    consecutiveDays: number;
};

// --- MASTER PLAYER STATE (Saved to Persistent Storage) ---
export type PlayerState = {
  crystalCount: number;
  totalManualClicks: number;
  depth: number;
  lastUpdateTimestamp: number;
  generators: Generator[];
  quests: QuestState[];
  rebirth: RebirthState;
  dailyLogin: DailyLoginState;
}

// --- NETWORK EVENTS for State Sync ---
export const OnUpdatePlayerState = new hz.NetworkEvent<{
  crystalCount: number
  generators: Generator[]
  currentQuest: QuestDisplayData
  crystalsPerClick: number
  nextClickMilestone: ClickMilestone | null
  totalGPS: number
  depth: number
  rebirthState: RebirthState
}>('OnUpdatePlayerState')

export const OnGemCountUpdate = new hz.NetworkEvent<{
    crystalCount: number;
    totalGPS: number;
}>('OnGemCountUpdate');


// --- NETWORK EVENTS for Player Actions ---
export const OnManualDrill = new hz.NetworkEvent<{ player: hz.Player }>('OnManualDrill')
export const OnBuyGenerator = new hz.NetworkEvent<{ player: hz.Player, generatorId: number, amount: number | 'MAX' }>('OnBuyGenerator')
export const OnActivateBoost = new hz.NetworkEvent<{ player: hz.Player, boostId: string }>('OnActivateBoost');
export const OnPlayerRebirth = new hz.NetworkEvent<{ player: hz.Player }>('OnPlayerRebirth');
export const OnClaimDailyReward = new hz.NetworkEvent<{ player: hz.Player }>('OnClaimDailyReward');

// --- NETWORK EVENTS for UI and Sound ---
export const OnQuestCompleted = new hz.NetworkEvent<{ player: hz.Player, questId: number }>('OnQuestCompleted');
export const OnGeneratorMilestoneReached = new hz.NetworkEvent<{ player: hz.Player, generatorId: number }>('OnGeneratorMilestoneReached');
export const OnBoostStateUpdate = new hz.NetworkEvent<{ boosts: Boost[] }>('OnBoostStateUpdate');
export const OnShowOfflineProgress = new hz.NetworkEvent<{ crystalsEarned: number, durationSeconds: number }>('OnShowOfflineProgress');
export const OnDailyRewardStateUpdate = new hz.NetworkEvent<{ canClaim: boolean, consecutiveDays: number }>('OnDailyRewardStateUpdate');
export const OnCrystalTierUp = new hz.NetworkEvent<{ player: hz.Player, tier: number }>('OnCrystalTierUp');
export const OnDepthMilestoneReached = new hz.NetworkEvent<{ player: hz.Player, tier: number }>('OnDepthMilestoneReached');


// --- LOCAL EVENTS ---
export const OnStaticDataLoaded = new hz.LocalEvent<{
  generators: Generator[]
  quests: QuestDefinition[]
  milestones: Milestone[]
  clickMilestones: ClickMilestone[]
}>('OnStaticDataLoaded')

export const onImagesReady = new hz.NetworkEvent<{}>('onImagesReady');
export const OnBoostStateChanged = new hz.LocalEvent<{ playerId: number, boostId: string, isActive: boolean, multiplier: number }>('OnBoostStateChanged');
export const OnRequestRebirthReset = new hz.LocalEvent<{ playerId: number }>('OnRequestRebirthReset');
export const OnCalculateOfflineProgress = new hz.LocalEvent<{ player: hz.Player, state: PlayerState }>('OnCalculateOfflineProgress');
