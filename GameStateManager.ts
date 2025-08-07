// Events.ts

import * as hz from 'horizon/core'

// --- DATA STRUCTURES ---
// (No changes to data structures)
export type Generator = {
  id: number;
  name: string;
  baseCost: number;
  productionRate: number;
  owned: number;
  currentCost: number;
  nextMilestone?: { owned: number; multiplier: number; };
}
export type QuestDefinition = {
  id: number;
  description: string;
  checkCondition: (gems: number, generators: Generator[]) => boolean;
}
export type QuestDisplayData = {
  id: number;
  description: string;
} | null;
export type QuestState = {
  id: number;
  isComplete: boolean;
}
export type PlayerState = {
  gemCount: number;
  totalManualClicks: number;
  depth: number;
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

// [NEW] A lightweight event for high-frequency updates
export const OnGemCountUpdate = new hz.NetworkEvent<{
  gemCount: number;
  totalGPS: number;
}>('OnGemCountUpdate');

// The full state update, now used for low-frequency events
export const OnUpdatePlayerState = new hz.NetworkEvent<{
  gemCount: number;
  generators: Generator[];
  currentQuest: QuestDisplayData;
  gemsPerClick: number;
  nextClickMilestone: ClickMilestone | null;
  totalGPS: number;
  depth: number;
}>('OnUpdatePlayerState');

export const OnManualDrill = new hz.NetworkEvent<{ player: hz.Player }>('OnManualDrill');
export const OnBuyGenerator = new hz.NetworkEvent<{ player: hz.Player, generatorId: number }>('OnBuyGenerator');

// --- STATIC DATA LOCAL EVENTS ---
export const OnStaticDataLoaded = new hz.LocalEvent<{
  generators: Generator[];
  quests: QuestDefinition[];
  milestones: Milestone[];
  clickMilestones: ClickMilestone[];
}>('OnStaticDataLoaded');

// --- UI MANAGER EVENTS ---
export const onImagesReady = new hz.NetworkEvent<{}>('onImagesReady');
export const spawnUIForPlayer = new hz.NetworkEvent<{ player: hz.Player }>('spawnUIForPlayer');
export const cleanupUIForPlayer = new hz.NetworkEvent<{ player: hz.Player }>('cleanupUIForPlayer');
export const onUIReadyForRegistration = new hz.NetworkEvent<{ player: hz.Player, uiName: string, uiEntity: hz.Entity }>('onUIReadyForRegistration');
export const sendUIUpdate = new hz.NetworkEvent<{ player: hz.Player, uiName: string, eventName: string, payload: hz.SerializableState }>('sendUIUpdate');
