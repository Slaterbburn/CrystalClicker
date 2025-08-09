import * as hz from 'horizon/core'

export type Generator = { id: number; name: string; baseCost: number; productionRate: number; owned: number; currentCost: number; nextMilestone?: { owned: number; multiplier: number; } }
export type QuestDefinition = { id: number; description: string; checkCondition: (crystals: number, generators: Generator[]) => boolean; rewardDarkMatter?: number; }
export type QuestDisplayData = { id: number; description: string; } | null;
export type QuestState = { id: number; isComplete: boolean; }
export type ClickMilestone = { clicks: number; crystalsPerClick: number; };
export type Milestone = { owned: number; multiplier: number; };
export type RebirthState = { darkMatter: number; peakCPS: number; rebirthCount: number; };
export type DailyLoginState = { lastLoginTimestamp: number; consecutiveDays: number; };
export type PlayerState = { crystalCount: number; totalManualClicks: number; depth: number; lastUpdateTimestamp: number; generators: Generator[]; quests: QuestState[]; rebirth: RebirthState; dailyLogin: DailyLoginState; }
export type LeaderboardEntryData = { rank: number; displayName: string; score: number; }

export const OnUpdatePlayerState = new hz.NetworkEvent<{ crystalCount: number; generators: Generator[]; currentQuest: QuestDisplayData; crystalsPerClick: number; nextClickMilestone: ClickMilestone | null; totalGPS: number; depth: number; rebirthState: RebirthState; totalManualClicks: number; }>('OnUpdatePlayerState')
export const OnGemCountUpdate = new hz.NetworkEvent<{ crystalCount: number; totalGPS: number; }>('OnGemCountUpdate');
export const OnLeaderboardDataUpdate = new hz.NetworkEvent<{ title: string, entries: LeaderboardEntryData[] }>('OnLeaderboardDataUpdate');

export const OnManualDrill = new hz.NetworkEvent<{ player: hz.Player }>('OnManualDrill')
export const OnBuyGenerator = new hz.NetworkEvent<{ player: hz.Player, generatorId: number }>('OnBuyGenerator')
export const OnPlayerRebirth = new hz.NetworkEvent<{ player: hz.Player }>('OnPlayerRebirth');

// [FIXED] Added the missing OnGeneratorMilestoneReached event definition.
export const OnGeneratorMilestoneReached = new hz.NetworkEvent<{ player: hz.Player, generatorId: number }>('OnGeneratorMilestoneReached');

export const OnQuestCompleted = new hz.NetworkEvent<{ player: hz.Player, questId: number }>('OnQuestCompleted');

export const OnRequestRebirthReset = new hz.LocalEvent<{ playerId: string }>();
export const OnShowOfflineProgress = new hz.NetworkEvent<{ crystalsEarned: number, durationSeconds: number }>('OnShowOfflineProgress');
export const OnClaimDailyReward = new hz.NetworkEvent<{ player: hz.Player }>('OnClaimDailyReward');
export const OnDailyRewardStateUpdate = new hz.NetworkEvent<{ canClaim: boolean, consecutiveDays: number }>('OnDailyRewardStateUpdate');

export const OnStaticDataLoaded = new hz.LocalEvent<{ generators: Generator[]; quests: QuestDefinition[]; milestones: Milestone[]; clickMilestones: ClickMilestone[]; }>()
export const onImagesReady = new hz.NetworkEvent<{}>('onImagesReady');

export const OnNavigateToGame = new hz.LocalEvent<{}>();
export const OnNavigateToMenu = new hz.LocalEvent<{}>();
export const OnNavigateToLeaderboards = new hz.LocalEvent<{}>();

export const OnRequestLeaderboardData = new hz.NetworkEvent<{ player: hz.Player, leaderboardApiName: string }>('OnRequestLeaderboardData');
