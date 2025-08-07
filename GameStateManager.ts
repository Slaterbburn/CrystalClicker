import * as hz from 'horizon/core';
import {
  Generator, OnBuyGenerator, OnManualDrill, OnStaticDataLoaded, OnUpdatePlayerState,
  QuestDefinition, QuestState, QuestDisplayData, PlayerState, ClickMilestone, Milestone,
  OnGemCountUpdate, OnBoostStateChanged, OnQuestCompleted, OnGeneratorMilestoneReached,
  RebirthState, DailyLoginState, OnRequestRebirthReset, OnCrystalTierUp, OnDepthMilestoneReached,
  OnCalculateOfflineProgress, OnShowOfflineProgress
} from './Events';

type MetaData = {
  saveVersion: number
}

type PlayerMultipliers = {
    clickMultiplier: number;
    generatorMultiplier: number;
    globalMultiplier: number;
}

export class GameStateManager extends hz.Component<typeof GameStateManager> {
  static propsDefinition = {
    saveVersion: { type: hz.PropTypes.Number, default: 1 },
    forceResetPlayerSave: { type: hz.PropTypes.Boolean, default: false },
    autoSaveIntervalSecs: { type: hz.PropTypes.Number, default: 30 },
    maxOfflineHours: { type: hz.PropTypes.Number, default: 2 },
  }

  private players = new Map<number, PlayerState>();
  private playerBoostMultipliers = new Map<number, PlayerMultipliers>();
  private staticData: {
    generators: Generator[];
    quests: QuestDefinition[];
    milestones: Milestone[];
    clickMilestones: ClickMilestone[];
  } | null = null;

  // [FIXED] Corrected the PPV keys to include the Variable Group name.
  private readonly META_DATA_KEY = 'GemClickerData:ResourceRush_MetaData';
  private readonly GAME_DATA_KEY = 'GemClickerData:ResourceRush_GameData';

  preStart() {
    this.connectLocalBroadcastEvent(OnStaticDataLoaded, (data) => {
        this.staticData = data;
    });
  }

  start() {
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterWorld, (player) => this.onPlayerJoined(player));
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerExitWorld, (player) => this.onPlayerLeft(player));
    this.connectNetworkBroadcastEvent(OnManualDrill, ({ player }) => {
      this.handleManualDrill(player, this.players.get(player.id)!);
    });
    this.connectNetworkBroadcastEvent(OnBuyGenerator, ({ player, generatorId, amount }) => {
      this.handleBuyGenerator(player, generatorId, amount, this.players.get(player.id)!);
    });
    this.connectLocalBroadcastEvent(OnBoostStateChanged, (data) => {
        this.applyBoostEffect(data.playerId, data.boostId, data.isActive, data.multiplier);
    });
    this.connectLocalBroadcastEvent(OnRequestRebirthReset, async ({ playerId }) => {
        const player = this.world.getPlayers().find(p => p.id === playerId);
        if (player) {
            await this.resetPlayerForRebirth(player);
        }
    });
    this.connectLocalBroadcastEvent(OnCalculateOfflineProgress, ({ player, state }) => {
        this.handleOfflineProgress(player, state);
    });

    const saveInterval = this.props.autoSaveIntervalSecs > 0 ? this.props.autoSaveIntervalSecs : 30;
    this.async.setInterval(() => {
        this.players.forEach((state, playerId) => {
            const player = this.world.getPlayers().find(p => p.id === playerId);
            if(player) {
                this.savePlayer(player, state);
            }
        });
    }, saveInterval * 1000);

    this.async.setInterval(() => this.gameTick(), 1000);
  }
  
  private async onPlayerJoined(player: hz.Player) {
    if (!this.staticData) {
      this.async.setTimeout(() => this.onPlayerJoined(player), 100);
      return;
    }
    
    if (this.props.forceResetPlayerSave) {
        const newState = this.createNewPlayerData();
        this.players.set(player.id, newState);
        await this.savePlayer(player, newState);
        this.updatePlayerMultipliers(player, newState.rebirth);
        this.updatePlayerUI(player);
        return;
    }
    
    const metaData = await this.world.persistentStorage.getPlayerVariable<MetaData>(player, this.META_DATA_KEY);
    const gameData = await this.world.persistentStorage.getPlayerVariable<PlayerState>(player, this.GAME_DATA_KEY);
    
    let loadedState: PlayerState;
    if (metaData && metaData.saveVersion === this.props.saveVersion && gameData) {
        loadedState = this.mergeWithDefault(gameData);
    } else {
        loadedState = this.createNewPlayerData();
    }
    
    this.players.set(player.id, loadedState);
    this.updatePlayerMultipliers(player, loadedState.rebirth);
    this.updatePlayerUI(player);
  }

  private onPlayerLeft(player: hz.Player) {
    this.savePlayer(player);
    this.players.delete(player.id);
    this.playerBoostMultipliers.delete(player.id);
  }

  private createNewPlayerData(): PlayerState {
    if (!this.staticData) {
        const defaultRebirthState: RebirthState = { darkMatter: 0, peakCPS: 0 };
        const defaultDailyLoginState: DailyLoginState = { lastLoginTimestamp: 0, consecutiveDays: 0 };
        return { crystalCount: 0, totalManualClicks: 0, depth: 0, lastUpdateTimestamp: 0, generators: [], quests: [], rebirth: defaultRebirthState, dailyLogin: defaultDailyLoginState };
    }
    return {
      crystalCount: 0, totalManualClicks: 0, depth: 0, lastUpdateTimestamp: 0,
      generators: JSON.parse(JSON.stringify(this.staticData.generators)),
      quests: this.staticData.quests.map((def) => ({ id: def.id, isComplete: false })),
      rebirth: { darkMatter: 0, peakCPS: 0 },
      dailyLogin: { lastLoginTimestamp: 0, consecutiveDays: 0 },
    };
  }

  private mergeWithDefault(loadedData: Partial<PlayerState>): PlayerState {
      const defaultData = this.createNewPlayerData();
      const merged: PlayerState = { ...defaultData, ...loadedData,
          rebirth: { ...defaultData.rebirth, ...loadedData.rebirth },
          dailyLogin: { ...defaultData.dailyLogin, ...loadedData.dailyLogin },
      };
      if (!loadedData.generators || loadedData.generators.length !== defaultData.generators.length) {
          merged.generators = defaultData.generators;
      }
      if (!loadedData.quests || loadedData.quests.length !== defaultData.quests.length) {
          merged.quests = defaultData.quests;
      }
      return merged;
  }

  private async handleOfflineProgress(player: hz.Player, state: PlayerState) {
    const now = Date.now();
    const timeOfflineMs = now - state.lastUpdateTimestamp;
    const maxOfflineMs = this.props.maxOfflineHours * 60 * 60 * 1000;
    const effectiveTimeMs = Math.min(timeOfflineMs, maxOfflineMs);

    if (effectiveTimeMs < 60000) {
        await this.savePlayer(player, state);
        return;
    }

    this.updatePlayerMultipliers(player, state.rebirth);
    const totalProduction = state.generators.reduce((total, gen) => total + this.calculateGeneratorGPS(gen, player.id), 0);
    const crystalsEarned = Math.floor(totalProduction * (effectiveTimeMs / 1000));
    
    if (crystalsEarned > 0) {
        state.crystalCount += crystalsEarned;
        this.players.set(player.id, state);
        await this.savePlayer(player, state);
        
        this.sendNetworkEvent(player, OnShowOfflineProgress, { 
            crystalsEarned: crystalsEarned,
            durationSeconds: Math.floor(effectiveTimeMs / 1000)
        });
        this.updatePlayerUI(player);
    } else {
        await this.savePlayer(player, state);
    }
  }

  private calculateGeneratorGPS(generator: Generator, playerId: number): number {
    let finalMultiplier = 1;
    if (!this.staticData) return generator.owned * generator.productionRate;
    for (let i = this.staticData.milestones.length - 1; i >= 0; i--) {
        const milestone = this.staticData.milestones[i];
        if (generator.owned >= milestone.owned) {
            finalMultiplier = milestone.multiplier;
            break;
        }
    }
    const playerMultipliers = this.playerBoostMultipliers.get(playerId) || { clickMultiplier: 1, generatorMultiplier: 1, globalMultiplier: 1 };
    return generator.owned * generator.productionRate * finalMultiplier * playerMultipliers.generatorMultiplier * playerMultipliers.globalMultiplier;
  }

  private calculateCrystalsPerClick(state: PlayerState, playerId: number): number {
    let crystals = 1;
    if (!this.staticData) return crystals;
    for (let i = this.staticData.clickMilestones.length - 1; i >= 0; i--) {
        const milestone = this.staticData.clickMilestones[i];
        if (state.totalManualClicks >= milestone.clicks) {
            crystals = milestone.crystalsPerClick;
            break;
        }
    }
    const playerMultipliers = this.playerBoostMultipliers.get(playerId) || { clickMultiplier: 1, generatorMultiplier: 1, globalMultiplier: 1 };
    return crystals * playerMultipliers.clickMultiplier * playerMultipliers.globalMultiplier;
  }

  private applyBoostEffect(playerId: number, boostId: string, isActive: boolean, multiplier: number) {
    const multipliers = this.playerBoostMultipliers.get(playerId);
    if (!multipliers) return;

    if (boostId === 'clickFrenzy') {
        multipliers.clickMultiplier = isActive ? multiplier : 1;
    } else if (boostId === 'genOverdrive') {
        multipliers.generatorMultiplier = isActive ? multiplier : 1;
    }
    
    const player = this.world.getPlayers().find(p => p.id === playerId);
    if(player) {
      this.updatePlayerUI(player);
    }
  }

  private updatePlayerMultipliers(player: hz.Player, rebirthState: RebirthState) {
    const darkMatterBonus = 1 + (rebirthState.darkMatter * 0.02);
    this.playerBoostMultipliers.set(player.id, {
        clickMultiplier: 1,
        generatorMultiplier: 1,
        globalMultiplier: darkMatterBonus,
    });
  }

  private gameTick() {
    this.players.forEach((state, playerId) => {
      const totalProduction = state.generators.reduce((total, gen) => total + this.calculateGeneratorGPS(gen, playerId), 0);
      
      if (totalProduction > 0) {
        state.crystalCount += totalProduction;
        this.checkQuests(state, playerId);
        if (totalProduction > state.rebirth.peakCPS) {
            state.rebirth.peakCPS = totalProduction;
        }
      }
      
      const player = this.world.getPlayers().find(p => p.id === playerId);
      if (player) {
        this.sendNetworkEvent(player, OnGemCountUpdate, {
          crystalCount: state.crystalCount,
          totalGPS: totalProduction
        });
      }
    });
  }

  private handleManualDrill(player: hz.Player, state: PlayerState) {
    if (state) {
      const crystalsPerClickBefore = this.calculateCrystalsPerClick(state, player.id);
      state.crystalCount += crystalsPerClickBefore;
      state.totalManualClicks++;
      state.depth++;
      
      const questsCompleted = this.checkQuests(state, player.id);
      const crystalsPerClickAfter = this.calculateCrystalsPerClick(state, player.id);
      
      if (crystalsPerClickBefore !== crystalsPerClickAfter || questsCompleted) {
        this.updatePlayerUI(player, state);
      }
    }
  }
  
  private handleBuyGenerator(player: hz.Player, generatorId: number, amount: number | 'MAX', state: PlayerState) {
    if (!state) return;
    const generator = state.generators.find((g) => g.id === generatorId);
    if (!generator) return;

    const costIncreaseRatio = 1.15;
    let totalCost = 0;
    let amountToBuy = 0;

    if (amount === 'MAX') {
        let affordableAmount = 0;
        let cumulativeCost = 0;
        let nextCost = generator.currentCost;
        while (state.crystalCount >= cumulativeCost + nextCost) {
            cumulativeCost += nextCost;
            affordableAmount++;
            nextCost = Math.floor(generator.baseCost * Math.pow(costIncreaseRatio, generator.owned + affordableAmount));
        }
        amountToBuy = affordableAmount;
        totalCost = cumulativeCost;
    } else {
        amountToBuy = amount;
        let cumulativeCost = 0;
        for (let i = 0; i < amountToBuy; i++) {
            cumulativeCost += Math.floor(generator.baseCost * Math.pow(costIncreaseRatio, generator.owned + i));
        }
        totalCost = cumulativeCost;
    }

    if (amountToBuy > 0 && state.crystalCount >= totalCost) {
        state.crystalCount -= totalCost;
        const oldOwned = generator.owned;
        generator.owned += amountToBuy;
        generator.currentCost = Math.floor(generator.baseCost * Math.pow(costIncreaseRatio, generator.owned));

        const milestone = this.staticData?.milestones.find(m => oldOwned < m.owned && generator.owned >= m.owned);
        if(milestone) {
            this.sendNetworkBroadcastEvent(OnGeneratorMilestoneReached, { player, generatorId });
        }
        
        this.checkQuests(state, player.id);
        this.savePlayer(player, state);
        this.updatePlayerUI(player, state);
    }
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
          
          if (definition.rewardDarkMatter) {
              state.rebirth.darkMatter += definition.rewardDarkMatter;
          }

          const player = this.world.getPlayers().find(p => p.id === playerId);
          if (player) {
            player.setAchievementComplete(definition.id.toString(), true);
            this.sendNetworkBroadcastEvent(OnQuestCompleted, { player, questId: definition.id });
          }
        }
      }
    });
    return questWasCompleted;
  }
  
  private async resetPlayerForRebirth(player: hz.Player) {
    const currentState = this.players.get(player.id);
    if (!currentState) return;

    const freshState = this.createNewPlayerData();
    
    currentState.crystalCount = freshState.crystalCount;
    currentState.totalManualClicks = freshState.totalManualClicks;
    currentState.depth = freshState.depth;
    currentState.generators = freshState.generators;
    currentState.quests = freshState.quests;
    
    this.updatePlayerMultipliers(player, currentState.rebirth);
    await this.savePlayer(player, currentState);
    this.updatePlayerUI(player, currentState);
  }

  private updatePlayerUI(player: hz.Player, state?: PlayerState) {
    const currentState = state || this.players.get(player.id);
    if (!currentState || !this.staticData) return;

    const firstIncompleteQuestState = currentState.quests.find((q) => !q.isComplete);
    let currentQuestForUI: QuestDisplayData = null;
    if (firstIncompleteQuestState) {
      const questDef = this.staticData.quests.find(def => def.id === firstIncompleteQuestState.id);
      if (questDef) {
        currentQuestForUI = { id: questDef.id, description: questDef.description };
      }
    }
    const generatorsForUI = currentState.generators.map(gen => {
        const nextMilestone = this.staticData!.milestones.find(m => gen.owned < m.owned);
        return { ...gen, nextMilestone: nextMilestone };
    });
    const nextClickMilestone = this.staticData.clickMilestones.find(m => currentState.totalManualClicks < m.clicks) || null;
    const totalGPS = currentState.generators.reduce((total, gen) => total + this.calculateGeneratorGPS(gen, player.id), 0);
    
    this.sendNetworkEvent(player, OnUpdatePlayerState, {
      crystalCount: currentState.crystalCount,
      generators: generatorsForUI,
      currentQuest: currentQuestForUI,
      crystalsPerClick: this.calculateCrystalsPerClick(currentState, player.id),
      nextClickMilestone: nextClickMilestone,
      totalGPS: totalGPS,
      depth: currentState.depth,
      rebirthState: currentState.rebirth
    });
  }

  private async savePlayer(player: hz.Player, state?: PlayerState) {
    const stateToSave = state || this.players.get(player.id);
    if (!stateToSave) return;
    stateToSave.lastUpdateTimestamp = Date.now();
    const metaData: MetaData = { saveVersion: this.props.saveVersion };
    await this.world.persistentStorage.setPlayerVariable(player, this.META_DATA_KEY, metaData);
    await this.world.persistentStorage.setPlayerVariable(player, this.GAME_DATA_KEY, stateToSave);
  }
}
hz.Component.register(GameStateManager);
