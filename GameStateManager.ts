import * as hz from 'horizon/core';
import {
  Generator, OnBuyGenerator, OnManualDrill, OnStaticDataLoaded, OnUpdatePlayerState,
  QuestDefinition, QuestState, QuestDisplayData, PlayerState, ClickMilestone, Milestone,
  OnGemCountUpdate, OnQuestCompleted, OnGeneratorMilestoneReached,
  RebirthState, DailyLoginState, 
  OnRequestLeaderboardData, OnLeaderboardDataUpdate, LeaderboardEntryData
} from './Events';

type MetaData = { saveVersion: number }

export class GameStateManager extends hz.Component<typeof GameStateManager> {
  static propsDefinition = {
    saveVersion: { type: hz.PropTypes.Number, default: 1 },
    forceResetPlayerSave: { type: hz.PropTypes.Boolean, default: false },
    autoSaveIntervalSecs: { type: hz.PropTypes.Number, default: 30 },
    maxOfflineHours: { type: hz.PropTypes.Number, default: 2 },
  }

  private players = new Map<number, PlayerState>();
  private staticData: { generators: Generator[]; quests: QuestDefinition[]; milestones: Milestone[]; clickMilestones: ClickMilestone[]; } | null = null;
  private readonly META_DATA_KEY = 'GemClickerData:ResourceRush_MetaData';
  private readonly GAME_DATA_KEY = 'GemClickerData:ResourceRush_GameData';

  preStart() { this.connectLocalBroadcastEvent(OnStaticDataLoaded, (data) => { this.staticData = data; }); }

  start() {
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterWorld, (player) => this.onPlayerJoined(player));
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerExitWorld, (player) => this.onPlayerLeft(player));
    this.connectNetworkBroadcastEvent(OnManualDrill, ({ player }) => { this.handleManualDrill(player, this.players.get(player.id)!); });
    this.connectNetworkBroadcastEvent(OnBuyGenerator, ({ player, generatorId }) => { this.handleBuyGenerator(player, generatorId, this.players.get(player.id)!); });
    
    this.connectLocalBroadcastEvent(OnRequestLeaderboardData, async ({ player, leaderboardApiName }) => {
        await this.fetchAndSendLeaderboard(player, leaderboardApiName);
    });

    this.async.setInterval(() => { this.players.forEach((state, playerId) => { this.savePlayer(this.world.getPlayer(playerId)!, state); }); }, this.props.autoSaveIntervalSecs * 1000);
    this.async.setInterval(() => this.gameTick(), 1000);
  }
  
  private async fetchAndSendLeaderboard(player: hz.Player, apiName: string) {
    try {
        const leaderboard = await this.world.leaderboards.getLeaderboard(apiName);
        if (!leaderboard) {
            console.error(`Failed to get leaderboard: ${apiName}`);
            return;
        }
        
        const entries = await leaderboard.getEntries(10);
        const entryData: LeaderboardEntryData[] = entries.map(entry => ({
            rank: entry.rank,
            displayName: entry.playerDisplayName,
            score: entry.score,
        }));
        
        this.sendNetworkEvent(player, OnLeaderboardDataUpdate, {
            title: leaderboard.displayName,
            entries: entryData
        });
        
    } catch (e) {
        console.error(`Error fetching leaderboard ${apiName}: ${e}`);
    }
  }

  private gameTick() {
    this.players.forEach((state, playerId) => {
      const totalProduction = this.calculateTotalGPS(state);
      if (totalProduction > 0) {
        state.crystalCount += totalProduction;
        this.checkQuests(state, playerId);
      }
      const player = this.world.getPlayer(playerId);
      if (player) {
        this.sendNetworkEvent(player, OnGemCountUpdate, { crystalCount: state.crystalCount, totalGPS: totalProduction });
      }
    });
  }
  
  private handleManualDrill(player: hz.Player, state: PlayerState) {
    if (state) {
      const crystalsPerClick = this.calculateCrystalsPerClick(state);
      state.crystalCount += crystalsPerClick;
      state.totalManualClicks++;
      state.depth += (1 * (1 + (state.rebirth.darkMatter * 0.01)));
      this.checkQuests(state, player.id);
      this.updatePlayerUI(player, state);
    }
  }
  
  private handleBuyGenerator(player: hz.Player, generatorId: number, state: PlayerState) {
    if (!state) return;
    const generator = state.generators.find((g) => g.id === generatorId);
    if (!generator || state.crystalCount < generator.currentCost) return;
    state.crystalCount -= generator.currentCost;
    generator.owned++;
    generator.currentCost = Math.floor(generator.baseCost * Math.pow(1.15, generator.owned));
    this.checkQuests(state, player.id);
    this.savePlayer(player, state);
    this.updatePlayerUI(player, state);
  }

  private async onPlayerJoined(player: hz.Player) {
    if (!this.staticData) { this.async.setTimeout(() => this.onPlayerJoined(player), 100); return; }
    if (this.props.forceResetPlayerSave) {
        this.players.set(player.id, this.createNewPlayerData());
    } else {
        const gameData = await this.world.persistentStorage.getPlayerVariable<PlayerState>(player, this.GAME_DATA_KEY);
        this.players.set(player.id, gameData ? this.mergeWithDefault(gameData) : this.createNewPlayerData());
    }
    this.updatePlayerUI(player);
  }

  private async onPlayerLeft(player: hz.Player) {
    await this.savePlayer(player);
    this.players.delete(player.id);
  }
  
  private async savePlayer(player: hz.Player, state?: PlayerState) {
    const stateToSave = state || this.players.get(player.id);
    if (!stateToSave || !player) return;

    this.world.leaderboards.setScoreForPlayer(player, 'top_crystals_all_time', Math.floor(stateToSave.crystalCount));
    this.world.leaderboards.setScoreForPlayer(player, 'deepest_depth_all_time', Math.floor(stateToSave.depth));
    
    stateToSave.lastUpdateTimestamp = Date.now();
    await this.world.persistentStorage.setPlayerVariable(player, this.GAME_DATA_KEY, stateToSave);
  }

  private updatePlayerUI(player: hz.Player, state?: PlayerState) {
    const currentState = state || this.players.get(player.id);
    if (!currentState || !this.staticData) return;
    const firstIncompleteQuestState = currentState.quests.find((q) => !q.isComplete);
    let currentQuestForUI: QuestDisplayData = null;
    if (firstIncompleteQuestState) {
      const questDef = this.staticData.quests.find(def => def.id === firstIncompleteQuestState.id);
      if (questDef) { currentQuestForUI = { id: questDef.id, description: questDef.description }; }
    }
    const generatorsForUI = currentState.generators.map(gen => ({ ...gen, nextMilestone: this.staticData!.milestones.find(m => gen.owned < m.owned) }));
    const nextClickMilestone = this.staticData.clickMilestones.find(m => currentState.totalManualClicks < m.clicks) || null;
    
    this.sendNetworkEvent(player, OnUpdatePlayerState, {
      crystalCount: currentState.crystalCount, generators: generatorsForUI, currentQuest: currentQuestForUI,
      crystalsPerClick: this.calculateCrystalsPerClick(currentState), nextClickMilestone: nextClickMilestone,
      totalGPS: this.calculateTotalGPS(currentState), depth: currentState.depth, rebirthState: currentState.rebirth,
      totalManualClicks: currentState.totalManualClicks
    });
  }

  private createNewPlayerData(): PlayerState {
    if (!this.staticData) return { crystalCount: 0, totalManualClicks: 0, depth: 0, lastUpdateTimestamp: 0, generators: [], quests: [], rebirth: { darkMatter: 0, peakCPS: 0, rebirthCount: 0 }, dailyLogin: { lastLoginTimestamp: 0, consecutiveDays: 0 } };
    return { crystalCount: 0, totalManualClicks: 0, depth: 0, lastUpdateTimestamp: Date.now(), generators: JSON.parse(JSON.stringify(this.staticData.generators)), quests: this.staticData.quests.map((def) => ({ id: def.id, isComplete: false })), rebirth: { darkMatter: 0, peakCPS: 0, rebirthCount: 0 }, dailyLogin: { lastLoginTimestamp: 0, consecutiveDays: 0 }, };
  }

  private mergeWithDefault(loadedData: Partial<PlayerState>): PlayerState {
      const defaultData = this.createNewPlayerData();
      const merged: PlayerState = { ...defaultData, ...loadedData, rebirth: { ...defaultData.rebirth, ...loadedData.rebirth }, dailyLogin: { ...defaultData.dailyLogin, ...loadedData.dailyLogin }, };
      if (!loadedData.generators || loadedData.generators.length !== defaultData.generators.length) { merged.generators = defaultData.generators; }
      if (!loadedData.quests || loadedData.quests.length !== defaultData.quests.length) { merged.quests = defaultData.quests; }
      return merged;
  }

  private calculateTotalGPS(state: PlayerState): number { return state.generators.reduce((total, gen) => total + this.calculateGeneratorGPS(gen, state), 0); }
  private calculateGeneratorGPS(generator: Generator, state: PlayerState): number {
    if (!this.staticData) return generator.owned * generator.productionRate;
    const milestone = this.staticData.milestones.slice().reverse().find(m => generator.owned >= m.owned);
    const finalMultiplier = milestone ? milestone.multiplier : 1;
    return generator.owned * generator.productionRate * finalMultiplier * (1 + (state.rebirth.darkMatter * 0.05));
  }
  private calculateCrystalsPerClick(state: PlayerState): number {
    if (!this.staticData) return 1;
    const milestone = this.staticData.clickMilestones.slice().reverse().find(m => state.totalManualClicks >= m.clicks);
    const crystals = milestone ? milestone.crystalsPerClick : 1;
    return crystals * (1 + (state.rebirth.darkMatter * 0.001));
  }
  private checkQuests(state: PlayerState, playerId: number): boolean {
    if (!this.staticData) return false;
    let questWasCompleted = false;
    state.quests.forEach((questState) => {
      if (!questState.isComplete) {
        const definition = this.staticData!.quests.find(def => def.id === questState.id);
        if (definition && definition.checkCondition(state.crystalCount, state.generators)) {
          questState.isComplete = true;
          questWasCompleted = true;
          if (definition.rewardDarkMatter) { state.rebirth.darkMatter += definition.rewardDarkMatter; }
          const player = this.world.getPlayer(playerId);
          if (player) { this.sendNetworkBroadcastEvent(OnQuestCompleted, { player, questId: definition.id }); }
        }
      }
    });
    return questWasCompleted;
  }
}
hz.Component.register(GameStateManager);
